// Crea/aggiorna la tabella "enemies" nel database esistente (data/hellgalaxy.db)
// a partire da data/enemies.json (generato da build_enemies_data.js). Idempotente:
// aggiunge i nemici nuovi e aggiorna il valore "originale" di quelli già presenti
// (di riferimento per dirty/revert), SENZA toccare i valori correnti già
// modificati dal tool.
//
// Uso:
//   node scripts/build_enemies_data.js       (rigenera data/enemies.json dai CSV)
//   node scripts/migrate_enemies_to_db.js
'use strict';
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'hellgalaxy.db');
const ENEMIES_JSON_PATH = path.join(DATA_DIR, 'enemies.json');

if (!fs.existsSync(DB_PATH)) {
  console.error(`Database non trovato: ${path.relative(ROOT, DB_PATH)}`);
  console.error('Esegui prima: node scripts/migrate_to_db.js');
  process.exit(1);
}
if (!fs.existsSync(ENEMIES_JSON_PATH)) {
  console.error(`File non trovato: ${path.relative(ROOT, ENEMIES_JSON_PATH)}`);
  console.error('Esegui prima: node scripts/build_enemies_data.js');
  process.exit(1);
}

const db = new DatabaseSync(DB_PATH);
const tableExists = !!db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='enemies'`).get();
if (!tableExists) {
  db.exec(`
    CREATE TABLE enemies (
      id TEXT PRIMARY KEY,
      current_json TEXT NOT NULL,
      original_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

const { enemies } = JSON.parse(fs.readFileSync(ENEMIES_JSON_PATH, 'utf8'));
const insEnemy = db.prepare('INSERT INTO enemies (id, current_json, original_json, updated_at) VALUES (?, ?, ?, ?)');
const getEnemy = db.prepare('SELECT id, original_json FROM enemies WHERE id = ?');
const refreshOriginal = db.prepare('UPDATE enemies SET original_json = ? WHERE id = ?');

const now = new Date().toISOString();
let inserted = 0, refreshed = 0, unchanged = 0;
for (const e of enemies) {
  const originalJson = JSON.stringify(e);
  const existing = getEnemy.get(e.id);
  if (existing) {
    if (existing.original_json !== originalJson) { refreshOriginal.run(originalJson, e.id); refreshed++; }
    else unchanged++;
    continue;
  }
  insEnemy.run(e.id, originalJson, originalJson, now);
  inserted++;
}

console.log(`Nemici nuovi aggiunti: ${inserted}`);
console.log(`Nemici con dati CSV aggiornati (valori correnti non toccati): ${refreshed}`);
console.log(`Nemici invariati: ${unchanged}`);
console.log(`Database: ${path.relative(ROOT, DB_PATH)}`);
