// DataTable degli eventi di Unreal generate dall'app (docs/LOCALIZZAZIONE.md §3b):
//   DT_EventsSignature          <- HS - Events > MainEvents  (RowName, Prefix, EventId, System, Multiplicity)
//   DT_DialoguesMultiplicityRules <- HS - Events > MainEvents  (RowName, EventId, MultiplicityType, Multiplicity, Priority)
//   DT_EventsText               <- HS - Events > EventTexts  (riga = "FMOD ID"; Id, Text, FmodId)
// preview(): SOLA LETTURA. Esporta le tre tabelle dall'Editor e le confronta con quelle generate dal database.
// apply():   SCRIVE SU UNREAL (una tabella alla volta). Disabilitata se HG_UE_ALLOW_WRITE !== '1' e richiede confirm:true.
// Mai check-in. Il blocco di scrittura resta finché l'utente non dà il via libera.
'use strict';
const fs = require('fs');
const path = require('path');
const bridge = require('./unreal_bridge');
const { parseCsv } = require('./sheet_mappings');

const PY = path.join(__dirname, 'unreal', 'datatables_io.py');
const py = () => fs.readFileSync(PY, 'utf8').replace(/\s+$/, '');

const TABLES = {
  signature: { asset: 'DT_EventsSignature', header: ['---', 'Prefix', 'EventId', 'System', 'Multiplicity'], source: 'MainEvents' },
  rules: { asset: 'DT_DialoguesMultiplicityRules', header: ['---', 'EventId', 'MultiplicityType', 'Multiplicity', 'Priority'], source: 'MainEvents' },
  texts: { asset: 'DT_EventsText', header: ['---', 'Id', 'Text', 'FmodId'], source: 'EventTexts' },
};

// Righe desiderate dal database: [{ row, cols: [...] }] (cols senza il nome riga).
function buildRows(gridRows, headersOf) {
  const out = { signature: [], rules: [], texts: [] };
  const me = gridRows.mainevents || [], et = gridRows.eventtexts || [];
  const mh = headersOf.mainevents || [], eh = headersOf.eventtexts || [];
  const mi = n => mh.indexOf(n), ei = n => eh.indexOf(n);
  for (const r of me) {
    const row = r[mi('RowName')];
    if (!row) continue;
    out.signature.push({ row, cols: ['Prefix', 'EventId', 'System', 'Multiplicity'].map(n => r[mi(n)] ?? '') });
    out.rules.push({ row, cols: ['EventId', 'MultiplicityType', 'Multiplicity', 'Priority'].map(n => r[mi(n)] ?? '') });
  }
  for (const r of et) {
    const fmod = r[ei('FMOD ID')];
    if (!fmod) continue;
    out.texts.push({ row: fmod, cols: [r[ei('id')] ?? '', r[ei('Text')] ?? '', fmod] });
  }
  return out;
}

const q = v => '"' + String(v).replace(/"/g, '""') + '"';
function toCsv(key, rows) {
  const lines = [TABLES[key].header.join(',')];
  for (const r of rows) lines.push(r.row + ',' + r.cols.map(q).join(','));
  return lines.join('\n') + '\n';
}

// Testo FText esportato da Unreal: NSLOCTEXT("ns", "chiave", "testo") -> testo (con escape rimossi).
function ftextToString(v) {
  const m = /^NSLOCTEXT\("((?:[^"\\]|\\.)*)",\s*"((?:[^"\\]|\\.)*)",\s*"((?:[^"\\]|\\.)*)"\)$/s.exec(v);
  const s = m ? m[3] : v;
  return s.replace(/\\(.)/gs, (_, c) => (c === 'n' ? '\n' : c === 't' ? '\t' : c === 'r' ? '\r' : c));
}

// CSV esportato da Unreal -> Map(nome riga -> colonne)
function parseUnrealCsv(key, text) {
  const rows = parseCsv(text).filter(r => r.some(c => c !== ''));
  const m = new Map();
  for (const r of rows.slice(1)) {
    const cols = r.slice(1);
    if (key === 'texts' && cols[1] !== undefined) cols[1] = ftextToString(cols[1]);
    m.set(r[0], cols);
  }
  return m;
}

function diffTable(key, want, unrealMap) {
  const cols = TABLES[key].header.slice(1);
  const wantMap = new Map(want.map(r => [r.row, r.cols]));
  const added = [], changed = [], removed = [];
  let unchanged = 0;
  for (const [row, c] of wantMap) {
    const u = unrealMap.get(row);
    if (!u) { added.push(row); continue; }
    const diffs = [];
    c.forEach((v, i) => { if (String(v) !== String(u[i] ?? '')) diffs.push({ col: cols[i], app: String(v).slice(0, 120), unreal: String(u[i] ?? '').slice(0, 120) }); });
    if (diffs.length) changed.push({ row, diffs }); else unchanged++;
  }
  for (const row of unrealMap.keys()) if (!wantMap.has(row)) removed.push(row);
  const orderSame = [...wantMap.keys()].join('\n') === [...unrealMap.keys()].join('\n');
  return { asset: TABLES[key].asset, source: TABLES[key].source, appRows: want.length, unrealRows: unrealMap.size, unchanged, added, changed, removed, orderSame };
}

async function exportTables(timeoutMs = 120000) {
  const r = await bridge.execPython(`${py()}\n\nexport_all()\n`, { timeoutMs });
  if (!r.success) throw new bridge.UnrealError('Errore Python nell\'Editor: ' + (r.stderr || r.output).slice(0, 400));
  if (r.savedPackages.length) throw new bridge.UnrealError('Inatteso: la lettura ha salvato pacchetti: ' + r.savedPackages.join(', '));
  return { tables: bridge.lastJsonLine(r.output).tables, ms: r.ms };
}

// db: { rows(tab) -> [cells], headers(tab) -> [..] } dal database dell'app.
async function preview(src) {
  const gridRows = { mainevents: src.rows('mainevents'), eventtexts: src.rows('eventtexts') };
  const headersOf = { mainevents: src.headers('mainevents'), eventtexts: src.headers('eventtexts') };
  if (!gridRows.mainevents.length || !gridRows.eventtexts.length) throw new bridge.UnrealError('MainEvents/EventTexts non sono ancora stati importati dal foglio.', 409, 'no_data');
  const want = buildRows(gridRows, headersOf);
  const { tables, ms } = await exportTables();
  const out = {};
  for (const key of Object.keys(TABLES)) {
    if (tables[key] === null) { out[key] = { asset: TABLES[key].asset, error: 'DataTable non trovata nel progetto' }; continue; }
    out[key] = diffTable(key, want[key], parseUnrealCsv(key, tables[key]));
  }
  return { tables: out, ms, writeEnabled: process.env.HG_UE_ALLOW_WRITE === '1' };
}

// Scrive UNA DataTable (sostituisce tutte le righe con quelle del database). Bloccata finché non c'è il via libera.
async function apply(src, key, { confirm } = {}) {
  if (process.env.HG_UE_ALLOW_WRITE !== '1') throw new bridge.UnrealError('Scrittura su Unreal disabilitata (HG_UE_ALLOW_WRITE non impostato).', 403, 'write_disabled');
  if (confirm !== true) throw new bridge.UnrealError('Aggiornamento non confermato.', 400, 'not_confirmed');
  if (!TABLES[key]) throw new bridge.UnrealError('DataTable sconosciuta: ' + key, 400, 'bad_table');
  const want = buildRows({ mainevents: src.rows('mainevents'), eventtexts: src.rows('eventtexts') }, { mainevents: src.headers('mainevents'), eventtexts: src.headers('eventtexts') });
  const csv = toCsv(key, want[key]);
  const r = await bridge.execPython(`${py()}\n\nimport_one(${JSON.stringify(key)}, ${JSON.stringify(Buffer.from(csv, 'utf8').toString('base64'))})\n`, { timeoutMs: 180000 });
  if (!r.success) throw new bridge.UnrealError('Aggiornamento fallito: ' + (r.stderr || r.output).slice(0, 300));
  return { ...bridge.lastJsonLine(r.output), savedPackages: r.savedPackages, rows: want[key].length };
}

module.exports = { preview, apply, buildRows, toCsv, ftextToString, parseUnrealCsv, diffTable, TABLES };
