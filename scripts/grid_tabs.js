// Tab del foglio "HS - Localization Master" (Identities, Entities, Quest, EventsAudio):
// COPIA FEDELE e di sola lettura, riga per riga, importata dall'export diretto di ciascun tab.
// Nessuna modifica nell'app finché il foglio resta il master (come per le altre sezioni, modalità M1).
// Rotte: GET /api/grid/:tab · POST /api/sync/pull/grid/:tab[?apply=1] (corpo opzionale {csv}).
'use strict';
const { parseCsv, cellToString } = require('./sheet_mappings');

const GRID_TABS = {
  identities: { key: 'identities', sheetName: 'Identities', keyEnv: 'HG_LOC_SHEET_KEY', gidEnv: 'HG_LOC_GID_IDENTITIES', mockEnv: 'HG_LOC_MOCK_IDENTITIES' },
  entities: { key: 'entities', sheetName: 'Entities', keyEnv: 'HG_LOC_SHEET_KEY', gidEnv: 'HG_LOC_GID_ENTITIES', mockEnv: 'HG_LOC_MOCK_ENTITIES' },
  quest: { key: 'quest', sheetName: 'Quest', keyEnv: 'HG_LOC_SHEET_KEY', gidEnv: 'HG_LOC_GID_QUEST', mockEnv: 'HG_LOC_MOCK_QUEST' },
  eventsaudio: { key: 'eventsaudio', sheetName: 'EventsAudio', keyEnv: 'HG_LOC_SHEET_KEY', gidEnv: 'HG_LOC_GID_EVENTSAUDIO', mockEnv: 'HG_LOC_MOCK_EVENTSAUDIO' },
  // Foglio "HS - Events": solo MainEvents ed EventTexts sono utili (alimentano le DataTable di Unreal).
  mainevents: { key: 'mainevents', sheetName: 'MainEvents', keyEnv: 'HG_EVT_SHEET_KEY', gidEnv: 'HG_EVT_GID_MAINEVENTS', mockEnv: 'HG_EVT_MOCK_MAINEVENTS' },
  eventtexts: { key: 'eventtexts', sheetName: 'EventTexts', keyEnv: 'HG_EVT_SHEET_KEY', gidEnv: 'HG_EVT_GID_EVENTTEXTS', mockEnv: 'HG_EVT_MOCK_EVENTTEXTS' },
};

// CSV -> { headers, rows } con celle normalizzate; colonne finali vuote e righe finali vuote tagliate.
function parseGrid(text) {
  let rows = parseCsv(text).map(r => r.map(cellToString));
  while (rows.length && rows[rows.length - 1].every(c => c === '')) rows.pop();
  let width = 0;
  rows.forEach(r => { for (let i = r.length - 1; i >= 0; i--) if (r[i] !== '') { width = Math.max(width, i + 1); break; } });
  rows = rows.map(r => { const o = r.slice(0, width); while (o.length < width) o.push(''); return o; });
  const headers = rows.length ? rows[0] : [];
  return { headers, rows: rows.slice(1) };
}

module.exports = function createGridHandler({ db, sendJson, readJsonBody, SheetError, fs }) {
  db.exec(`CREATE TABLE IF NOT EXISTS grid_tabs (
    tab TEXT PRIMARY KEY, headers_json TEXT NOT NULL, row_count INTEGER NOT NULL, imported_at TEXT NOT NULL)`);
  db.exec(`CREATE TABLE IF NOT EXISTS grid_rows (
    tab TEXT NOT NULL, row_no INTEGER NOT NULL, cells_json TEXT NOT NULL, PRIMARY KEY (tab, row_no))`);
  const q = {
    meta: db.prepare('SELECT * FROM grid_tabs WHERE tab = ?'),
    rows: db.prepare('SELECT row_no, cells_json FROM grid_rows WHERE tab = ? ORDER BY row_no'),
    clearRows: db.prepare('DELETE FROM grid_rows WHERE tab = ?'),
    insertRow: db.prepare('INSERT INTO grid_rows (tab, row_no, cells_json) VALUES (?, ?, ?)'),
    upsertMeta: db.prepare('INSERT INTO grid_tabs (tab, headers_json, row_count, imported_at) VALUES (?, ?, ?, ?) ON CONFLICT(tab) DO UPDATE SET headers_json=excluded.headers_json, row_count=excluded.row_count, imported_at=excluded.imported_at'),
  };

  function getGrid(tab) {
    const meta = q.meta.get(tab);
    if (!meta) return { headers: [], rows: [], count: 0, importedAt: null };
    return { headers: JSON.parse(meta.headers_json), rows: q.rows.all(tab).map(r => JSON.parse(r.cells_json)), count: meta.row_count, importedAt: meta.imported_at };
  }

  // Export diretto del tab (come per Modules/Cargo/Items).
  async function fetchGrid(cfg, csvText) {
    let text;
    if (csvText) text = csvText;
    else if (process.env[cfg.mockEnv]) text = fs.readFileSync(process.env[cfg.mockEnv], 'utf8');
    else {
      const key = process.env[cfg.keyEnv], gid = process.env[cfg.gidEnv];
      if (!key || !gid) throw new SheetError(`Lettura del tab ${cfg.sheetName} non configurata: imposta ${cfg.keyEnv} e ${cfg.gidEnv} sul server, oppure usa "Importa CSV" con l'export del tab.`, 503);
      try {
        const r = await fetch(`https://docs.google.com/spreadsheets/d/${key}/export?format=csv&gid=${gid}`, { redirect: 'follow' });
        if (!r.ok) throw new Error('HTTP ' + r.status + ' (il foglio deve essere visibile a chiunque abbia il link)');
        text = await r.text();
      } catch (e) { throw new SheetError(`Impossibile scaricare il tab ${cfg.sheetName}: ` + e.message, 502); }
    }
    const g = parseGrid(text);
    if (!g.headers.length) throw new SheetError(`Il tab ${cfg.sheetName} risulta vuoto.`, 502);
    return g;
  }

  async function pull(cfg, { apply, csv }) {
    const g = await fetchGrid(cfg, csv);
    const cur = getGrid(cfg.key);
    // confronto per posizione di riga (copia fedele: nessuna modifica locale possibile)
    let changed = 0;
    const n = Math.max(g.rows.length, cur.rows.length);
    for (let i = 0; i < n; i++) if (JSON.stringify(g.rows[i] || null) !== JSON.stringify(cur.rows[i] || null)) changed++;
    const report = {
      tab: cfg.sheetName, sheetRows: g.rows.length, appRows: cur.rows.length, columns: g.headers.length,
      added: Math.max(0, g.rows.length - cur.rows.length), removed: Math.max(0, cur.rows.length - g.rows.length),
      changedRows: Math.min(changed, n), headersChanged: JSON.stringify(g.headers) !== JSON.stringify(cur.headers) && cur.count > 0,
      identical: changed === 0 && JSON.stringify(g.headers) === JSON.stringify(cur.headers), applied: false,
    };
    if (!apply) return report;
    db.exec('BEGIN');
    try {
      q.clearRows.run(cfg.key);
      g.rows.forEach((r, i) => q.insertRow.run(cfg.key, i + 2, JSON.stringify(r))); // numero di riga come nel foglio
      q.upsertMeta.run(cfg.key, JSON.stringify(g.headers), g.rows.length, new Date().toISOString());
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    report.applied = true;
    return report;
  }

  return async function handle(req, res, urlPath, query) {
    let m;
    const names = Object.keys(GRID_TABS).join('|');
    if ((m = urlPath.match(new RegExp('^/api/grid/(' + names + ')$'))) && req.method === 'GET') { sendJson(res, 200, getGrid(m[1])); return true; }
    if ((m = urlPath.match(new RegExp('^/api/sync/pull/grid/(' + names + ')$'))) && req.method === 'POST') {
      const body = await readJsonBody(req);
      sendJson(res, 200, await pull(GRID_TABS[m[1]], { apply: query.get('apply') === '1', csv: typeof body.csv === 'string' ? body.csv : '' }));
      return true;
    }
    return false;
  };
};
module.exports.parseGrid = parseGrid;
module.exports.GRID_TABS = GRID_TABS;
