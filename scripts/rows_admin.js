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

const RARITIES = ['Salvage', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];

module.exports = function createRowsAdmin({ db, sendJson, readJsonBody, sheet, msheet, addLocRows }) {
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

  // Rinomina l'ID di una riga in TUTTE le tabelle dell'app (ENTITIES, MODULES, CARGO/LOOT, ITEMS, dati letti da Unreal, collegamenti, media).
  // Non tocca Unreal: gli asset con il vecchio nome restano com'erano (con la scrittura verrebbero creati quelli col nuovo nome).
  function renameId(from, to) {
    const fix = (json) => { try { const o = JSON.parse(json); if (o && typeof o === 'object' && o['(ID)'] === from) o['(ID)'] = to; return JSON.stringify(o); } catch (e) { return json; } };
    const jsonTables = [['entities', ''], ['modules_sheet', ''], ['sheet_rows', '']];
    for (const [t] of jsonTables) {
      for (const r of db.prepare('SELECT id, current_json, original_json FROM ' + t + ' WHERE id = ?').all(from)) {
        db.prepare('UPDATE ' + t + ' SET id = ?, current_json = ?, original_json = ? WHERE id = ?').run(to, fix(r.current_json), fix(r.original_json), from);
      }
    }
    for (const [t, col] of [['entities_ue', 'id'], ['modules_ue', 'id'], ['sheet_ue', 'id'], ['entity_links', 'id'], ['media_links', 'owner'], ['custom_links', 'owner'], ['media_hidden', 'owner'], ['app_rows', 'id'], ['deleted_rows', 'id']]) {
      try { db.prepare('UPDATE ' + t + ' SET ' + col + ' = ? WHERE ' + col + ' = ?').run(to, from); } catch (e) { /* tabella assente */ }
    }
    // le immagini/mesh dell'utente sono salvate con il nome dell'ID: aggiornare il nome registrato non basta, quindi si lasciano i file e si rimappa il nome
    try { db.prepare("UPDATE custom_links SET name = name WHERE owner = ?").run(to); } catch (e) { /* ignora */ }
  }
  function changeSection(id, section) {
    const row = db.prepare('SELECT id, current_json, original_json FROM modules_sheet WHERE id = ?').get(id);
    if (!row) return { status: 404, error: 'modulo non trovato' };
    const headers = sectionHeaders('modules', section);
    if (!headers) return { status: 400, error: 'sezione non valida: ' + sections('modules').join(', ') };
    const cur = JSON.parse(row.current_json), old = cur[msheet.SECTION_KEY];
    if (old === section) return { status: 200, ok: true, unchanged: true };
    const next = { [msheet.ID_KEY]: id, [msheet.SECTION_KEY]: section };
    for (const h of headers) if (h && h !== msheet.ID_KEY) next[h] = cur[h] !== undefined ? cur[h] : '';
    // le colonne della vecchia sezione con un valore non vengono perse
    for (const k of Object.keys(cur)) if (!(k in next) && String(cur[k] || '') !== '') next[k] = cur[k];
    db.prepare('UPDATE modules_sheet SET section = ?, current_json = ?, updated_at = ? WHERE id = ?').run(section, JSON.stringify(next), new Date().toISOString(), id);
    // anche il ModuleType dell'entità segue il nuovo tipo
    const e = db.prepare('SELECT current_json FROM entities WHERE id = ?').get(id);
    if (e) { const ej = JSON.parse(e.current_json); ej.ModuleType = section; db.prepare('UPDATE entities SET current_json = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(ej), new Date().toISOString(), id); }
    return { status: 200, ok: true, from: old, to: section };
  }

  // Dopo un pull dal foglio: le righe eliminate nell'app restano eliminate.
  function purgeTombstones() {
    for (const t of db.prepare('SELECT area, id FROM deleted_rows WHERE from_sheet = 1').all()) if (getRow(t.area, t.id)) deleteRow(t.area, t.id);
  }

  async function handle(req, res, urlPath) {
    let m;
    if (urlPath === '/api/rows/deleted' && req.method === 'GET') {
      return sendJson(res, 200, { items: db.prepare('SELECT area, id, deleted_at, user, section FROM deleted_rows ORDER BY deleted_at DESC').all().map(r => ({ ...r, label: (AREAS[r.area] || {}).label || r.area })) }), true;
    }
    // Flusso completo di creazione di un modulo: entità (ENTITIES), riga in MODULES, riga in Cargo/Loot con i valori tipici
    // dei moduli e i due testi (nome e descrizione) del Localization Master. Nessuna scrittura su Unreal.
    if (urlPath === '/api/rows/new-module' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const id = String(body.id || '').trim(), name = String(body.name || '').trim(), section = String(body.section || '').trim();
      const rarity = String(body.rarity || 'Salvage').trim(), price = String(body.price === undefined || body.price === '' ? '0' : body.price).trim();
      const producer = String(body.producer || '').trim(), desc = String(body.description || '').trim();
      if (!ID_RE.test(id)) return sendJson(res, 400, { error: 'ID non valido: solo lettere, numeri, "-", "_" e "." (massimo 100 caratteri).' }), true;
      if (['entities', 'modules', 'cargo', 'items'].some(a => existsCI(a, id))) return sendJson(res, 409, { error: 'esiste già una riga con questo ID' }), true;
      const headers = sectionHeaders('modules', section);
      if (!headers) return sendJson(res, 400, { error: 'scegli un tipo di modulo valido: ' + sections('modules').join(', ') }), true;
      if (!RARITIES.includes(rarity)) return sendJson(res, 400, { error: 'rarità non valida: ' + RARITIES.join(', ') }), true;
      if (!/^-?\d+(\.\d+)?$/.test(price)) return sendJson(res, 400, { error: 'il prezzo deve essere un numero' }), true;
      const now = new Date().toISOString(), user = userOf(req);
      const ent = {}; for (const col of sheet.ENTITY_COLUMNS) ent[col] = '';
      Object.assign(ent, { '(ID)': id, Label: name, BriefDescription: desc, EntityType: 'Module', BasePrice: price, BaseRarity: rarity, ModuleType: section, ProducerIcon: producer, LabelKey: id + '-Name', DescriptionKey: id + '-Description', extra: {} });
      const mod = { [msheet.ID_KEY]: id, [msheet.SECTION_KEY]: section };
      for (const h of headers) if (h && h !== msheet.ID_KEY) mod[h] = '';
      if ('Rarity' in mod) mod.Rarity = rarity; if ('Price' in mod) mod.Price = price; if ('ModuleType' in mod) mod.ModuleType = section;
      // parametri propri del tipo di modulo (es. velocità del motore, danni dell'arma): solo colonne che esistono nella sezione
      const extra = body.fields && typeof body.fields === 'object' ? body.fields : {};
      for (const [k, v] of Object.entries(extra)) if (k in mod && k !== msheet.ID_KEY && k !== msheet.SECTION_KEY && String(v).trim() !== '') mod[k] = String(v).trim().slice(0, 200);
      const cargoSecs = sections('cargo'), cargoSec = cargoSecs[0] || 'CargoItemsAndLoots', cargoHeaders = sectionHeaders('cargo', cargoSec) || [];
      const cargo = { [msheet.ID_KEY]: id, [msheet.SECTION_KEY]: cargoSec };
      for (const h of cargoHeaders) if (h && h !== msheet.ID_KEY) cargo[h] = '';
      Object.assign(cargo, { StackValue: '16', Attractable: 'FALSE', ForceToInspect: 'TRUE' }); // valori di 94 moduli su ~130
      db.exec('BEGIN');
      try {
        insertRow('entities', id, '', 0, ent, JSON.parse(JSON.stringify(ent)), now);
        insertRow('modules', id, section, maxOrd('modules') + 1, mod, JSON.parse(JSON.stringify(mod)), now);
        insertRow('cargo', id, cargoSec, maxOrd('cargo') + 1, cargo, JSON.parse(JSON.stringify(cargo)), now);
        for (const a of ['entities', 'modules', 'cargo']) { db.prepare('DELETE FROM deleted_rows WHERE area = ? AND id = ?').run(a, id); db.prepare('INSERT OR REPLACE INTO app_rows (area, id, created_at, user) VALUES (?, ?, ?, ?)').run(a, id, now, user); }
        if (addLocRows) addLocRows([[id + '-Name', '', name], [id + '-Description', '', desc]]);
        db.exec('COMMIT');
      } catch (e) { db.exec('ROLLBACK'); throw e; }
      return sendJson(res, 200, { ok: true, id, created: ['ENTITIES', 'MODULES', 'CARGO/LOOT', 'Localization Master › Entities'] }), true;
    }
    if (urlPath === '/api/rows/rename' && req.method === 'POST') {
      const body = await readJsonBody(req), from = String(body.from || '').trim(), to = String(body.to || '').trim();
      if (!ID_RE.test(to)) return sendJson(res, 400, { error: 'ID non valido: solo lettere, numeri, "-", "_" e "." (massimo 100 caratteri).' }), true;
      if (from === to) return sendJson(res, 200, { ok: true, unchanged: true }), true;
      const inAny = id => ['entities', 'modules', 'cargo', 'items'].some(a => getRow(a, id) || existsCI(a, id));
      if (!inAny(from)) return sendJson(res, 404, { error: 'riga non trovata' }), true;
      if (inAny(to)) return sendJson(res, 409, { error: 'esiste già una riga con questo ID' }), true;
      db.exec('BEGIN');
      try { renameId(from, to); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
      return sendJson(res, 200, { ok: true, from, to }), true;
    }
    if ((m = urlPath.match(/^\/api\/rows\/modules\/([^/]+)\/section$/)) && req.method === 'POST') {
      const body = await readJsonBody(req);
      db.exec('BEGIN');
      let r; try { r = changeSection(decodeURIComponent(m[1]), String(body.section || '')); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
      return sendJson(res, r.status, r.error ? { error: r.error } : r), true;
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
