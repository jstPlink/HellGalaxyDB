// Server statico + API REST per Hell Galaxy Database.
// Nessuna dipendenza npm: usa solo i moduli integrati di Node (http, fs, path,
// node:sqlite - richiede Node 22.5+, stabile senza flag da Node 24).
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const sheet = require('./scripts/sheet_mappings');
const unreal = require('./scripts/unreal_bridge');
const unrealRead = require('./scripts/unreal_read');
const eff = require('./scripts/entity_effective');
const msheet = require('./scripts/modules_sheet');

// File .env opzionale (ignorato da git): righe NOME=valore. Le variabili già
// presenti nell'ambiente hanno la precedenza.
try {
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch (e) { /* nessun .env */ }

const ROOT = __dirname;
// HG_DB_PATH e HG_PORT servono solo ai test (database temporaneo, porta libera).
const DB_PATH = process.env.HG_DB_PATH || path.join(ROOT, 'data', 'hellgalaxy.db');
const IMAGES_DIR = path.join(ROOT, 'images');
const PORT = Number(process.env.HG_PORT) || 8936;

if (!fs.existsSync(DB_PATH)) {
  console.error(`Database non trovato: ${DB_PATH}`);
  console.error('Esegui prima: node scripts/migrate_to_db.js');
  process.exit(1);
}
const db = new DatabaseSync(DB_PATH);

function tableExists(name) {
  return !!db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(name);
}
if (!tableExists('enemies')) {
  console.error('Tabella "enemies" non trovata nel database.');
  console.error('Esegui prima: node scripts/migrate_enemies_to_db.js');
  process.exit(1);
}

// La tabella entities viene creata anche da scripts/migrate_entities_to_db.js
// (che la popola dal CSV); qui basta che esista, anche vuota.
// Tab "Modules" del foglio (tutte le sezioni, tutte le colonne) e dati letti da Unreal (SMDA_).
db.exec(`CREATE TABLE IF NOT EXISTS modules_sheet (
  id TEXT PRIMARY KEY,
  section TEXT NOT NULL,
  ord INTEGER NOT NULL,
  current_json TEXT NOT NULL,
  original_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`);
db.exec(`CREATE TABLE IF NOT EXISTS modules_sections (
  name TEXT PRIMARY KEY,
  headers_json TEXT NOT NULL,
  ord INTEGER NOT NULL
)`);
db.exec(`CREATE TABLE IF NOT EXISTS modules_ue (
  id TEXT PRIMARY KEY,
  data_json TEXT NOT NULL,
  read_at TEXT NOT NULL
)`);
// Dati letti da Unreal (EDA_), separati dai dati del foglio: reset/pull del foglio non li toccano.
db.exec(`CREATE TABLE IF NOT EXISTS entities_ue (
  id TEXT PRIMARY KEY,
  data_json TEXT NOT NULL,
  read_at TEXT NOT NULL
)`);
db.exec(`CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  current_json TEXT NOT NULL,
  original_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`);

// Autenticazione opzionale: se HG_API_TOKEN è impostato, ogni /api/* (tranne
// /api/health) richiede 'Authorization: Bearer <token>'. Se non è impostato il
// comportamento è invariato (nessuna autenticazione).
const API_TOKEN = process.env.HG_API_TOKEN || '';
// Lettura del foglio Google tramite Apps Script (mai nel repository).
const SHEET_EXEC_URL = process.env.HG_SHEET_EXEC_URL || '';
const SHEET_SECRET = process.env.HG_SHEET_SECRET || '';
const SHEET_ENTITIES_TAB = process.env.HG_SHEET_ENTITIES_TAB || 'ENTITIES';
// Solo per test: legge le entità da un CSV locale invece che dal foglio.
const SHEET_MOCK_CSV = process.env.HG_SHEET_MOCK_CSV || '';
// Alternativa ad Apps Script: URL CSV del foglio, se visibile a chiunque abbia il link
// (es. https://docs.google.com/spreadsheets/d/<KEY>/gviz/tq?tqx=out:csv&sheet=ENTITIES).
const SHEET_CSV_URL = process.env.HG_SHEET_CSV_URL || '';

const CAT_CLASS_FIELD = { body: null, engine: null, primary: 'WeaponClass', secondary: 'WeaponClass' };
const CATS_ORDER = ['body', 'engine', 'primary', 'secondary'];

function sanitizeFileName(s) { return String(s).replace(/[^A-Za-z0-9_.-]/g, '_'); }

/* ============================== DB HELPERS ============================== */
const stmts = {
  allModules: db.prepare('SELECT * FROM modules'),
  getModule: db.prepare('SELECT * FROM modules WHERE id = ?'),
  updateModule: db.prepare(`UPDATE modules SET category=?, class=?, name=?, rarity=?, price=?, producer=?, current_json=?, updated_at=? WHERE id=?`),
  resetAll: db.prepare(`UPDATE modules SET current_json = original_json, updated_at = ?`),
  allProducers: db.prepare('SELECT * FROM producers ORDER BY name'),
  upsertProducer: db.prepare(`
    INSERT INTO producers (name, image, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET image = excluded.image, updated_at = excluded.updated_at
  `),
  deleteProducer: db.prepare('DELETE FROM producers WHERE name = ?'),
  allEnemies: db.prepare('SELECT * FROM enemies'),
  getEnemy: db.prepare('SELECT * FROM enemies WHERE id = ?'),
  updateEnemy: db.prepare('UPDATE enemies SET current_json=?, updated_at=? WHERE id=?'),
  resetAllEnemies: db.prepare('UPDATE enemies SET current_json = original_json, updated_at = ?'),
  allEntities: db.prepare('SELECT * FROM entities ORDER BY rowid'),
  getEntity: db.prepare('SELECT * FROM entities WHERE id = ?'),
  insertEntity: db.prepare('INSERT INTO entities (id, current_json, original_json, updated_at) VALUES (?, ?, ?, ?)'),
  updateEntity: db.prepare('UPDATE entities SET current_json=?, updated_at=? WHERE id=?'),
  updateEntityBoth: db.prepare('UPDATE entities SET current_json=?, original_json=?, updated_at=? WHERE id=?'),
  resetAllEntities: db.prepare('UPDATE entities SET current_json = original_json, updated_at = ?'),
  allEntitiesUe: db.prepare('SELECT * FROM entities_ue'),
  clearEntitiesUe: db.prepare('DELETE FROM entities_ue'),
  insertEntityUe: db.prepare('INSERT INTO entities_ue (id, data_json, read_at) VALUES (?, ?, ?)'),
};

function rowToPayload(row) {
  return { current: JSON.parse(row.current_json), original: JSON.parse(row.original_json) };
}

function getAllData() {
  const categories = {};
  CATS_ORDER.forEach(id => { categories[id] = { items: [], originals: {} }; });
  for (const row of stmts.allModules.all()) {
    const cat = categories[row.category];
    if (!cat) continue;
    const { current, original } = rowToPayload(row);
    cat.items.push(current);
    cat.originals[row.id] = original;
  }
  const producers = {};
  for (const p of stmts.allProducers.all()) { if (p.image) producers[p.name] = p.image; }
  return { categories, producers };
}

function writeModuleImageIfNeeded(catId, id, fields) {
  if (!('Image' in fields)) return;
  const val = fields.Image;
  const relDir = path.join('images', catId);
  const absPath = path.join(ROOT, relDir, sanitizeFileName(id) + '.jpg');
  if (typeof val === 'string' && val.startsWith('data:')) {
    const base64 = val.split(',')[1] || '';
    fs.mkdirSync(path.join(ROOT, relDir), { recursive: true });
    fs.writeFileSync(absPath, Buffer.from(base64, 'base64'));
    fields.Image = '/' + relDir.replace(/\\/g, '/') + '/' + sanitizeFileName(id) + '.jpg';
  } else if (val === '') {
    try { fs.unlinkSync(absPath); } catch (e) { /* già assente */ }
  }
}

function updateModule(id, fields) {
  const row = stmts.getModule.get(id);
  if (!row) return null;
  const current = JSON.parse(row.current_json);
  writeModuleImageIfNeeded(row.category, id, fields);
  Object.assign(current, fields);
  const classField = CAT_CLASS_FIELD[row.category];
  const now = new Date().toISOString();
  stmts.updateModule.run(
    row.category,
    classField ? (current[classField] || null) : null,
    current.Name || '',
    current.Rarity || '',
    Number(current.Price) || 0,
    current.Producer || '',
    JSON.stringify(current),
    now,
    id
  );
  return rowToPayload(stmts.getModule.get(id));
}

function revertModule(id) {
  const row = stmts.getModule.get(id);
  if (!row) return null;
  const original = JSON.parse(row.original_json);
  const classField = CAT_CLASS_FIELD[row.category];
  const now = new Date().toISOString();
  stmts.updateModule.run(
    row.category,
    classField ? (original[classField] || null) : null,
    original.Name || '',
    original.Rarity || '',
    Number(original.Price) || 0,
    original.Producer || '',
    row.original_json,
    now,
    id
  );
  return rowToPayload(stmts.getModule.get(id));
}

function resetAllModules() {
  stmts.resetAll.run(new Date().toISOString());
  for (const row of stmts.allModules.all()) {
    const original = JSON.parse(row.original_json);
    const classField = CAT_CLASS_FIELD[row.category];
    stmts.updateModule.run(
      row.category,
      classField ? (original[classField] || null) : null,
      original.Name || '',
      original.Rarity || '',
      Number(original.Price) || 0,
      original.Producer || '',
      row.original_json,
      row.updated_at,
      row.id
    );
  }
}

function recomputeEnemyDerived(e) {
  e.ehp = (Number(e.integrity) || 0) + (Number(e.shield) || 0);
  e.threatIndex = Math.round(Math.sqrt(e.ehp * Math.max(Number(e.dps) || 0, 1)));
  return e;
}

function getAllEnemies() {
  const items = [], originals = {};
  for (const row of stmts.allEnemies.all()) {
    const { current, original } = rowToPayload(row);
    items.push(current);
    originals[row.id] = original;
  }
  return { items, originals };
}

function updateEnemy(id, fields) {
  const row = stmts.getEnemy.get(id);
  if (!row) return null;
  const current = JSON.parse(row.current_json);
  Object.assign(current, fields);
  recomputeEnemyDerived(current);
  const now = new Date().toISOString();
  stmts.updateEnemy.run(JSON.stringify(current), now, id);
  return rowToPayload(stmts.getEnemy.get(id));
}

function revertEnemy(id) {
  const row = stmts.getEnemy.get(id);
  if (!row) return null;
  const now = new Date().toISOString();
  stmts.updateEnemy.run(row.original_json, now, id);
  return rowToPayload(stmts.getEnemy.get(id));
}

function resetAllEnemiesFn() {
  stmts.resetAllEnemies.run(new Date().toISOString());
}

/* ============================== ENTITIES ============================== */
function getAllEntities() {
  const items = [], originals = {};
  for (const row of stmts.allEntities.all()) {
    const { current, original } = rowToPayload(row);
    items.push(current);
    originals[row.id] = original;
  }
  // Dati letti da Unreal + valore effettivo (foglio, Unreal o modifica dell'app) per i 4 campi in fallback.
  const ue = {}, effective = {};
  let readAt = null;
  for (const u of stmts.allEntitiesUe.all()) { ue[u.id] = JSON.parse(u.data_json); readAt = u.read_at; }
  for (const it of items) effective[it['(ID)']] = eff.effectiveEntity(it, originals[it['(ID)']], ue[it['(ID)']] || null);
  return { items, originals, effective, ueReadAt: readAt, ueCount: Object.keys(ue).length };
}

function updateEntity(id, fields) {
  const row = stmts.getEntity.get(id);
  if (!row) return null;
  const current = JSON.parse(row.current_json);
  // L'ID è la chiave: non modificabile; i campi sconosciuti vengono ignorati.
  for (const [k, v] of Object.entries(fields)) {
    if (k === sheet.ENTITY_ID_COLUMN || !sheet.ENTITY_COLUMNS.includes(k)) continue;
    current[k] = v === null || v === undefined ? '' : String(v);
  }
  stmts.updateEntity.run(JSON.stringify(current), new Date().toISOString(), id);
  mirrorEntityTextToLoc(current, fields);
  return rowToPayload(stmts.getEntity.get(id));
}

function revertEntity(id) {
  const row = stmts.getEntity.get(id);
  if (!row) return null;
  stmts.updateEntity.run(row.original_json, new Date().toISOString(), id);
  mirrorEntityTextToLoc(JSON.parse(row.original_json), { Label: 1, BriefDescription: 1 });
  return rowToPayload(stmts.getEntity.get(id));
}

// Collegamento ENTITIES <-> Localization Master > Entities (decisione dell'utente 2026-10-08, per ora solo per tenere
// la stessa interfaccia di Google): modificare Label/BriefDescription cambia anche la riga ENGLISH con la stessa chiave.
function mirrorEntityTextToLoc(entity, fields) {
  if (typeof gridHandler === 'undefined') return;
  if ('Label' in fields) gridHandler.setEnglishByKey('entities', entity.LabelKey, entity.Label);
  if ('BriefDescription' in fields) gridHandler.setEnglishByKey('entities', entity.DescriptionKey, entity.BriefDescription);
}
// Verso opposto: modifica del testo nel Localization Master -> Label/BriefDescription dell'entità con quella chiave.
function mirrorLocTextToEntity(key, value) {
  for (const row of stmts.allEntities.all()) {
    const cur = JSON.parse(row.current_json);
    const field = cur.LabelKey === key ? 'Label' : cur.DescriptionKey === key ? 'BriefDescription' : null;
    if (!field) continue;
    cur[field] = value;
    stmts.updateEntity.run(JSON.stringify(cur), new Date().toISOString(), row.id);
  }
}

class SheetError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function fetchSheetEntities(csvText) {
  let table;
  if (csvText) {
    table = sheet.csvToTable(csvText);
  } else if (SHEET_MOCK_CSV) {
    table = sheet.csvToTable(fs.readFileSync(SHEET_MOCK_CSV, 'utf8'));
  } else if (SHEET_CSV_URL) {
    let text;
    try {
      const r = await fetch(SHEET_CSV_URL, { redirect: 'follow' });
      if (!r.ok) throw new Error('HTTP ' + r.status + ' (il foglio deve essere visibile a chiunque abbia il link)');
      text = await r.text();
    } catch (e) {
      throw new SheetError('Impossibile scaricare il CSV del foglio: ' + e.message, 502);
    }
    table = sheet.csvToTable(text);
  } else {
    if (!SHEET_EXEC_URL || !SHEET_SECRET) {
      throw new SheetError('Lettura del foglio non configurata: imposta HG_SHEET_EXEC_URL e HG_SHEET_SECRET (o HG_SHEET_CSV_URL) sul server, oppure usa "Importa CSV".', 503);
    }
    let json;
    try {
      const r = await fetch(SHEET_EXEC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ secret: SHEET_SECRET, action: 'read', tab: SHEET_ENTITIES_TAB }),
        redirect: 'follow',
      });
      json = await r.json();
    } catch (e) {
      throw new SheetError("Risposta non valida da Apps Script (controlla l'URL e che la distribuzione sia aggiornata): " + e.message, 502);
    }
    if (!json.ok) throw new SheetError('Apps Script: ' + (json.error || 'errore sconosciuto'), 502);
    table = { headers: json.headers || [], rows: json.rows || [] };
  }
  if (!table.headers.includes(sheet.ENTITY_ID_COLUMN)) {
    throw new SheetError('Colonna "' + sheet.ENTITY_ID_COLUMN + '" non trovata nel foglio.', 502);
  }
  const rows = [], seen = new Set();
  for (const raw of table.rows) {
    const e = sheet.normalizeEntityRow(raw, table.headers);
    if (!e || seen.has(e[sheet.ENTITY_ID_COLUMN])) continue;
    seen.add(e[sheet.ENTITY_ID_COLUMN]);
    rows.push(e);
  }
  return rows;
}

// Pull dal foglio. Default dry run; apply=true scrive. Mai cancellazioni.
// Con conflitti (campi modificati sia nel tool sia nel foglio) l'apply è
// rifiutato (409) salvo skipConflicts: in quel caso il valore locale resta.
async function pullEntities({ apply, skipConflicts, csv }) {
  const sheetRows = await fetchSheetEntities(csv);
  const dbRows = stmts.allEntities.all().map(r => ({ id: r.id, ...rowToPayload(r) }));
  const { report, plan } = sheet.diffEntities(dbRows, sheetRows);
  report.applied = false;
  if (!apply) return { status: 200, report };
  if (report.conflicts.length && !skipConflicts) return { status: 409, report };
  const now = new Date().toISOString();
  db.exec('BEGIN');
  try {
    for (const s of plan.insert) {
      const j = JSON.stringify(s);
      stmts.insertEntity.run(s[sheet.ENTITY_ID_COLUMN], j, j, now);
    }
    for (const u of plan.update) {
      stmts.updateEntityBoth.run(JSON.stringify(u.current), JSON.stringify(u.original), now, u.id);
    }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  report.applied = true;
  return { status: 200, report };
}

/* ============================== MODULES (tab Modules del foglio) ============================== */
const mst = {
  all: db.prepare('SELECT * FROM modules_sheet ORDER BY ord'),
  get: db.prepare('SELECT * FROM modules_sheet WHERE id = ?'),
  insert: db.prepare('INSERT INTO modules_sheet (id, section, ord, current_json, original_json, updated_at) VALUES (?, ?, ?, ?, ?, ?)'),
  updateCur: db.prepare('UPDATE modules_sheet SET current_json=?, updated_at=? WHERE id=?'),
  updateBoth: db.prepare('UPDATE modules_sheet SET section=?, current_json=?, original_json=?, updated_at=? WHERE id=?'),
  resetAll: db.prepare('UPDATE modules_sheet SET current_json = original_json, updated_at = ?'),
  maxOrd: db.prepare('SELECT COALESCE(MAX(ord), -1) AS m FROM modules_sheet'),
  sections: db.prepare('SELECT * FROM modules_sections ORDER BY ord'),
  clearSections: db.prepare('DELETE FROM modules_sections'),
  insertSection: db.prepare('INSERT INTO modules_sections (name, headers_json, ord) VALUES (?, ?, ?)'),
  ueAll: db.prepare('SELECT * FROM modules_ue'),
  ueClear: db.prepare('DELETE FROM modules_ue'),
  ueInsert: db.prepare('INSERT INTO modules_ue (id, data_json, read_at) VALUES (?, ?, ?)'),
};

// SMDA_ da usare per un modulo: se lo stesso ID esiste in più cartelle, quello nella cartella della sezione del foglio.
function pickSmda(items, rows) {
  const secById = new Map(rows.map(r => [r[msheet.ID_KEY], r[msheet.SECTION_KEY]]));
  const map = new Map();
  for (const u of items) {
    if (!/^SMDA_/.test(u.asset)) continue;
    const id = u.asset.replace(/^SMDA_/, '');
    if (!map.has(id) || u.folder === secById.get(id)) map.set(id, u);
  }
  return map;
}

function getAllModulesSheet() {
  const items = [], originals = {};
  for (const row of mst.all.all()) {
    const { current, original } = rowToPayload(row);
    items.push(current);
    originals[row.id] = original;
  }
  const sections = mst.sections.all().map(s => ({ name: s.name, headers: JSON.parse(s.headers_json) }));
  const ue = {};
  let readAt = null;
  for (const u of mst.ueAll.all()) { ue[u.id] = JSON.parse(u.data_json); readAt = u.read_at; }
  const entEff = {};
  const entUe = {};
  for (const u of stmts.allEntitiesUe.all()) entUe[u.id] = JSON.parse(u.data_json);
  const effective = {};
  for (const it of items) {
    const id = it[msheet.ID_KEY];
    let icon = null;
    const er = stmts.getEntity.get(id);
    if (er) { const p = rowToPayload(er); icon = eff.effectiveEntity(p.current, p.original, entUe[id] || null).Icon; }
    effective[id] = msheet.effectiveModule(it, originals[id], ue[id] || null, icon);
  }
  return { items, originals, sections, effective, ueReadAt: readAt, ueCount: Object.keys(ue).length };
}

function updateModuleSheet(id, fields) {
  const row = mst.get.get(id);
  if (!row) return null;
  const current = JSON.parse(row.current_json);
  for (const [k, v] of Object.entries(fields)) {
    if (k === msheet.ID_KEY || k === msheet.SECTION_KEY || !(k in current)) continue; // ID e sezione non modificabili; solo colonne esistenti
    current[k] = v === null || v === undefined ? '' : String(v);
  }
  mst.updateCur.run(JSON.stringify(current), new Date().toISOString(), id);
  return rowToPayload(mst.get.get(id));
}

function modulesSheetUrl() {
  if (process.env.HG_SHEET_MODULES_URL) return process.env.HG_SHEET_MODULES_URL;
  const m = /\/spreadsheets\/d\/([^/]+)/.exec(SHEET_CSV_URL || '');
  const gid = process.env.HG_SHEET_MODULES_GID;
  return m && gid ? `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${gid}` : '';
}

// Il tab Modules va letto con l'export diretto del tab (non con la query "gviz": perde le intestazioni delle sezioni).
async function fetchSheetModules(csvText) {
  let text;
  if (csvText) text = csvText;
  else if (process.env.HG_SHEET_MOCK_MODULES_CSV) text = fs.readFileSync(process.env.HG_SHEET_MOCK_MODULES_CSV, 'utf8');
  else {
    const url = modulesSheetUrl();
    if (!url) throw new SheetError('Lettura del tab Modules non configurata: imposta HG_SHEET_MODULES_URL (oppure HG_SHEET_CSV_URL + HG_SHEET_MODULES_GID) sul server, oppure usa "Importa CSV" con l\'export del tab Modules.', 503);
    try {
      const r = await fetch(url, { redirect: 'follow' });
      if (!r.ok) throw new Error('HTTP ' + r.status + ' (il foglio deve essere visibile a chiunque abbia il link)');
      text = await r.text();
    } catch (e) {
      throw new SheetError('Impossibile scaricare il tab Modules: ' + e.message, 502);
    }
  }
  const parsed = msheet.parseModulesTab(sheet.parseCsv(text));
  if (!parsed.rows.length) throw new SheetError('Nessuna riga di moduli trovata: serve l\'export CSV del tab Modules, con le intestazioni di sezione "<Sezione> (ID)".', 502);
  const seen = new Set();
  parsed.rows = parsed.rows.filter(r => { const id = r[msheet.ID_KEY]; if (seen.has(id)) return false; seen.add(id); return true; });
  return parsed;
}

async function pullModules({ apply, skipConflicts, csv }) {
  const parsed = await fetchSheetModules(csv);
  const dbRows = mst.all.all().map(r => ({ id: r.id, ...rowToPayload(r) }));
  const { report, plan } = msheet.diffModules(dbRows, parsed.rows);
  report.sections = parsed.sections.map(s => ({ name: s.name, rows: parsed.rows.filter(r => r[msheet.SECTION_KEY] === s.name).length, columns: s.headers.filter(Boolean).length }));
  report.total = parsed.rows.length;
  report.applied = false;
  if (!apply) return { status: 200, report };
  if (report.conflicts.length && !skipConflicts) return { status: 409, report };
  const now = new Date().toISOString();
  db.exec('BEGIN');
  try {
    let ord = mst.maxOrd.get().m;
    for (const s of plan.insert) { const j = JSON.stringify(s); mst.insert.run(s[msheet.ID_KEY], s[msheet.SECTION_KEY], ++ord, j, j, now); }
    for (const u of plan.update) mst.updateBoth.run(u.original[msheet.SECTION_KEY], JSON.stringify(u.current), JSON.stringify(u.original), now, u.id);
    mst.clearSections.run();
    parsed.sections.forEach((s, i) => mst.insertSection.run(s.name, JSON.stringify(s.headers), i));
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  report.applied = true;
  return { status: 200, report };
}

function setProducerImage(name, dataURL) {
  const relDir = 'images/producers';
  const absPath = path.join(ROOT, relDir, sanitizeFileName(name) + '.jpg');
  fs.mkdirSync(path.join(ROOT, relDir), { recursive: true });
  const base64 = dataURL.split(',')[1] || '';
  fs.writeFileSync(absPath, Buffer.from(base64, 'base64'));
  const image = '/' + relDir + '/' + sanitizeFileName(name) + '.jpg';
  stmts.upsertProducer.run(name, image, new Date().toISOString());
  return image;
}

function removeProducerImage(name) {
  const absPath = path.join(ROOT, 'images', 'producers', sanitizeFileName(name) + '.jpg');
  try { fs.unlinkSync(absPath); } catch (e) { /* già assente */ }
  stmts.deleteProducer.run(name);
}

/* ============================== HTTP ============================== */
function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 20 * 1024 * 1024) req.destroy(); // limite 20MB per richiesta
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

const MIME = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.js': 'text/javascript', '.css': 'text/css' };

function serveStatic(req, res, urlPath) {
  const rel = urlPath === '/' ? 'hellgalaxy.html' : decodeURIComponent(urlPath).replace(/^\/+/, '');
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
  // Il database, il codice e le configurazioni non vanno serviti: i dati passano
  // da /api/* (protetta dal token, se impostato). Restano pubblici l'HTML, le
  // immagini e i JSON usati dalla UI (data/*.json, data/*.csv).
  const relPosix = path.relative(ROOT, file).split(path.sep).join('/');
  if (/\.(db|gs|sh|env)$/i.test(relPosix) || /^(scripts|tests|docs|\.git|\.github|\.claude)\//.test(relPosix) ||
      ['server.js', 'Dockerfile', 'docker-compose.yml', 'CLAUDE.md'].includes(relPosix)) {
    res.writeHead(404); res.end('not found'); return;
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// Tab CargoItemsAndLoots e Items del foglio (importazione esatta + lettura da Unreal in sola lettura).
const tabsHandler = require('./scripts/tabs_server')({ db, sendJson, readJsonBody, SheetError, UnrealError: unreal.UnrealError, unrealRead, fs });

// Fogli "Localization Master" (Identities, Entities, Quest, EventsAudio): copia fedele di sola lettura.
const gridHandler = require('./scripts/grid_tabs')({ db, sendJson, readJsonBody, SheetError, fs, onEntityText: mirrorLocTextToEntity });

// Versione dell'app (file VERSION, da incrementare a ogni commit/push).
let APP_VERSION = '';
try { APP_VERSION = fs.readFileSync(path.join(__dirname, 'VERSION'), 'utf8').trim(); } catch (e) { APP_VERSION = ''; }

const server = http.createServer(async (req, res) => {
  const [urlPath, queryString] = req.url.split('?');
  const query = new URLSearchParams(queryString || '');

  try {
    if (urlPath === '/api/data' && req.method === 'GET') {
      return sendJson(res, 200, getAllData());
    }

    if (urlPath === '/api/health' && req.method === 'GET') {
      return sendJson(res, 200, {
        ok: true,
        version: APP_VERSION,
        authRequired: !!API_TOKEN,
        entities: stmts.allEntities.all().length,
        sheetConfigured: !!(SHEET_MOCK_CSV || SHEET_CSV_URL || (SHEET_EXEC_URL && SHEET_SECRET)),
      });
    }
    if (API_TOKEN && urlPath.startsWith('/api/')) {
      const given = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (given !== API_TOKEN) return sendJson(res, 401, { error: 'token mancante o errato' });
    }

    let m;
    if ((m = urlPath.match(/^\/api\/modules\/([^/]+)$/)) && req.method === 'PUT') {
      const body = await readJsonBody(req);
      const result = updateModule(decodeURIComponent(m[1]), body.fields || {});
      if (!result) return sendJson(res, 404, { error: 'modulo non trovato' });
      return sendJson(res, 200, result);
    }
    if ((m = urlPath.match(/^\/api\/modules\/([^/]+)\/revert$/)) && req.method === 'POST') {
      const result = revertModule(decodeURIComponent(m[1]));
      if (!result) return sendJson(res, 404, { error: 'modulo non trovato' });
      return sendJson(res, 200, result);
    }
    if (urlPath === '/api/modules/reset-all' && req.method === 'POST') {
      resetAllModules();
      return sendJson(res, 200, getAllData());
    }
    if ((m = urlPath.match(/^\/api\/producers\/([^/]+)$/)) && req.method === 'PUT') {
      const body = await readJsonBody(req);
      const image = setProducerImage(decodeURIComponent(m[1]), body.image || '');
      return sendJson(res, 200, { name: decodeURIComponent(m[1]), image });
    }
    if ((m = urlPath.match(/^\/api\/producers\/([^/]+)$/)) && req.method === 'DELETE') {
      removeProducerImage(decodeURIComponent(m[1]));
      return sendJson(res, 200, { ok: true });
    }

    if (urlPath === '/api/enemies' && req.method === 'GET') {
      return sendJson(res, 200, getAllEnemies());
    }
    if ((m = urlPath.match(/^\/api\/enemies\/([^/]+)$/)) && req.method === 'PUT') {
      const body = await readJsonBody(req);
      const result = updateEnemy(decodeURIComponent(m[1]), body.fields || {});
      if (!result) return sendJson(res, 404, { error: 'nemico non trovato' });
      return sendJson(res, 200, result);
    }
    if ((m = urlPath.match(/^\/api\/enemies\/([^/]+)\/revert$/)) && req.method === 'POST') {
      const result = revertEnemy(decodeURIComponent(m[1]));
      if (!result) return sendJson(res, 404, { error: 'nemico non trovato' });
      return sendJson(res, 200, result);
    }
    if (urlPath === '/api/enemies/reset-all' && req.method === 'POST') {
      resetAllEnemiesFn();
      return sendJson(res, 200, getAllEnemies());
    }

    if (urlPath === '/api/entities' && req.method === 'GET') {
      return sendJson(res, 200, getAllEntities());
    }
    if (urlPath === '/api/entities/reset-all' && req.method === 'POST') {
      stmts.resetAllEntities.run(new Date().toISOString());
      for (const r of stmts.allEntities.all()) mirrorEntityTextToLoc(JSON.parse(r.current_json), { Label: 1, BriefDescription: 1 });
      return sendJson(res, 200, getAllEntities());
    }
    if ((m = urlPath.match(/^\/api\/entities\/([^/]+)$/)) && req.method === 'PUT') {
      const body = await readJsonBody(req);
      const result = updateEntity(decodeURIComponent(m[1]), body.fields || {});
      if (!result) return sendJson(res, 404, { error: 'entità non trovata' });
      return sendJson(res, 200, result);
    }
    if ((m = urlPath.match(/^\/api\/entities\/([^/]+)\/revert$/)) && req.method === 'POST') {
      const result = revertEntity(decodeURIComponent(m[1]));
      if (!result) return sendJson(res, 404, { error: 'entità non trovata' });
      return sendJson(res, 200, result);
    }
    // Lettura da Unreal (SOLA LETTURA su Unreal): confronta gli EDA_ con le entità dell'app;
    // con ?apply=1 salva i dati letti nel DB dell'app (tabella entities_ue), mai su Unreal.
    if (urlPath === '/api/sync/unreal/entities' && req.method === 'POST') {
      try {
        const { items, ms } = await unrealRead.readEntities({ timeoutMs: 120000 });
        const rows = stmts.allEntities.all().map(r => JSON.parse(r.current_json));
        const report = eff.compareWithUnreal(rows, items);
        report.applied = false; report.ms = ms;
        if (query.get('apply') === '1') {
          const now = new Date().toISOString();
          db.exec('BEGIN');
          try {
            stmts.clearEntitiesUe.run();
            for (const u of items) {
              stmts.insertEntityUe.run(u.asset.replace(/^EDA_/, ''), JSON.stringify({
                asset: u.asset, label: u.label, brief: u.brief, entity_type: u.entity_type, rarity: u.rarity, base_price: u.base_price,
                icon: u.icon && { name: u.icon.name, class: u.icon.class }, producer_icon: u.producer_icon && { name: u.producer_icon.name, class: u.producer_icon.class },
              }), now);
            }
            db.exec('COMMIT');
          } catch (e) { db.exec('ROLLBACK'); throw e; }
          report.applied = true;
        }
        return sendJson(res, 200, report);
      } catch (e) {
        if (e instanceof unreal.UnrealError) return sendJson(res, e.status, { ok: false, error: e.message, code: e.code });
        throw e;
      }
    }
    if (await tabsHandler(req, res, urlPath, query)) return;
    if (await gridHandler(req, res, urlPath, query)) return;

    // ---- Tab Modules (foglio) ----
    if (urlPath === '/api/modules-sheet' && req.method === 'GET') return sendJson(res, 200, getAllModulesSheet());
    if (urlPath === '/api/modules-sheet/reset-all' && req.method === 'POST') {
      mst.resetAll.run(new Date().toISOString());
      return sendJson(res, 200, getAllModulesSheet());
    }
    if ((m = urlPath.match(/^\/api\/modules-sheet\/([^/]+)$/)) && req.method === 'PUT') {
      const body = await readJsonBody(req);
      const result = updateModuleSheet(decodeURIComponent(m[1]), body.fields || {});
      if (!result) return sendJson(res, 404, { error: 'modulo non trovato' });
      return sendJson(res, 200, result);
    }
    if ((m = urlPath.match(/^\/api\/modules-sheet\/([^/]+)\/revert$/)) && req.method === 'POST') {
      const row = mst.get.get(decodeURIComponent(m[1]));
      if (!row) return sendJson(res, 404, { error: 'modulo non trovato' });
      mst.updateCur.run(row.original_json, new Date().toISOString(), row.id);
      return sendJson(res, 200, rowToPayload(mst.get.get(row.id)));
    }
    if (urlPath === '/api/sync/pull/modules' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const out = await pullModules({ apply: query.get('apply') === '1', skipConflicts: query.get('skipConflicts') === '1', csv: typeof body.csv === 'string' ? body.csv : '' });
      return sendJson(res, out.status, out.report);
    }
    // Lettura degli SMDA_ da Unreal (SOLA LETTURA su Unreal); con ?apply=1 salva nel DB dell'app (modules_ue).
    if (urlPath === '/api/sync/unreal/modules' && req.method === 'POST') {
      try {
        const { items, ms } = await unrealRead.readModules({ timeoutMs: 120000 });
        const rows = mst.all.all().map(r => JSON.parse(r.current_json));
        const entUe = {};
        for (const u of stmts.allEntitiesUe.all()) entUe[u.id] = JSON.parse(u.data_json);
        const iconById = {};
        for (const r of rows) {
          const er = stmts.getEntity.get(r[msheet.ID_KEY]);
          if (er) { const p = rowToPayload(er); iconById[r[msheet.ID_KEY]] = eff.effectiveEntity(p.current, p.original, entUe[r[msheet.ID_KEY]] || null).Icon; }
        }
        const report = msheet.compareModulesWithUnreal(rows, items, iconById);
        report.applied = false; report.ms = ms;
        if (query.get('apply') === '1') {
          const now = new Date().toISOString();
          const pick = pickSmda(items, rows);
          db.exec('BEGIN');
          try {
            mst.ueClear.run();
            for (const [id, u] of pick) {
              mst.ueInsert.run(id, JSON.stringify({ asset: u.asset, folder: u.folder, class: u.class, static_mesh: u.static_mesh && { name: u.static_mesh.name, class: u.static_mesh.class }, shield_static_mesh: u.shield_static_mesh && { name: u.shield_static_mesh.name, class: u.shield_static_mesh.class }, quality: u.quality, module_type: u.module_type, props: u.props }), now);
            }
            db.exec('COMMIT');
          } catch (e) { db.exec('ROLLBACK'); throw e; }
          report.applied = true;
        }
        return sendJson(res, 200, report);
      } catch (e) {
        if (e instanceof unreal.UnrealError) return sendJson(res, e.status, { ok: false, error: e.message, code: e.code });
        throw e;
      }
    }

    if (urlPath === '/api/sync/pull/entities' && req.method === 'POST') {
      // Body opzionale {csv: "..."}: CSV esportato a mano dal foglio (nessun Apps Script).
      const body = await readJsonBody(req);
      const out = await pullEntities({ apply: query.get('apply') === '1', skipConflicts: query.get('skipConflicts') === '1', csv: typeof body.csv === 'string' ? body.csv : '' });
      return sendJson(res, out.status, out.report);
    }

    // Test di collegamento con l'Editor Unreal (sola lettura: nessun asset toccato).
    if (urlPath === '/api/unreal/ping' && req.method === 'GET') {
      try {
        return sendJson(res, 200, await unreal.ping({ timeoutMs: 30000 }));
      } catch (e) {
        if (e instanceof unreal.UnrealError) return sendJson(res, e.status, { ok: false, error: e.message, code: e.code, url: unreal.MCP_URL() });
        throw e;
      }
    }

    if (urlPath.startsWith('/api/')) return sendJson(res, 404, { error: 'endpoint non trovato' });
    return serveStatic(req, res, urlPath);
  } catch (err) {
    if (err instanceof SheetError) return sendJson(res, err.status, { error: err.message });
    console.error(err);
    sendJson(res, 500, { error: err.message });
  }
});

server.listen(PORT, () => console.log(`Hell Galaxy Database in ascolto su http://localhost:${PORT}`));
