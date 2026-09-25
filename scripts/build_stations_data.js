// Legge i CSV "HS - SpaceStations - *.csv" in data/ e produce data/stations.json:
// l'elenco delle stazioni spaziali (profilo bottino per rarità, blueprint, eventi
// di sblocco) incrociato con il catalogo oggetti/moduli e la stazione in cui
// ciascuno viene sbloccato ("Sblocchi visualizzato in"). Sola lettura, nessun DB.
//
// Uso: node scripts/build_stations_data.js
'use strict';
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const OUT_PATH = path.join(DATA_DIR, 'stations.json');

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = false; }
      } else { cur += ch; }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { out.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

// Parser CSV "raw rows" (non assume un header fisso): serve per file con più
// sezioni/intestazioni ripetute nello stesso foglio (GenericLockRules.csv).
function parseCsvRows(text) {
  // Un campo tra virgolette può contenere newline reali (es. descrizioni multi-riga):
  // ricomponiamo le righe fisiche in righe logiche contando le virgolette.
  const physicalLines = text.split(/\r?\n/);
  const logicalLines = [];
  let buf = null;
  physicalLines.forEach(line => {
    if (buf === null) { buf = line; } else { buf += '\n' + line; }
    const quoteCount = (buf.match(/"/g) || []).length;
    if (quoteCount % 2 === 0) { logicalLines.push(buf); buf = null; }
  });
  if (buf !== null) logicalLines.push(buf);
  return logicalLines.filter(l => l.length > 0).map(parseCsvLine);
}

function toNum(s) {
  const n = Number(String(s ?? '').trim());
  return Number.isFinite(n) ? n : 0;
}
function toBool(s) {
  return String(s ?? '').trim().toUpperCase() === 'TRUE';
}
function clean(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

/* ============================== 1. SpaceStationRules.csv ============================== */
const RARITY_KEYS = ['Salvage','Common','Uncommon','Rare','Epic','Mythic','Legendary'];
const stationRows = parseCsvRows(fs.readFileSync(path.join(DATA_DIR, 'HS - SpaceStations - SpaceStationRules.csv'), 'utf8'));
// riga 0 = header, righe successive = dati
const stations = stationRows.slice(1).filter(r => r[0] && r[0].trim()).map(r => {
  const id = r[0].trim();
  const lootProfile = {};
  RARITY_KEYS.forEach((key, i) => {
    const raw = clean(r[1 + i]); // colonne 1..7
    const m = raw.match(/^(\d+)\s*-\s*(\d+)$/);
    lootProfile[key] = m ? [toNum(m[1]), toNum(m[2])] : [0, 0];
  });
  const blueprint = clean(r[8]) || null;
  const unlockEvent = clean(r[9]) || null;
  // colonne 10+ : eventuali cutscene/eventi extra sparsi in colonne non allineate
  const otherEvents = Array.from(new Set(r.slice(10).map(clean).filter(Boolean)));
  const maxTotal = RARITY_KEYS.reduce((sum, k) => sum + lootProfile[k][1], 0);
  const hasHighRarity = lootProfile.Mythic[1] > 0 || lootProfile.Legendary[1] > 0;
  return {
    id, blueprint, unlockEvent, otherEvents, lootProfile, maxTotal,
    profile: hasHighRarity ? 'Ricco' : 'Base',
  };
});
const stationIds = new Set(stations.map(s => s.id));

/* ============================== 2. GenericLockRules.csv ============================== */
const lockRows = parseCsvRows(fs.readFileSync(path.join(DATA_DIR, 'HS - SpaceStations - GenericLockRules.csv'), 'utf8'));

const PLACEHOLDER_NAMES = new Set(['[C]', 'Not Found', '']);
const catalog = [];
let currentSection = 'Item';

lockRows.forEach(r => {
  const first = clean(r[0]);
  // riga titolo di sezione, es. "COLLECTABLES,,,,,,,,,,,,,,,,,"
  if (/^(COLLECTABLES|ITEMS)$/i.test(first) && r.slice(1).every(c => !clean(c))) {
    currentSection = /COLLECT/i.test(first) ? 'Collectable' : 'Item';
    return;
  }
  // riga di intestazione ripetuta, es. "EntityID,Rarity,..."
  if (first === 'EntityID') return;
  if (!first) return;

  const entityId = first;
  const rarity = clean(r[1]) || 'Salvage';
  const unlockRules = clean(r[2]) || null;
  const lockRules = clean(r[3]) || null;
  const excludeFromRolls = toBool(r[6]);
  const isGenericStarter = toBool(r[8]);
  const note = clean(r[9]) || null;
  const unlockDisplay = clean(r[10]);
  const canBeSold = toBool(r[11]);
  const inGame = toBool(r[12]);
  const name = clean(r[13]);
  const description = clean(r[14]);
  const price = toNum(r[15]);
  const moduleType = clean(r[16]) || null;
  const quality = toNum(r[17]);

  const unlockStation = stationIds.has(unlockDisplay) ? unlockDisplay : null;
  const blueprintGated = unlockDisplay === 'Blueprint';

  const isPlaceholder = PLACEHOLDER_NAMES.has(name) || (!moduleType && price === 0 && quality === 0);

  catalog.push({
    entityId, section: currentSection, rarity, name: name || entityId, description,
    moduleType, price, quality, unlockRules, lockRules, excludeFromRolls,
    isGenericStarter, canBeSold, inGame, note, unlockStation, blueprintGated, isPlaceholder,
  });
});

fs.writeFileSync(OUT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), stations, catalog }, null, 2));
console.log(`Scritte ${stations.length} stazioni e ${catalog.length} voci di catalogo in ${path.relative(process.cwd(), OUT_PATH)}`);
