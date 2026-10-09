// Replica automatica verso il server (NAS): ogni modifica fatta nell'app locale viene inviata al server, SOLO le righe cambiate.
//   - dopo ogni richiesta che modifica i dati (attesa breve: più modifiche ravvicinate partono insieme);
//   - negli orari fissi, ora italiana (HG_REMOTE_SYNC_TIMES, predefinito 08:00,13:00,19:00), come controllo di sicurezza;
//   - all'avvio dell'app locale.
// Come funziona: per ogni tabella dei dati si calcola un'impronta (hash) di ogni riga e la si confronta con quella
// dell'ultimo invio riuscito (tabella remote_state). Le righe nuove/cambiate vanno al server con POST /api/import/delta;
// le righe eliminate in locale sono eliminate anche sul server. Le righe che esistono solo sul server NON vengono toccate.
// Texture, mesh e anteprime (data/media) seguono le righe di media_assets: i file mancanti sul server sono caricati prima.
// Non tocca Unreal. L'invio verso Unreal resta un'azione a parte, con un clic ("Aggiorna Unreal").
// Config locale: HG_REMOTE_URL (es. https://hgdb.fplinio.it) e HG_REMOTE_TOKEN (= HG_API_TOKEN del server, se impostato).
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Tabelle replicate (chiave primaria letta da PRAGMA). Esclusi: utenti, cronologia, vecchie pagine DATABASE.
const TABLES = ['entities', 'entities_ue', 'modules_sheet', 'modules_sections', 'modules_ue', 'sheet_rows', 'sheet_sections', 'sheet_ue',
  'grid_tabs', 'grid_rows', 'grid_edits', 'entity_links', 'deleted_rows', 'app_rows', 'media_assets', 'media_links'];
const CHUNK_BYTES = 3 * 1024 * 1024;
const DEBOUNCE_MS = Number(process.env.HG_REMOTE_DEBOUNCE_MS) || 8000;

const tableInfo = (db, t) => db.prepare('PRAGMA table_info(' + t + ')').all();
const pkOf = (db, t) => tableInfo(db, t).filter(c => c.pk > 0).sort((a, b) => a.pk - b.pk).map(c => c.name);
const exists = (db, t) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t);

// ---------- lato SERVER: applica le righe ricevute ----------
function importDelta(db, body) {
  const t = body && body.table;
  if (!TABLES.includes(t) || !exists(db, t)) throw new Error('tabella non consentita: ' + t);
  const cols = tableInfo(db, t).map(c => c.name), pk = pkOf(db, t);
  const ins = db.prepare('INSERT OR REPLACE INTO ' + t + ' (' + cols.join(',') + ') VALUES (' + cols.map(() => '?').join(',') + ')');
  const del = db.prepare('DELETE FROM ' + t + ' WHERE ' + pk.map(c => c + ' = ?').join(' AND '));
  let up = 0, rm = 0;
  db.exec('BEGIN');
  try {
    for (const r of body.upserts || []) { ins.run(...cols.map(c => (r[c] === undefined ? null : r[c]))); up++; }
    for (const k of body.deletes || []) { del.run(...pk.map(c => k[c])); rm++; }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return { table: t, upserted: up, deleted: rm };
}

// ---------- lato LOCALE ----------
function createReplica({ db, baseDir, log = () => {}, getUser = () => 'app locale' }) {
  db.exec('CREATE TABLE IF NOT EXISTS remote_state (t TEXT NOT NULL, k TEXT NOT NULL, h TEXT NOT NULL, PRIMARY KEY (t, k))');
  const state = { running: false, queued: false, lastAt: null, lastTrigger: '', lastResult: null, error: '', timer: null, schedKey: '' };
  const cfg = () => ({ url: (process.env.HG_REMOTE_URL || '').replace(/\/+$/, ''), token: process.env.HG_REMOTE_TOKEN || '' });
  const times = () => (process.env.HG_REMOTE_SYNC_TIMES || '08:00,13:00,19:00').split(',').map(s => s.trim()).filter(s => /^\d{1,2}:\d{2}$/.test(s));

  async function remote(path_, opts = {}) {
    const c = cfg();
    const headers = { ...(c.token ? { Authorization: 'Bearer ' + c.token } : {}), 'X-HG-User': encodeURIComponent(getUser()), ...(opts.headers || {}) };
    let r;
    try { r = await fetch(c.url + path_, { ...opts, headers, signal: AbortSignal.timeout(120000) }); }
    catch (e) { throw new Error('server non raggiungibile (' + c.url + '): ' + e.message); }
    if (r.status === 401) throw new Error('il server rifiuta il token (HG_REMOTE_TOKEN)');
    if (!r.ok) { let m = ''; try { m = (await r.json()).error || ''; } catch (e) { /* non JSON */ } throw new Error('il server ha risposto ' + r.status + (m ? ': ' + m : '')); }
    return r.json().catch(() => ({}));
  }

  // righe cambiate/nuove e righe eliminate dall'ultimo invio riuscito
  function diff() {
    const out = [];
    for (const t of TABLES) {
      if (!exists(db, t)) continue;
      const cols = tableInfo(db, t).map(c => c.name), pk = pkOf(db, t);
      if (!pk.length) continue;
      const known = new Map(db.prepare('SELECT k, h FROM remote_state WHERE t = ?').all(t).map(r => [r.k, r.h]));
      const upserts = [], seen = new Set();
      for (const r of db.prepare('SELECT * FROM ' + t).all()) {
        const k = JSON.stringify(pk.map(c => r[c])), h = crypto.createHash('sha1').update(JSON.stringify(cols.map(c => r[c]))).digest('hex');
        seen.add(k);
        if (known.get(k) !== h) upserts.push({ k, h, row: { ...r } });
      }
      const deletes = [];
      for (const k of known.keys()) if (!seen.has(k)) { const v = JSON.parse(k); deletes.push({ k, key: Object.fromEntries(pk.map((c, i) => [c, v[i]])) }); }
      if (upserts.length || deletes.length) out.push({ t, pk, upserts, deletes });
    }
    return out;
  }
  const pendingCount = () => diff().reduce((a, d) => a + d.upserts.length + d.deletes.length, 0);

  async function uploadMediaFiles(rows) {
    let files = 0;
    const send = async (kind, file, name) => {
      if (!fs.existsSync(file)) return;
      await remote('/api/media/upload?kind=' + kind + '&name=' + encodeURIComponent(name), { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: fs.readFileSync(file) });
      files++;
    };
    for (const { row } of rows) {
      if (row.kind === 'texture') await send('texture', path.join(baseDir, 'textures', row.name + '.png'), row.name + '.png');
      else if (row.kind === 'mesh') {
        await send('mesh', path.join(baseDir, 'meshes', row.name + '.fbx'), row.name + '.fbx');
        if (row.preview) await send('preview', path.join(baseDir, 'previews', row.name + '.png'), row.name + '.png');
      }
    }
    return files;
  }

  async function run(trigger) {
    const c = cfg();
    if (!c.url) return { configured: false };
    if (state.running) { state.queued = true; return { running: true }; }
    state.running = true; state.queued = false; state.error = '';
    const res = { upserted: 0, deleted: 0, files: 0, tables: {} };
    try {
      for (const d of diff()) {
        const saveState = db.prepare('INSERT OR REPLACE INTO remote_state (t, k, h) VALUES (?, ?, ?)');
        const dropState = db.prepare('DELETE FROM remote_state WHERE t = ? AND k = ?');
        // a pezzi (le tabelle grandi, come grid_rows, non devono superare il limite di una richiesta)
        let batch = [], bytes = 0;
        const flush = async (dels) => {
          if (!batch.length && !dels.length) return;
          if (d.t === 'media_assets') res.files += await uploadMediaFiles(batch);
          await remote('/api/import/delta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ table: d.t, upserts: batch.map(b => b.row), deletes: dels.map(x => x.key) }) });
          db.exec('BEGIN'); for (const b of batch) saveState.run(d.t, b.k, b.h); for (const x of dels) dropState.run(d.t, x.k); db.exec('COMMIT');
          res.upserted += batch.length; res.deleted += dels.length; res.tables[d.t] = (res.tables[d.t] || 0) + batch.length + dels.length;
          batch = []; bytes = 0;
        };
        for (const u of d.upserts) {
          const size = JSON.stringify(u.row).length;
          if (batch.length && bytes + size > CHUNK_BYTES) await flush([]);
          batch.push(u); bytes += size;
        }
        await flush(d.deletes);
      }
      state.lastResult = res; state.lastAt = new Date().toISOString(); state.lastTrigger = trigger || '';
      if (res.upserted || res.deleted || res.files) log('replica verso il server (' + (trigger || '') + '): ' + res.upserted + ' righe, ' + res.deleted + ' eliminazioni, ' + res.files + ' file');
      return { configured: true, ok: true, ...res };
    } catch (e) {
      state.error = e.message; log('replica verso il server NON riuscita: ' + e.message);
      return { configured: true, ok: false, error: e.message };
    } finally {
      state.running = false;
      if (state.queued) schedule(1000);
    }
  }

  // dopo una modifica: invio dopo una breve attesa (più modifiche ravvicinate partono insieme)
  function schedule(ms) {
    if (!cfg().url) return;
    clearTimeout(state.timer);
    state.timer = setTimeout(() => run('dopo una modifica'), ms === undefined ? DEBOUNCE_MS : ms);
    state.timer.unref && state.timer.unref();
  }

  // orari fissi in ora italiana
  const romeNow = () => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).reduce((o, p) => (o[p.type] = p.value, o), {});
  function startScheduler() {
    if (state.sched) return;
    state.sched = setInterval(() => {
      if (!cfg().url) return;
      const n = romeNow(), hhmm = (n.hour === '24' ? '00' : n.hour) + ':' + n.minute, key = n.year + n.month + n.day + hhmm;
      if (times().some(x => x.padStart(5, '0') === hhmm) && state.schedKey !== key) { state.schedKey = key; run('orario programmato ' + hhmm); }
    }, 20000);
    state.sched.unref && state.sched.unref();
    if (cfg().url) { const t = setTimeout(() => run('avvio'), 15000); t.unref && t.unref(); }
  }

  const status = () => ({ configured: !!cfg().url, url: cfg().url, running: state.running, lastAt: state.lastAt, lastTrigger: state.lastTrigger, lastResult: state.lastResult, error: state.error, times: times(), timezone: 'Europe/Rome', debounceMs: DEBOUNCE_MS });
  return { run, schedule, startScheduler, status, pendingCount, diff };
}

module.exports = { createReplica, importDelta, TABLES };
