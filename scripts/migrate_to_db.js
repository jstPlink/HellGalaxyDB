// Crea/aggiorna data/hellgalaxy.db (SQLite, via node:sqlite integrato in Node - nessuna
// dipendenza npm) a partire da data/data_*.json (generati da build_data.ps1 dai CSV).
//
// Uso:
//   node scripts/migrate_to_db.js            Prima creazione (fallisce se il DB esiste già)
//   node scripts/migrate_to_db.js --force    Ricrea il DB da zero (PERDE modifiche/immagini già in DB)
//   node scripts/migrate_to_db.js --update   Risincronizza i CSV aggiornati in un DB esistente:
//                                             aggiunge i moduli nuovi, aggiorna il valore "originale"
//                                             (di riferimento per dirty/revert) di quelli già presenti
//                                             SENZA toccare i valori correnti/immagini già modificati.
'use strict';
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const IMAGES_DIR = path.join(ROOT, 'images');
const DB_PATH = path.join(DATA_DIR, 'hellgalaxy.db');
const FORCE = process.argv.includes('--force');
const UPDATE = process.argv.includes('--update');

function sanitizeFileName(s) { return String(s).replace(/[^A-Za-z0-9_.-]/g, '_'); }
function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, '')); }

const CATS = [
  { id: 'body', file: 'data_body.json', classField: null },
  { id: 'engine', file: 'data_engine.json', classField: null },
  { id: 'primary', file: 'data_primary.json', classField: 'WeaponClass' },
  { id: 'secondary', file: 'data_secondary.json', classField: 'WeaponClass' },
];

const dbExists = fs.existsSync(DB_PATH);
if (dbExists && !FORCE && !UPDATE) {
  console.error(`Esiste già ${path.relative(ROOT, DB_PATH)}.`);
  console.error('Usa --update per risincronizzare i CSV senza perdere le modifiche, oppure --force per ricrearlo da zero.');
  process.exit(1);
}
if (!dbExists && UPDATE) {
  console.error('Nessun database da aggiornare: esegui prima la creazione senza flag.');
  process.exit(1);
}
if (dbExists && FORCE) fs.unlinkSync(DB_PATH);

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(DB_PATH);

if (!UPDATE) {
  db.exec(`
    CREATE TABLE modules (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      class TEXT,
      name TEXT,
      rarity TEXT,
      price REAL,
      producer TEXT,
      current_json TEXT NOT NULL,
      original_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX idx_modules_category ON modules(category);
    CREATE TABLE producers (
      name TEXT PRIMARY KEY,
      image TEXT,
      updated_at TEXT NOT NULL
    );
  `);
}

// Al primo import collega le immagini già presenti in images/<cat>/<ID>.jpg
// scansionando direttamente le cartelle su disco (fonte di verità: i file
// veri, non un manifest esterno che il server non mantiene più). Gestisce
// anche il vecchio formato con doppia cartella images/images/<cat>/, se un
// manifest.json legacy è ancora presente, spostando i file nella posizione
// fissa images/<cat>/<ID>.jpg. In modalità --update questo passo viene
// saltato: le immagini sono già gestite dal server per i moduli esistenti.
const moduleImageById = {};
if (!UPDATE) {
  let manifest = { modules: [], producers: [] };
  const manifestPath = path.join(IMAGES_DIR, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    try { manifest = readJson(manifestPath); } catch (e) { console.warn('manifest.json illeggibile, ignorato:', e.message); }
  }
  for (const m of manifest.modules || []) {
    const target = path.join(IMAGES_DIR, m.category, sanitizeFileName(m.id) + '.jpg');
    const sourceLegacy = path.join(IMAGES_DIR, m.file);
    const sourceFlat = path.join(IMAGES_DIR, m.file.replace(/^images[\\/]/, ''));
    const actualSource = fs.existsSync(sourceLegacy) ? sourceLegacy : (fs.existsSync(sourceFlat) ? sourceFlat : null);
    if (actualSource) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      if (path.resolve(actualSource) !== path.resolve(target)) {
        fs.copyFileSync(actualSource, target);
        fs.unlinkSync(actualSource);
      }
      moduleImageById[m.id] = '/images/' + m.category + '/' + sanitizeFileName(m.id) + '.jpg';
    }
  }
  const legacyNested = path.join(IMAGES_DIR, 'images');
  (function removeIfEmptyRecursive(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir)) {
      const p = path.join(dir, entry);
      if (fs.statSync(p).isDirectory()) removeIfEmptyRecursive(p);
    }
    if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
  })(legacyNested);

  // Fonte primaria: scansione diretta di images/<cat>/*.jpg per nome file.
  for (const cat of CATS) {
    const dir = path.join(IMAGES_DIR, cat.id);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!/\.jpg$/i.test(f)) continue;
      const idFromFile = f.replace(/\.jpg$/i, '');
      moduleImageById[idFromFile] = moduleImageById[idFromFile] || ('/images/' + cat.id + '/' + f);
    }
  }

  const producerImageByName = {};
  for (const p of manifest.producers || []) {
    const rel = 'producers/' + sanitizeFileName(p.name) + '.jpg';
    if (fs.existsSync(path.join(IMAGES_DIR, rel))) producerImageByName[p.name] = '/images/' + rel;
  }
  const producersDir = path.join(IMAGES_DIR, 'producers');
  if (fs.existsSync(producersDir)) {
    for (const f of fs.readdirSync(producersDir)) {
      const name = f.replace(/\.jpg$/i, '');
      if (!producerImageByName[name]) producerImageByName[name] = '/images/producers/' + f;
    }
  }
  const insProducer = db.prepare('INSERT INTO producers (name, image, updated_at) VALUES (?, ?, ?)');
  const now = new Date().toISOString();
  let totalProducers = 0;
  for (const name of Object.keys(producerImageByName)) { insProducer.run(name, producerImageByName[name], now); totalProducers++; }
  console.log(`Produttori con immagine importati: ${totalProducers}`);
}

const insModule = db.prepare(`
  INSERT INTO modules (id, category, class, name, rarity, price, producer, current_json, original_json, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const getModule = db.prepare('SELECT id, original_json FROM modules WHERE id = ?');
const refreshOriginal = db.prepare('UPDATE modules SET original_json = ? WHERE id = ?');

const now = new Date().toISOString();
let inserted = 0, refreshed = 0, unchanged = 0;
for (const cat of CATS) {
  const items = readJson(path.join(DATA_DIR, cat.file));
  for (const item of items) {
    const original = Object.assign({}, item, { Description: item.Description || '', Image: '' });
    if (UPDATE) {
      const existing = getModule.get(item.ID);
      if (existing) {
        if (existing.original_json !== JSON.stringify(original)) { refreshOriginal.run(JSON.stringify(original), item.ID); refreshed++; }
        else unchanged++;
        continue;
      }
    }
    const image = moduleImageById[item.ID] || '';
    const current = Object.assign({}, item, { Description: item.Description || '', Image: image });
    insModule.run(
      item.ID, cat.id, cat.classField ? (item[cat.classField] || null) : null,
      item.Name || '', item.Rarity || '', Number(item.Price) || 0, item.Producer || '',
      JSON.stringify(current), JSON.stringify(original), now
    );
    inserted++;
  }
}

if (UPDATE) {
  console.log(`Moduli nuovi aggiunti: ${inserted}`);
  console.log(`Moduli con dati CSV aggiornati (valori correnti/immagini non toccati): ${refreshed}`);
  console.log(`Moduli invariati: ${unchanged}`);
} else {
  console.log(`Totale moduli importati: ${inserted}`);
}
console.log(`Database: ${path.relative(ROOT, DB_PATH)}`);
