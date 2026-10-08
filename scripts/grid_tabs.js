// Tab del foglio "HS - Localization Master" (Identities, Entities, Quest, EventsAudio):
// COPIA FEDELE riga per riga, importata dall'export diretto di ciascun tab. Sola lettura, tranne la colonna ENGLISH
// del tab Entities, collegata a Label/BriefDescription di ENTITIES (modifica in un punto = modifica anche nell'altro).
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

module.exports = function createGridHandler({ db, sendJson, readJsonBody, SheetError, fs, onEntityText }) {
  db.exec(`CREATE TABLE IF NOT EXISTS grid_tabs (
    tab TEXT PRIMARY KEY, headers_json TEXT NOT NULL, row_count INTEGER NOT NULL, imported_at TEXT NOT NULL)`);
  db.exec(`CREATE TABLE IF NOT EXISTS grid_rows (
    tab TEXT NOT NULL, row_no INTEGER NOT NULL, cells_json TEXT NOT NULL, PRIMARY KEY (tab, row_no))`);
  // Modifiche locali alle celle (oggi solo Entities > ENGLISH, collegata a Label/BriefDescription di ENTITIES).
  // Si conserva il valore del foglio ("original") per il badge "modificato" e per i pull successivi.
  db.exec(`CREATE TABLE IF NOT EXISTS grid_edits (
    tab TEXT NOT NULL, row_no INTEGER NOT NULL, col INTEGER NOT NULL, original TEXT NOT NULL, PRIMARY KEY (tab, row_no, col))`);
  const q = {
    edits: db.prepare('SELECT row_no, col, original FROM grid_edits WHERE tab = ?'),
    getEdit: db.prepare('SELECT original FROM grid_edits WHERE tab = ? AND row_no = ? AND col = ?'),
    putEdit: db.prepare('INSERT OR IGNORE INTO grid_edits (tab, row_no, col, original) VALUES (?, ?, ?, ?)'),
    delEdit: db.prepare('DELETE FROM grid_edits WHERE tab = ? AND row_no = ? AND col = ?'),
    setOriginal: db.prepare('UPDATE grid_edits SET original = ? WHERE tab = ? AND row_no = ? AND col = ?'),
    getRow: db.prepare('SELECT cells_json FROM grid_rows WHERE tab = ? AND row_no = ?'),
    setRow: db.prepare('UPDATE grid_rows SET cells_json = ? WHERE tab = ? AND row_no = ?'),
    meta: db.prepare('SELECT * FROM grid_tabs WHERE tab = ?'),
    rows: db.prepare('SELECT row_no, cells_json FROM grid_rows WHERE tab = ? ORDER BY row_no'),
    clearRows: db.prepare('DELETE FROM grid_rows WHERE tab = ?'),
    insertRow: db.prepare('INSERT INTO grid_rows (tab, row_no, cells_json) VALUES (?, ?, ?)'),
    upsertMeta: db.prepare('INSERT INTO grid_tabs (tab, headers_json, row_count, imported_at) VALUES (?, ?, ?, ?) ON CONFLICT(tab) DO UPDATE SET headers_json=excluded.headers_json, row_count=excluded.row_count, imported_at=excluded.imported_at'),
  };

  function getGrid(tab) {
    const meta = q.meta.get(tab);
    if (!meta) return { headers: [], rows: [], count: 0, importedAt: null, edits: [] };
    return { headers: JSON.parse(meta.headers_json), rows: q.rows.all(tab).map(r => JSON.parse(r.cells_json)), count: meta.row_count, importedAt: meta.imported_at,
      edits: q.edits.all(tab).map(e => ({ row: e.row_no, col: e.col, original: e.original })) };
  }

  // Colonna ENGLISH del tab Entities (testo di Label/BriefDescription).
  function englishCol(tab) {
    const meta = q.meta.get(tab); if (!meta) return -1;
    return JSON.parse(meta.headers_json).indexOf('ENGLISH');
  }
  // Modifica una cella (conserva l'originale del foglio; se il nuovo valore torna uguale, la modifica sparisce).
  function setCell(tab, rowNo, col, value) {
    const row = q.getRow.get(tab, rowNo); if (!row) return false;
    const cells = JSON.parse(row.cells_json);
    if (col < 0 || col >= cells.length) return false;
    value = String(value ?? '');
    if (!q.getEdit.get(tab, rowNo, col)) q.putEdit.run(tab, rowNo, col, cells[col]);
    const orig = q.getEdit.get(tab, rowNo, col).original;
    cells[col] = value;
    q.setRow.run(JSON.stringify(cells), tab, rowNo);
    if (value === orig) q.delEdit.run(tab, rowNo, col);
    return true;
  }
  // Riga del tab con una certa chiave (colonna KEY = prima colonna); ritorna { rowNo, cells } o null.
  function findByKey(tab, key) {
    if (!key) return null;
    for (const r of q.rows.all(tab)) { const c = JSON.parse(r.cells_json); if (c[0] === key) return { rowNo: r.row_no, cells: c }; }
    return null;
  }
  function setEnglishByKey(tab, key, value) {
    const f = findByKey(tab, key), col = englishCol(tab);
    if (!f || col < 0) return false;
    return setCell(tab, f.rowNo, col, value);
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
    const edits = cur.edits || [];
    // confronto per posizione di riga (copia fedele: nessuna modifica locale possibile)
    let changed = 0;
    const n = Math.max(g.rows.length, cur.rows.length);
    for (let i = 0; i < n; i++) if (JSON.stringify(g.rows[i] || null) !== JSON.stringify(cur.rows[i] || null)) changed++;
    const report = {
      tab: cfg.sheetName, sheetRows: g.rows.length, appRows: cur.rows.length, columns: g.headers.length,
      added: Math.max(0, g.rows.length - cur.rows.length), removed: Math.max(0, cur.rows.length - g.rows.length),
      changedRows: Math.min(changed, n), headersChanged: JSON.stringify(g.headers) !== JSON.stringify(cur.headers) && cur.count > 0,
      keptEdits: edits.length, editConflicts: edits.filter(e => { const r = g.rows[e.row - 2]; return r && r[e.col] !== e.original; }).length,
      identical: changed === 0 && JSON.stringify(g.headers) === JSON.stringify(cur.headers), applied: false,
    };
    if (!apply) return report;
    db.exec('BEGIN');
    try {
      q.clearRows.run(cfg.key);
      g.rows.forEach((r, i) => q.insertRow.run(cfg.key, i + 2, JSON.stringify(r))); // numero di riga come nel foglio
      q.upsertMeta.run(cfg.key, JSON.stringify(g.headers), g.rows.length, new Date().toISOString());
      // le modifiche fatte nell'app restano; il valore del foglio diventa il nuovo "originale"
      for (const e of edits) {
        const r = g.rows[e.row - 2];
        if (!r) { q.delEdit.run(cfg.key, e.row, e.col); continue; }
        const local = cur.rows[e.row - 2] ? cur.rows[e.row - 2][e.col] : r[e.col];
        q.setOriginal.run(r[e.col], cfg.key, e.row, e.col);
        const cells = r.slice(); cells[e.col] = local;
        q.setRow.run(JSON.stringify(cells), cfg.key, e.row);
        if (local === r[e.col]) q.delEdit.run(cfg.key, e.row, e.col);
      }
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    report.applied = true;
    return report;
  }

  async function handle(req, res, urlPath, query) {
    let m;
    const names = Object.keys(GRID_TABS).join('|');
    if ((m = urlPath.match(new RegExp('^/api/grid/(' + names + ')$'))) && req.method === 'GET') { sendJson(res, 200, getGrid(m[1])); return true; }
    // Modifica del testo inglese di una riga di Entities: aggiorna anche Label/BriefDescription in ENTITIES.
    if ((m = urlPath.match(/^\/api\/grid\/entities\/(\d+)$/)) && req.method === 'PUT') {
      const body = await readJsonBody(req), rowNo = Number(m[1]), col = englishCol('entities');
      const row = q.getRow.get('entities', rowNo);
      if (!row || col < 0) { sendJson(res, 404, { error: 'riga non trovata' }); return true; }
      setCell('entities', rowNo, col, body.value);
      if (onEntityText) onEntityText(JSON.parse(row.cells_json)[0], String(body.value ?? ''));
      sendJson(res, 200, getGrid('entities'));
      return true;
    }
    if ((m = urlPath.match(new RegExp('^/api/sync/pull/grid/(' + names + ')$'))) && req.method === 'POST') {
      const body = await readJsonBody(req);
      sendJson(res, 200, await pull(GRID_TABS[m[1]], { apply: query.get('apply') === '1', csv: typeof body.csv === 'string' ? body.csv : '' }));
      return true;
    }
    return false;
  }
  handle.setEnglishByKey = setEnglishByKey;
  return handle;
};
module.exports.parseGrid = parseGrid;
module.exports.GRID_TABS = GRID_TABS;
