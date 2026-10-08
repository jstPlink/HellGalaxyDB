// Mappatura colonne del foglio Google "ENTITIES" e utilità condivise tra
// server.js e scripts/migrate_entities_to_db.js (parsing CSV, normalizzazione
// delle righe, confronto foglio <-> database).
// I nomi di colonna stanno solo qui: non vanno sparsi nel resto del codice.
'use strict';

const ENTITY_ID_COLUMN = '(ID)';

// Colonne riconosciute, nell'ordine del foglio.
const ENTITY_COLUMNS = [
  '(ID)', 'Label', 'BriefDescription', 'EntityType', 'BasePrice', 'BaseRarity', 'Icon',
  'LabelKey', 'DescriptionKey', 'ProducerIcon', 'ModuleType', 'Quality',
];

// Colonne che il flusso Unreal oggi legge (range A:G di CreateACSData.py).
// Le altre sono conservate ma non entrano in Unreal (decisione D5).
const ENTITY_UNREAL_COLUMNS = ENTITY_COLUMNS.slice(0, 7);

// Colonne numeriche (usate solo per ordinamento/UI: nel database restano stringhe,
// identiche al foglio, per avere parità esatta).
const ENTITY_NUMERIC_COLUMNS = ['BasePrice', 'Quality'];

const ENTITY_TYPES = ['Module', 'Consumable', 'Item', 'Collectable'];
const ENTITY_RARITIES = ['Salvage', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];

/* ------------------------------ CSV ------------------------------ */
// Parser CSV (RFC 4180): virgolette, virgolette raddoppiate, campi multilinea.
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Righe CSV -> { headers, rows: [ {intestazione: valore} ] }. Le intestazioni
// vuote vengono scartate, quelle esatte non vengono né trimmate né rinominate.
function csvToTable(text) {
  const all = parseCsv(text).filter(r => r.some(c => c !== ''));
  if (!all.length) return { headers: [], rows: [] };
  const headers = all[0];
  const rows = all.slice(1).map(cols => {
    const obj = {};
    headers.forEach((h, i) => { if (h !== '') obj[h] = cols[i] ?? ''; });
    return obj;
  });
  return { headers: headers.filter(h => h !== ''), rows };
}

/* ------------------------- normalizzazione ------------------------- */
// Uniforma i valori tra le sorgenti (Apps Script, CSV del foglio, CSV esportato
// a mano): gli a capo CRLF diventano LF e gli errori di formula "#N/A" diventano
// vuoti (alcuni export li riportano, altri no).
function cellToString(v) {
  if (v === null || v === undefined) return '';
  const str = String(v).split('\r\n').join('\n');
  return str === '#N/A' ? '' : str;
}

// Riga del foglio -> oggetto del database. Tutte le colonne riconosciute
// (anche vuote) più "extra" con le altre intestazioni (es. il backup
// "ModuleType BAKCUP 26.03.26"). Nulla viene scartato. Ritorna null se manca l'ID.
function normalizeEntityRow(raw, headers) {
  const id = cellToString(raw[ENTITY_ID_COLUMN]).trim();
  if (!id) return null;
  const out = {};
  ENTITY_COLUMNS.forEach(c => { out[c] = cellToString(raw[c]); });
  out[ENTITY_ID_COLUMN] = id;
  const extra = {};
  (headers || Object.keys(raw)).forEach(h => {
    if (h !== '' && !ENTITY_COLUMNS.includes(h)) extra[h] = cellToString(raw[h]);
  });
  out.extra = extra;
  return out;
}

function stableStringify(v) {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
  }
  return JSON.stringify(v);
}

function sameValue(a, b) { return stableStringify(a ?? '') === stableStringify(b ?? ''); }

const ENTITY_FIELDS = [...ENTITY_COLUMNS, 'extra'];

/* ------------------------------ diff ------------------------------ */
// dbRows: [{id, current, original}]; sheetRows: righe già normalizzate.
// Ritorna il report di dry run e il piano di applicazione.
function diffEntities(dbRows, sheetRows) {
  const byId = new Map(dbRows.map(r => [r.id, r]));
  const sheetIds = new Set();
  const report = { added: [], changed: [], conflicts: [], missingInSheet: [], unchanged: 0 };
  const plan = { insert: [], update: [] };

  for (const s of sheetRows) {
    const id = s[ENTITY_ID_COLUMN];
    sheetIds.add(id);
    const db = byId.get(id);
    if (!db) { report.added.push(id); plan.insert.push(s); continue; }
    const fields = ENTITY_FIELDS.filter(f => !sameValue(s[f], db.original[f]));
    if (!fields.length) { report.unchanged++; continue; }
    const newCurrent = { ...db.current };
    const rowConflicts = [];
    for (const f of fields) {
      if (sameValue(db.current[f], db.original[f])) newCurrent[f] = s[f];
      else rowConflicts.push({ id, field: f, sheet: s[f], local: db.current[f] });
    }
    report.changed.push({ id, fields });
    report.conflicts.push(...rowConflicts);
    plan.update.push({ id, original: s, current: newCurrent });
  }
  for (const r of dbRows) if (!sheetIds.has(r.id)) report.missingInSheet.push(r.id);
  return { report, plan };
}

module.exports = {
  ENTITY_ID_COLUMN, ENTITY_COLUMNS, ENTITY_UNREAL_COLUMNS, ENTITY_NUMERIC_COLUMNS,
  ENTITY_TYPES, ENTITY_RARITIES, ENTITY_FIELDS,
  parseCsv, csvToTable, cellToString, normalizeEntityRow, sameValue, diffEntities,
};
