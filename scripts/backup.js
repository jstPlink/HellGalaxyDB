// Backup del database (SQLite) dell'app: copie coerenti con VACUUM INTO, in <cartella del database>/backups.
//   - automatico ogni giorno alle 03:00 (ora italiana) e all'avvio se l'ultimo ha più di 24 ore (si tengono le ultime 14);
//   - manuale dal pulsante "Crea backup ora" (Impostazioni);
//   - automatico PRIMA di ogni "Applica su Unreal" (prefisso "prima-di-unreal", si tengono le ultime 10).
// I backup contengono solo il database (i file texture/mesh in data/media si possono rigenerare da Unreal).
// Ripristino: fermare l'app, copiare il file scelto in data/hellgalaxy.db (togliendo l'eventuale -wal/-shm) e riavviare.
// Rotte: GET /api/backups · POST /api/backups · GET /api/backups/<file> (scarica).
'use strict';
const fs = require('fs');
const path = require('path');

const NAME_RE = /^hellgalaxy-\d{8}-\d{6}(?:-[a-z\-]+)?\.db$/;
const KEEP = { auto: 14, 'prima-di-unreal': 10, manuale: 20 };

module.exports = function createBackup({ db, dbPath, sendJson, readJsonBody, log = () => {} }) {
  const dir = path.join(path.dirname(dbPath), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const rome = () => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(new Date()).reduce((o, p) => (o[p.type] = p.value, o), {});
  const kindOf = f => (f.includes('-prima-di-unreal') ? 'prima-di-unreal' : f.includes('-manuale') ? 'manuale' : 'auto');

  function list() {
    return fs.readdirSync(dir).filter(f => NAME_RE.test(f)).map(f => { const s = fs.statSync(path.join(dir, f)); return { file: f, bytes: s.size, at: s.mtime.toISOString(), kind: kindOf(f) }; }).sort((a, b) => (a.file < b.file ? 1 : -1));
  }
  function prune() {
    for (const [kind, keep] of Object.entries(KEEP)) for (const b of list().filter(x => x.kind === kind).slice(keep)) fs.rmSync(path.join(dir, b.file), { force: true });
  }
  // kind: 'auto' | 'manuale' | 'prima-di-unreal'
  function create(kind = 'manuale') {
    const n = rome(), stamp = n.year + n.month + n.day + '-' + (n.hour === '24' ? '00' : n.hour) + n.minute + n.second;
    const file = 'hellgalaxy-' + stamp + (kind === 'auto' ? '' : '-' + kind) + '.db';
    if (fs.existsSync(path.join(dir, file))) return { file, bytes: fs.statSync(path.join(dir, file)).size, kind }; // già creato in questo secondo
    const full = path.join(dir, file);
    db.exec("VACUUM INTO '" + full.replace(/'/g, "''") + "'");
    prune();
    log('backup del database creato: ' + file);
    return { file, bytes: fs.statSync(full).size, kind };
  }

  let sched = null, lastKey = '';
  function startScheduler() {
    if (sched) return;
    sched = setInterval(() => {
      const n = rome(), key = n.year + n.month + n.day;
      if ((n.hour === '03' || n.hour === '3') && n.minute === '00' && lastKey !== key) { lastKey = key; try { create('auto'); } catch (e) { log('backup automatico non riuscito: ' + e.message); } }
    }, 30000);
    sched.unref && sched.unref();
    // all'avvio: se manca un backup automatico delle ultime 24 ore, ne crea uno
    const t = setTimeout(() => { try { const last = list().find(b => b.kind === 'auto'); if (!last || Date.now() - new Date(last.at).getTime() > 24 * 3600 * 1000) create('auto'); } catch (e) { log('backup all\'avvio non riuscito: ' + e.message); } }, 20000);
    t.unref && t.unref();
  }

  async function handle(req, res, urlPath) {
    let m;
    if (urlPath === '/api/backups' && req.method === 'GET') { sendJson(res, 200, { backups: list(), keep: KEEP, timezone: 'Europe/Rome' }); return true; }
    if (urlPath === '/api/backups' && req.method === 'POST') {
      try { sendJson(res, 200, { ok: true, ...create('manuale') }); } catch (e) { sendJson(res, 500, { ok: false, error: e.message }); }
      return true;
    }
    if ((m = urlPath.match(/^\/api\/backups\/([A-Za-z0-9._\-]+)$/)) && req.method === 'GET') {
      const f = m[1];
      if (!NAME_RE.test(f) || !fs.existsSync(path.join(dir, f))) { sendJson(res, 404, { error: 'backup non trovato' }); return true; }
      const s = fs.statSync(path.join(dir, f));
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': s.size, 'Content-Disposition': 'attachment; filename="' + f + '"', 'Cache-Control': 'no-store' });
      fs.createReadStream(path.join(dir, f)).pipe(res);
      return true;
    }
    return false;
  }
  handle.create = create; handle.list = list; handle.startScheduler = startScheduler; handle.dir = dir;
  return handle;
};
