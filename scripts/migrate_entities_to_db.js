// Crea la tabella "entities" nel database (data/hellgalaxy.db) e la popola dal
// primo export CSV del foglio ENTITIES (data/HS - Entity - ENTITIES.csv).
// SEED INIZIALE: se la tabella contiene già righe non fa nulla. Gli
// aggiornamenti successivi arrivano dal pulsante "Scarica dal foglio" del tool
// (POST /api/sync/pull/entities), che ha la gestione di conflitti e anteprima:
// rileggere il CSV a ogni avvio (Docker) sovrascriverebbe quegli aggiornamenti.
// Non cancella mai nulla.
//
// Uso: node scripts/migrate_entities_to_db.js [--force]
//   --force  aggiunge anche le righe del CSV mancanti e aggiorna gli "originali"
//            (come migrate_enemies_to_db.js), senza toccare i valori correnti.
'use strict';
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { csvToTable, cellToString, normalizeEntityRow, ENTITY_ID_COLUMN } = require('./sheet_mappings');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'hellgalaxy.db');
const CSV_PATH = path.join(DATA_DIR, 'HS - Entity - ENTITIES.csv');

if (!fs.existsSync(DB_PATH)) {
  console.error(`Database non trovato: ${path.relative(ROOT, DB_PATH)}`);
  console.error('Esegui prima: node scripts/migrate_to_db.js');
  process.exit(1);
}
if (!fs.existsSync(CSV_PATH)) {
  console.error(`File non trovato: ${path.relative(ROOT, CSV_PATH)}`);
  process.exit(1);
}

const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS entities (
    id TEXT PRIMARY KEY,
    current_json TEXT NOT NULL,
    original_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

// Riallinea ai criteri di normalizzazione attuali (a capo, "#N/A") i valori già nel
// database: idempotente, tocca solo i testi che cambiano.
{
  const fix = o => {
    let changed = false;
    for (const k of Object.keys(o)) {
      if (k === 'extra') { if (fix(o.extra)) changed = true; continue; }
      if (typeof o[k] === 'string') { const n = cellToString(o[k]); if (n !== o[k]) { o[k] = n; changed = true; } }
    }
    return changed;
  };
  let normalized = 0;
  for (const r of db.prepare('SELECT id, current_json, original_json FROM entities').all()) {
    const cur = JSON.parse(r.current_json), orig = JSON.parse(r.original_json);
    const a = fix(cur), b = fix(orig);
    if (a || b) { db.prepare('UPDATE entities SET current_json=?, original_json=? WHERE id=?').run(JSON.stringify(cur), JSON.stringify(orig), r.id); normalized++; }
  }
  if (normalized) console.log('Valori normalizzati in ' + normalized + ' entità esistenti.');
}

if (!process.argv.includes('--force') && db.prepare('SELECT COUNT(*) AS n FROM entities').get().n > 0) {
  console.log('Tabella entities già popolata: nessuna operazione (usa il pulsante "Scarica dal foglio" o --force).');
  process.exit(0);
}

const { headers, rows } = csvToTable(fs.readFileSync(CSV_PATH, 'utf8'));
if (!headers.includes(ENTITY_ID_COLUMN)) {
  console.error(`Colonna "${ENTITY_ID_COLUMN}" non trovata nel CSV.`);
  process.exit(1);
}

const ins = db.prepare('INSERT INTO entities (id, current_json, original_json, updated_at) VALUES (?, ?, ?, ?)');
const get = db.prepare('SELECT id, original_json FROM entities WHERE id = ?');
const refresh = db.prepare('UPDATE entities SET original_json = ? WHERE id = ?');

const now = new Date().toISOString();
let inserted = 0, refreshed = 0, unchanged = 0, skipped = 0;
db.exec('BEGIN');
try {
  for (const raw of rows) {
    const e = normalizeEntityRow(raw, headers);
    if (!e) { skipped++; continue; }
    const id = e[ENTITY_ID_COLUMN];
    const json = JSON.stringify(e);
    const existing = get.get(id);
    if (existing) {
      if (existing.original_json !== json) { refresh.run(json, id); refreshed++; } else unchanged++;
      continue;
    }
    ins.run(id, json, json, now);
    inserted++;
  }
  db.exec('COMMIT');
} catch (err) {
  db.exec('ROLLBACK');
  throw err;
}

console.log(`Entità nuove aggiunte: ${inserted}`);
console.log(`Entità con dati CSV aggiornati (valori correnti non toccati): ${refreshed}`);
console.log(`Entità invariate: ${unchanged}`);
if (skipped) console.log(`Righe senza ID saltate: ${skipped}`);
console.log(`Database: ${path.relative(ROOT, DB_PATH)}`);
