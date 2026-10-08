// Passo 4 di "Aggiorna il progetto": invio dei dati dall'app locale al server (NAS) con token.
// Non tocca Unreal. Il pacchetto contiene solo le tabelle dei fogli (ENTITIES, Modules, Cargo, Items, Localization, Events)
// e i dati letti da Unreal già salvati nel DB; NON contiene utenti né le vecchie pagine DATABASE (ferme).
// Config locale: HG_REMOTE_URL (es. http://nas:8936) e HG_REMOTE_TOKEN (= HG_API_TOKEN del server; mai nel repository).
'use strict';

const TABLES = ['entities', 'entities_ue', 'modules_sheet', 'modules_sections', 'modules_ue', 'sheet_rows', 'sheet_sections', 'sheet_ue',
  'grid_tabs', 'grid_rows', 'grid_edits', 'entity_links'];

function exportBundle(db) {
  const tables = {};
  for (const t of TABLES) tables[t] = db.prepare('SELECT * FROM ' + t).all().map(r => ({ ...r }));
  return { version: 1, at: new Date().toISOString(), tables };
}

function counts(bundle) {
  const c = {};
  for (const t of TABLES) c[t] = ((bundle.tables || {})[t] || []).length;
  return c;
}

// Sostituisce le tabelle del pacchetto (tutto o niente). Le tabelle assenti dal pacchetto restano invariate.
function importBundle(db, bundle) {
  if (!bundle || typeof bundle !== 'object' || !bundle.tables || typeof bundle.tables !== 'object') throw new Error('pacchetto non valido');
  const done = {};
  db.exec('BEGIN');
  try {
    for (const t of TABLES) {
      const rows = bundle.tables[t];
      if (rows === undefined) continue;
      if (!Array.isArray(rows)) throw new Error('tabella ' + t + ' non valida');
      const cols = db.prepare('PRAGMA table_info(' + t + ')').all().map(c => c.name);
      db.exec('DELETE FROM ' + t);
      const ins = db.prepare('INSERT INTO ' + t + ' (' + cols.join(',') + ') VALUES (' + cols.map(() => '?').join(',') + ')');
      for (const r of rows) ins.run(...cols.map(c => (r[c] === undefined ? null : r[c])));
      done[t] = rows.length;
    }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return done;
}

function remoteConfig() {
  const url = (process.env.HG_REMOTE_URL || '').replace(/\/+$/, '');
  return { url, token: process.env.HG_REMOTE_TOKEN || '' };
}

async function remoteFetch(cfg, path, opts) {
  const headers = { 'Content-Type': 'application/json', ...(cfg.token ? { Authorization: 'Bearer ' + cfg.token } : {}), 'X-HG-User': encodeURIComponent('app locale') };
  let r;
  try { r = await fetch(cfg.url + path, { ...opts, headers, signal: AbortSignal.timeout(60000) }); }
  catch (e) { throw new Error('server remoto non raggiungibile (' + cfg.url + '): ' + e.message); }
  let json = null; try { json = await r.json(); } catch (e) { /* risposta non JSON */ }
  if (r.status === 401) throw new Error('il server remoto rifiuta il token (HG_REMOTE_TOKEN)');
  if (!r.ok) throw new Error('il server remoto ha risposto ' + r.status + (json && json.error ? ': ' + json.error : ''));
  return json;
}

// dry: solo controllo del collegamento e confronto dei conteggi; apply: invia il pacchetto.
async function pushToRemote(db, { apply }) {
  const cfg = remoteConfig();
  if (!cfg.url) return { configured: false };
  const health = await remoteFetch(cfg, '/api/health', {});
  const bundle = exportBundle(db);
  const local = counts(bundle);
  if (!apply) return { configured: true, applied: false, remote: cfg.url, remoteVersion: health && health.version, local };
  const r = await remoteFetch(cfg, '/api/import/bundle', { method: 'POST', body: JSON.stringify(bundle) });
  return { configured: true, applied: true, remote: cfg.url, sent: local, received: r && r.imported };
}

module.exports = { TABLES, exportBundle, importBundle, counts, pushToRemote, remoteConfig };
