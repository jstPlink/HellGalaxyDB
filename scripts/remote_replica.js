// Replica a DUE VIE tra l'app locale e il server (NAS): lavori in locale come se fossi sul server.
//   LOCALE → SERVER: ogni modifica fatta in locale (dopo 8 s), a orari fissi in ora italiana (HG_REMOTE_SYNC_TIMES,
//     predefinito 08:00,13:00,19:00) e all'avvio, invia SOLO le righe cambiate (POST /api/import/delta).
//   SERVER → LOCALE: ogni 20 s l'app chiede al server se è cambiato qualcosa (GET /api/replica/rev) e, se sì, scarica
//     SOLO le righe cambiate dai colleghi (GET /api/replica/manifest + POST /api/replica/rows) e le applica in locale.
// Come si capisce cosa è cambiato: per ogni riga si usa un'impronta (hash) e si confronta con quella dell'ULTIMA
// sincronizzazione riuscita (tabella remote_state). Se una riga è cambiata solo da una parte, passa all'altra.
// Se la STESSA riga è cambiata da entrambe le parti (o cancellata da una e modificata dall'altra) è un CONFLITTO:
// non viene sovrascritta, resta com'è su entrambi i lati e compare in Impostazioni → "Sincronizzazione con il server",
// dove scegli "Mantieni la mia" o "Prendi quella del server". Le righe che esistono da una sola parte vengono copiate.
// Texture, mesh e anteprime (data/media) seguono le righe di media_assets in entrambe le direzioni.
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
const PULL_MS = (Number(process.env.HG_REMOTE_PULL_SECONDS) || 20) * 1000;

const tableInfo = (db, t) => db.prepare('PRAGMA table_info(' + t + ')').all();
const pkOf = (db, t) => tableInfo(db, t).filter(c => c.pk > 0).sort((a, b) => a.pk - b.pk).map(c => c.name);
const exists = (db, t) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t);
const hashRow = (cols, r) => crypto.createHash('sha1').update(JSON.stringify(cols.map(c => r[c]))).digest('hex');
const keyOf = (pk, r) => JSON.stringify(pk.map(c => r[c]));

// ---------- lato SERVER: applica le righe ricevute / espone impronte e righe ----------
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

// impronta di ogni riga: { tabella: { chiave: hash } }
function manifest(db) {
  const out = {};
  for (const t of TABLES) {
    if (!exists(db, t)) continue;
    const cols = tableInfo(db, t).map(c => c.name), pk = pkOf(db, t);
    if (!pk.length) continue;
    const m = {};
    for (const r of db.prepare('SELECT * FROM ' + t).all()) m[keyOf(pk, r)] = hashRow(cols, r);
    out[t] = m;
  }
  return out;
}

function rowsByKeys(db, t, keys) {
  if (!TABLES.includes(t) || !exists(db, t)) throw new Error('tabella non consentita: ' + t);
  const pk = pkOf(db, t), st = db.prepare('SELECT * FROM ' + t + ' WHERE ' + pk.map(c => c + ' = ?').join(' AND '));
  const rows = [];
  for (const k of keys || []) { const r = st.get(...JSON.parse(k)); if (r) rows.push({ k, row: { ...r } }); }
  return rows;
}

// ---------- lato LOCALE ----------
function createReplica({ db, baseDir, log = () => {}, getUser = () => 'app locale' }) {
  db.exec('CREATE TABLE IF NOT EXISTS remote_state (t TEXT NOT NULL, k TEXT NOT NULL, h TEXT NOT NULL, PRIMARY KEY (t, k))');
  db.exec('CREATE TABLE IF NOT EXISTS replica_conflicts (t TEXT NOT NULL, k TEXT NOT NULL, kind TEXT NOT NULL, local_row TEXT, server_row TEXT, server_h TEXT, at TEXT NOT NULL, PRIMARY KEY (t, k))');
  const state = { running: false, queued: false, lastAt: null, lastTrigger: '', lastResult: null, lastPullAt: null, lastPullResult: null, error: '', timer: null, schedKey: '', lastRev: null };
  const cfg = () => ({ url: (process.env.HG_REMOTE_URL || '').replace(/\/+$/, ''), token: process.env.HG_REMOTE_TOKEN || '' });
  const times = () => (process.env.HG_REMOTE_SYNC_TIMES || '08:00,13:00,19:00').split(',').map(s => s.trim()).filter(s => /^\d{1,2}:\d{2}$/.test(s));

  async function remoteRaw(path_, opts = {}) {
    const c = cfg();
    const headers = { ...(c.token ? { Authorization: 'Bearer ' + c.token } : {}), 'X-HG-User': encodeURIComponent(getUser()), ...(opts.headers || {}) };
    let r;
    try { r = await fetch(c.url + path_, { ...opts, headers, signal: AbortSignal.timeout(120000) }); }
    catch (e) { throw new Error('server non raggiungibile (' + c.url + '): ' + e.message); }
    if (r.status === 401) throw new Error('il server rifiuta il token (HG_REMOTE_TOKEN)');
    if (!r.ok) { let m = ''; try { m = (await r.clone().json()).error || ''; } catch (e) { /* non JSON */ } throw new Error('il server ha risposto ' + r.status + (m ? ': ' + m : '')); }
    return r;
  }
  const remote = async (p, o) => (await remoteRaw(p, o)).json().catch(() => ({}));

  const conflictKeys = t => new Set(db.prepare('SELECT k FROM replica_conflicts WHERE t = ?').all(t).map(r => r.k));
  const addConflict = (t, k, kind, localRow, serverRow, serverH) => db.prepare('INSERT OR REPLACE INTO replica_conflicts (t, k, kind, local_row, server_row, server_h, at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(t, k, kind, localRow ? JSON.stringify(localRow) : null, serverRow ? JSON.stringify(serverRow) : null, serverH || null, new Date().toISOString());

  // ---- LOCALE → SERVER: righe cambiate/nuove e righe eliminate dall'ultimo invio riuscito (esclusi i conflitti) ----
  function diff() {
    const out = [];
    for (const t of TABLES) {
      if (!exists(db, t)) continue;
      const cols = tableInfo(db, t).map(c => c.name), pk = pkOf(db, t);
      if (!pk.length) continue;
      const known = new Map(db.prepare('SELECT k, h FROM remote_state WHERE t = ?').all(t).map(r => [r.k, r.h])), skip = conflictKeys(t);
      const upserts = [], seen = new Set();
      for (const r of db.prepare('SELECT * FROM ' + t).all()) {
        const k = keyOf(pk, r), h = hashRow(cols, r);
        seen.add(k);
        if (!skip.has(k) && known.get(k) !== h) upserts.push({ k, h, row: { ...r } });
      }
      const deletes = [];
      for (const k of known.keys()) if (!seen.has(k) && !skip.has(k)) { const v = JSON.parse(k); deletes.push({ k, key: Object.fromEntries(pk.map((c, i) => [c, v[i]])) }); }
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

  async function push(res) {
    for (const d of diff()) {
      const saveState = db.prepare('INSERT OR REPLACE INTO remote_state (t, k, h) VALUES (?, ?, ?)');
      const dropState = db.prepare('DELETE FROM remote_state WHERE t = ? AND k = ?');
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
  }

  // ---- SERVER → LOCALE ----
  async function downloadMediaFiles(rows) {
    let files = 0;
    const get = async (rel, dir, name, auth) => {
      const file = path.join(baseDir, dir, name);
      if (fs.existsSync(file)) return;
      const r = await remoteRaw(rel); // le anteprime/texture sono pubbliche ma il token non dà fastidio
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
      files++;
    };
    for (const row of rows) {
      if (row.kind === 'texture') await get('/media/textures/' + encodeURIComponent(row.name) + '.png', 'textures', row.name + '.png');
      else if (row.kind === 'mesh') {
        await get('/api/media/mesh/' + encodeURIComponent(row.name) + '.fbx', 'meshes', row.name + '.fbx');
        if (row.preview) await get('/media/previews/' + encodeURIComponent(row.name) + '.png', 'previews', row.name + '.png');
      }
    }
    return files;
  }

  // applica righe del server in locale e registra l'impronta come "ultimo stato condiviso"
  async function applyServerRows(t, items, deletes, res) {
    const cols = tableInfo(db, t).map(c => c.name), pk = pkOf(db, t);
    const ins = db.prepare('INSERT OR REPLACE INTO ' + t + ' (' + cols.join(',') + ') VALUES (' + cols.map(() => '?').join(',') + ')');
    const del = db.prepare('DELETE FROM ' + t + ' WHERE ' + pk.map(c => c + ' = ?').join(' AND '));
    const saveState = db.prepare('INSERT OR REPLACE INTO remote_state (t, k, h) VALUES (?, ?, ?)'), dropState = db.prepare('DELETE FROM remote_state WHERE t = ? AND k = ?');
    if (t === 'media_assets') res.files += await downloadMediaFiles(items.map(i => i.row));
    db.exec('BEGIN');
    try {
      for (const i of items) { ins.run(...cols.map(c => (i.row[c] === undefined ? null : i.row[c]))); saveState.run(t, i.k, i.h); }
      for (const k of deletes) { del.run(...JSON.parse(k)); dropState.run(t, k); }
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    res.pulled += items.length; res.pulledDeleted += deletes.length;
    if (items.length || deletes.length) res.pulledTables[t] = (res.pulledTables[t] || 0) + items.length + deletes.length;
  }

  async function pull(res) {
    const man = (await remote('/api/replica/manifest')).tables || {};
    let conflicts = 0;
    for (const t of TABLES) {
      if (!exists(db, t) || !man[t]) continue;
      const cols = tableInfo(db, t).map(c => c.name), pk = pkOf(db, t);
      if (!pk.length) continue;
      const known = new Map(db.prepare('SELECT k, h FROM remote_state WHERE t = ?').all(t).map(r => [r.k, r.h]));
      const local = new Map(); for (const r of db.prepare('SELECT * FROM ' + t).all()) local.set(keyOf(pk, r), { h: hashRow(cols, r), row: r });
      const skip = conflictKeys(t), srv = man[t], fetch_ = [], toDelete = [], sameNow = [];
      for (const [k, h] of Object.entries(srv)) {
        if (skip.has(k)) continue;
        const kn = known.get(k), lc = local.get(k);
        if (kn === h) continue;                                        // il server non è cambiato dall'ultima sincronizzazione
        if (lc && lc.h === h) { sameNow.push([k, h]); continue; }       // già uguale in locale
        if (!lc) { if (kn === undefined) fetch_.push([k, h]); else { addConflict(t, k, 'eliminata in locale, cambiata sul server', null, null, h); conflicts++; } continue; }
        if (kn !== undefined && lc.h === kn) fetch_.push([k, h]);       // cambiata solo sul server
        else { addConflict(t, k, kn === undefined ? 'presente da entrambe le parti con valori diversi' : 'cambiata sia in locale sia sul server', lc.row, null, h); conflicts++; }
      }
      for (const k of known.keys()) {
        if (srv[k] !== undefined || skip.has(k)) continue;              // eliminata sul server
        const lc = local.get(k);
        if (!lc) { db.prepare('DELETE FROM remote_state WHERE t = ? AND k = ?').run(t, k); continue; }
        if (lc.h === known.get(k)) toDelete.push(k); else { addConflict(t, k, 'eliminata sul server, cambiata in locale', lc.row, null, null); conflicts++; }
      }
      if (sameNow.length) { db.exec('BEGIN'); for (const [k, h] of sameNow) db.prepare('INSERT OR REPLACE INTO remote_state (t, k, h) VALUES (?, ?, ?)').run(t, k, h); db.exec('COMMIT'); }
      // scarica a gruppi le righe cambiate sul server
      for (let i = 0; i < fetch_.length || (i === 0 && toDelete.length); i += 150) {
        const part = fetch_.slice(i, i + 150), hs = new Map(part);
        const rows = part.length ? ((await remote('/api/replica/rows', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ table: t, keys: part.map(p => p[0]) }) })).rows || []) : [];
        await applyServerRows(t, rows.map(r => ({ k: r.k, row: r.row, h: hs.get(r.k) })), i === 0 ? toDelete : [], res);
        if (!part.length) break;
      }
    }
    res.conflicts = db.prepare('SELECT COUNT(*) n FROM replica_conflicts').get().n;
    if (conflicts) log('replica: ' + conflicts + ' nuovi conflitti tra locale e server (Impostazioni → Sincronizzazione con il server)');
  }

  async function run(trigger) {
    const c = cfg();
    if (!c.url) return { configured: false };
    if (state.running) { state.queued = true; return { running: true }; }
    state.running = true; state.queued = false; state.error = '';
    const res = { upserted: 0, deleted: 0, files: 0, tables: {}, pulled: 0, pulledDeleted: 0, pulledTables: {}, conflicts: 0 };
    try {
      // prima si scaricano le modifiche dei colleghi (e si individuano i conflitti); un server più vecchio senza questa funzione si salta
      try { await pull(res); state.pullUnsupported = false; state.lastPullAt = new Date().toISOString(); state.lastPullResult = { pulled: res.pulled, pulledDeleted: res.pulledDeleted }; }
      catch (e) { if (/ha risposto 404/.test(e.message)) { state.pullUnsupported = true; log('replica: il server non supporta ancora la sincronizzazione nei due sensi (aggiornare il NAS): solo invio'); } else throw e; }
      await push(res);
      try { state.lastRev = (await remote('/api/replica/rev')).rev; } catch (e) { /* non essenziale */ }
      state.lastResult = res; state.lastAt = new Date().toISOString(); state.lastTrigger = trigger || '';
      if (res.upserted || res.deleted || res.files || res.pulled || res.pulledDeleted) log('replica con il server (' + (trigger || '') + '): inviate ' + res.upserted + ' righe, ' + res.deleted + ' eliminazioni, ' + res.files + ' file; ricevute ' + res.pulled + ' righe, ' + res.pulledDeleted + ' eliminazioni');
      return { configured: true, ok: true, ...res };
    } catch (e) {
      state.error = e.message; log('replica con il server NON riuscita: ' + e.message);
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

  // ---- conflitti ----
  const conflicts = () => db.prepare('SELECT t, k, kind, local_row, server_row, server_h, at FROM replica_conflicts ORDER BY at').all().map(r => ({ table: r.t, key: r.k, kind: r.kind, at: r.at, local: r.local_row ? JSON.parse(r.local_row) : null }));
  // choice: 'local' (la mia vince: alla prossima sincronizzazione va al server) | 'server' (prendi quella del server)
  async function resolve(t, k, choice) {
    const cf = db.prepare('SELECT * FROM replica_conflicts WHERE t = ? AND k = ?').get(t, k);
    if (!cf) throw new Error('conflitto non trovato');
    const pk = pkOf(db, t);
    if (choice === 'local') {
      // l'impronta del server diventa lo "stato condiviso": la riga locale risulta cambiata e verrà inviata (o, se non c'è più, eliminata sul server)
      if (cf.server_h) db.prepare('INSERT OR REPLACE INTO remote_state (t, k, h) VALUES (?, ?, ?)').run(t, k, cf.server_h);
      else db.prepare('DELETE FROM remote_state WHERE t = ? AND k = ?').run(t, k);
    } else if (choice === 'server') {
      const man = (await remote('/api/replica/manifest')).tables || {};
      const h = man[t] && man[t][k];
      if (h === undefined) { const del = db.prepare('DELETE FROM ' + t + ' WHERE ' + pk.map(c => c + ' = ?').join(' AND ')); del.run(...JSON.parse(k)); db.prepare('DELETE FROM remote_state WHERE t = ? AND k = ?').run(t, k); }
      else {
        const rows = (await remote('/api/replica/rows', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ table: t, keys: [k] }) })).rows || [];
        await applyServerRows(t, rows.map(r => ({ k: r.k, row: r.row, h })), [], { files: 0, pulled: 0, pulledDeleted: 0, pulledTables: {} });
      }
    } else throw new Error('scelta non valida');
    db.prepare('DELETE FROM replica_conflicts WHERE t = ? AND k = ?').run(t, k);
    if (choice === 'local') schedule(500);
    return { ok: true };
  }

  // ---- controllo periodico: c'è qualcosa di nuovo sul server? ----
  async function pollServer() {
    if (!cfg().url || state.running) return;
    try {
      if (state.pullUnsupported) return;
      const { rev } = await remote('/api/replica/rev');
      if (state.lastRev === null || rev !== state.lastRev) await run('modifiche sul server');
    } catch (e) { state.error = e.message; }
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
    state.poll = setInterval(pollServer, PULL_MS); state.poll.unref && state.poll.unref();
    if (cfg().url) { const t = setTimeout(() => run('avvio'), 15000); t.unref && t.unref(); }
  }

  const status = () => ({ configured: !!cfg().url, url: cfg().url, running: state.running, lastAt: state.lastAt, lastTrigger: state.lastTrigger, lastResult: state.lastResult, lastPullAt: state.lastPullAt, lastPullResult: state.lastPullResult, error: state.error, times: times(), timezone: 'Europe/Rome', debounceMs: DEBOUNCE_MS, pullSeconds: PULL_MS / 1000, conflicts: db.prepare('SELECT COUNT(*) n FROM replica_conflicts').get().n, pullUnsupported: !!state.pullUnsupported });
  return { run, schedule, startScheduler, status, pendingCount, diff, conflicts, resolve };
}

module.exports = { createReplica, importDelta, manifest, rowsByKeys, TABLES };
