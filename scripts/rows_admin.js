// Righe nuove ed eliminate dall'app (ENTITIES, MODULES, CARGO/LOOT, ITEMS), per poter lavorare senza tornare al foglio.
//  - POST   /api/rows/:area            { id, section? }  crea una riga vuota (con le colonne della sezione)
//  - DELETE /api/rows/:area/:id                          elimina la riga (si può ripristinare)
//  - POST   /api/rows/:area/:id/restore                  ripristina una riga eliminata
//  - GET    /api/rows/deleted                            elenco delle righe eliminate
// area: entities | modules | cargo | items.
// Una riga creata nell'app non esiste nel foglio: il pull la lascia stare (resta in "solo nell'app").
// Una riga del foglio eliminata nell'app resta eliminata anche dopo un nuovo pull ("lapide", purgeTombstones()).
// Nessuna scrittura su Unreal: gli asset collegati non vengono toccati.
'use strict';

const AREAS = {
  entities: { label: 'ENTITIES', table: 'entities', sheet: false },
  modules: { label: 'MODULES', table: 'modules_sheet', sheet: false },
  cargo: { label: 'CARGO/LOOT', table: 'sheet_rows', tab: 'cargo' },
  items: { label: 'ITEMS', table: 'sheet_rows', tab: 'items' },
};
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.\-]{0,99}$/;

module.exports = function createRowsAdmin({ db, sendJson, readJsonBody, sheet, msheet }) {
  db.exec(`CREATE TABLE IF NOT EXISTS deleted_rows (
    area TEXT NOT NULL, id TEXT NOT NULL, deleted_at TEXT NOT NULL, user TEXT, section TEXT, ord INTEGER,
    current_json TEXT NOT NULL, original_json TEXT NOT NULL, from_sheet INTEGER NOT NULL DEFAULT 1, PRIMARY KEY (area, id))`);
  db.exec(`CREATE TABLE IF NOT EXISTS app_rows (area TEXT NOT NULL, id TEXT NOT NULL, created_at TEXT NOT NULL, user TEXT, PRIMARY KEY (area, id))`);

  const getRow = (area, id) => {
    const a = AREAS[area];
    if (area === 'entities') return db.prepare('SELECT id, current_json, original_json FROM entities WHERE id = ?').get(id);
    if (area === 'modules') return db.prepare('SELECT id, section, ord, current_json, original_json FROM modules_sheet WHERE id = ?').get(id);
    return db.prepare('SELECT id, section, ord, current_json, original_json FROM sheet_rows WHERE tab = ? AND id = ?').get(a.tab, id);
  };
  const existsCI = (area, id) => {
    const a = AREAS[area];
    if (area === 'entities') return db.prepare('SELECT id FROM entities WHERE id = ? COLLATE NOCASE').get(id);
    if (area === 'modules') return db.prepare('SELECT id FROM modules_sheet WHERE id = ? COLLATE NOCASE').get(id);
    return db.prepare('SELECT id FROM sheet_rows WHERE tab = ? AND id = ? COLLATE NOCASE').get(a.tab, id);
  };
  const sectionHeaders = (area, section) => {
    const a = AREAS[area];
    const r = area === 'modules' ? db.prepare('SELECT headers_json FROM modules_sections WHERE name = ?').get(section)
      : db.prepare('SELECT headers_json FROM sheet_sections WHERE tab = ? AND name = ?').get(a.tab, section);
    return r ? JSON.parse(r.headers_json) : null;
  };
  const sections = area => {
    const a = AREAS[area];
    return (area === 'modules' ? db.prepare('SELECT name FROM modules_sections ORDER BY ord').all() : db.prepare('SELECT name FROM sheet_sections WHERE tab = ? ORDER BY ord').all(a.tab)).map(r => r.name);
  };
  const insertRow = (area, id, section, ord, current, original, now) => {
    const a = AREAS[area], cj = JSON.stringify(current), oj = JSON.stringify(original);
    if (area === 'entities') db.prepare('INSERT INTO entities (id, current_json, original_json, updated_at) VALUES (?, ?, ?, ?)').run(id, cj, oj, now);
    else if (area === 'modules') db.prepare('INSERT INTO modules_sheet (id, section, ord, current_json, original_json, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, section, ord, cj, oj, now);
    else db.prepare('INSERT INTO sheet_rows (tab, id, section, ord, current_json, original_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(a.tab, id, section, ord, cj, oj, now);
  };
  const maxOrd = area => {
    if (area === 'entities') return 0;
    const a = AREAS[area];
    return area === 'modules' ? db.prepare('SELECT COALESCE(MAX(ord), -1) AS m FROM modules_sheet').get().m
      : db.prepare('SELECT COALESCE(MAX(ord), -1) AS m FROM sheet_rows WHERE tab = ?').get(a.tab).m;
  };
  const deleteRow = (area, id) => {
    const a = AREAS[area];
    if (area === 'entities') db.prepare('DELETE FROM entities WHERE id = ?').run(id);
    else if (area === 'modules') db.prepare('DELETE FROM modules_sheet WHERE id = ?').run(id);
    else db.prepare('DELETE FROM sheet_rows WHERE tab = ? AND id = ?').run(a.tab, id);
  };
  const userOf = req => String(req.headers['x-hg-user'] ? decodeURIComponent(String(req.headers['x-hg-user'])) : 'sistema').slice(0, 60);

  // Dopo un pull dal foglio: le righe eliminate nell'app restano eliminate.
  function purgeTombstones() {
    for (const t of db.prepare('SELECT area, id FROM deleted_rows WHERE from_sheet = 1').all()) if (getRow(t.area, t.id)) deleteRow(t.area, t.id);
  }

  async function handle(req, res, urlPath) {
    let m;
    if (urlPath === '/api/rows/deleted' && req.method === 'GET') {
      return sendJson(res, 200, { items: db.prepare('SELECT area, id, deleted_at, user, section FROM deleted_rows ORDER BY deleted_at DESC').all().map(r => ({ ...r, label: (AREAS[r.area] || {}).label || r.area })) }), true;
    }
    if ((m = urlPath.match(/^\/api\/rows\/(entities|modules|cargo|items)$/)) && req.method === 'POST') {
      const area = m[1], body = await readJsonBody(req);
      const id = String(body.id || '').trim();
      if (!ID_RE.test(id)) return sendJson(res, 400, { error: 'ID non valido: solo lettere, numeri, "-", "_" e "." (massimo 100 caratteri).' }), true;
      if (existsCI(area, id)) return sendJson(res, 409, { error: 'esiste già una riga con questo ID (' + AREAS[area].label + ')' }), true;
      const now = new Date().toISOString();
      let current, section = '';
      if (area === 'entities') {
        current = {}; for (const c of sheet.ENTITY_COLUMNS) current[c] = ''; current[sheet.ENTITY_ID_COLUMN] = id; current.extra = {};
      } else {
        section = String(body.section || '').trim();
        const names = sections(area);
        if (!section && names.length === 1) section = names[0];
        const headers = section ? sectionHeaders(area, section) : null;
        if (!headers) return sendJson(res, 400, { error: 'scegli una sezione valida: ' + names.join(', ') }), true;
        current = { [msheet.ID_KEY]: id, [msheet.SECTION_KEY]: section };
        for (const h of headers) if (h && h !== msheet.ID_KEY) current[h] = '';
      }
      db.exec('BEGIN');
      try {
        insertRow(area, id, section, maxOrd(area) + 1, current, JSON.parse(JSON.stringify(current)), now);
        db.prepare('DELETE FROM deleted_rows WHERE area = ? AND id = ?').run(area, id);
        db.prepare('INSERT OR REPLACE INTO app_rows (area, id, created_at, user) VALUES (?, ?, ?, ?)').run(area, id, now, userOf(req));
        db.exec('COMMIT');
      } catch (e) { db.exec('ROLLBACK'); throw e; }
      return sendJson(res, 200, { ok: true, id, section }), true;
    }
    if ((m = urlPath.match(/^\/api\/rows\/(entities|modules|cargo|items)\/([^/]+)$/)) && req.method === 'DELETE') {
      const area = m[1], id = decodeURIComponent(m[2]), row = getRow(area, id);
      if (!row) return sendJson(res, 404, { error: 'riga non trovata' }), true;
      const appCreated = !!db.prepare('SELECT 1 FROM app_rows WHERE area = ? AND id = ?').get(area, id);
      db.exec('BEGIN');
      try {
        db.prepare('INSERT OR REPLACE INTO deleted_rows (area, id, deleted_at, user, section, ord, current_json, original_json, from_sheet) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(area, id, new Date().toISOString(), userOf(req), row.section || '', row.ord === undefined ? null : row.ord, row.current_json, row.original_json, appCreated ? 0 : 1);
        deleteRow(area, id);
        db.prepare('DELETE FROM app_rows WHERE area = ? AND id = ?').run(area, id);
        db.exec('COMMIT');
      } catch (e) { db.exec('ROLLBACK'); throw e; }
      return sendJson(res, 200, { ok: true, deleted: id }), true;
    }
    if ((m = urlPath.match(/^\/api\/rows\/(entities|modules|cargo|items)\/([^/]+)\/restore$/)) && req.method === 'POST') {
      const area = m[1], id = decodeURIComponent(m[2]);
      const t = db.prepare('SELECT * FROM deleted_rows WHERE area = ? AND id = ?').get(area, id);
      if (!t) return sendJson(res, 404, { error: 'nessuna riga eliminata con questo ID' }), true;
      if (getRow(area, id)) return sendJson(res, 409, { error: 'esiste già una riga con questo ID' }), true;
      db.exec('BEGIN');
      try {
        insertRow(area, id, t.section || '', t.ord === null || t.ord === undefined ? maxOrd(area) + 1 : t.ord, JSON.parse(t.current_json), JSON.parse(t.original_json), new Date().toISOString());
        db.prepare('DELETE FROM deleted_rows WHERE area = ? AND id = ?').run(area, id);
        if (!t.from_sheet) db.prepare('INSERT OR REPLACE INTO app_rows (area, id, created_at, user) VALUES (?, ?, ?, ?)').run(area, id, new Date().toISOString(), userOf(req));
        db.exec('COMMIT');
      } catch (e) { db.exec('ROLLBACK'); throw e; }
      return sendJson(res, 200, { ok: true, id }), true;
    }
    return false;
  }
  handle.purgeTombstones = purgeTombstones;
  handle.areas = AREAS;
  handle.restorable = (areaLabel, id) => { const k = Object.keys(AREAS).find(x => AREAS[x].label === areaLabel); return !!k && !!db.prepare('SELECT 1 FROM deleted_rows WHERE area = ? AND id = ?').get(k, id); };
  return handle;
};
