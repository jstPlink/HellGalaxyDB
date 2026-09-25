// Legge i CSV "HS - Quests - *.csv" in data/ e produce data/quests.json:
// l'elenco delle missioni (da ManualQuestChains.csv) con capitolo, tipo,
// area, ricompense e numero di step, quest'ultimo calcolato incrociando
// ManualQuests.csv (il dettaglio granulare step-by-step, troppo tecnico per
// essere mostrato riga per riga: se ne usa solo il conteggio come indice di
// "lunghezza/complessità" della missione). Sola lettura, nessun DB.
//
// Uso: node scripts/build_quests_data.js
'use strict';
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const OUT_PATH = path.join(DATA_DIR, 'quests.json');

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

// Ricompone le righe fisiche in righe logiche (i campi tra virgolette possono
// contenere newline reali, es. ricompense o descrizioni multi-riga).
function parseCsvRows(text) {
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

function clean(s) { return String(s ?? '').replace(/\s+/g, ' ').trim(); }
function toBool(s) { return String(s ?? '').trim().toUpperCase() === 'TRUE'; }

/* ============================== 1. ManualQuests.csv -> conteggio step per QuestChainID ============================== */
const stepRows = parseCsvRows(fs.readFileSync(path.join(DATA_DIR, 'HS - Quests - ManualQuests.csv'), 'utf8'));
const stepCountByChain = {};
stepRows.slice(1).forEach(r => {
  const chainId = clean(r[0]);
  if (!chainId || chainId === 'QuestChainID') return;
  stepCountByChain[chainId] = (stepCountByChain[chainId] || 0) + 1;
});

/* ============================== 2. ManualQuestChains.csv (dati principali) ============================== */
const PLACEHOLDER = new Set(['[C]', '']);

function parseRewards(raw) {
  const tokens = String(raw ?? '').split(/\r?\n/).map(t => t.trim()).filter(Boolean);
  let credits = 0;
  const blueprints = [];
  const reputation = [];
  tokens.forEach(t => {
    let m;
    if ((m = t.match(/^CR_(\d+)$/))) { credits += Number(m[1]); return; }
    if ((m = t.match(/^BLPU_(.+)$/))) { blueprints.push(m[1]); return; }
    if ((m = t.match(/^(IAL|GAL|MAL)_(UP|DOWN)_(\d+)$/))) {
      const faction = { IAL: 'Iron', GAL: 'Gold', MAL: 'Malaxdon' }[m[1]];
      reputation.push({ faction, delta: (m[2] === 'UP' ? 1 : -1) * Number(m[3]) });
      return;
    }
    if (t) blueprints.push(t); // token non riconosciuto: lo teniamo comunque visibile
  });
  return { credits, blueprints, reputation };
}

function chapterOf(id) {
  let m = id.match(/^SY0(\d)Q/);
  if (m) return m[1];
  if (/^QMIN/.test(id)) return 'Mining';
  return 'Altro';
}

const chainRows = parseCsvRows(fs.readFileSync(path.join(DATA_DIR, 'HS - Quests - ManualQuestChains.csv'), 'utf8'));
const header = chainRows[0];
const quests = chainRows.slice(1).filter(r => clean(r[1])).map(r => {
  const id = clean(r[1]);
  const rewards = parseRewards(r[9]);
  const title = clean(r[10]);
  const motto = clean(r[11]);
  const description = clean(r[12]);
  return {
    id,
    giver: clean(r[0]),
    level: Number(clean(r[2])) || 1,
    repeatable: clean(r[3]) === 'Yes',
    lockConditions: clean(r[5]) || null,
    preRequisite: clean(r[6]) || null,
    title, motto, description,
    logic: clean(r[13]) || null,
    questGiverFaction: clean(r[14]) || null,
    label: clean(r[15]) || null,
    autoAccept: toBool(r[16]),
    autoTrack: toBool(r[17]),
    area: clean(r[22]) || null,
    chapter: chapterOf(id),
    credits: rewards.credits,
    blueprintRewards: rewards.blueprints,
    reputationRewards: rewards.reputation,
    stepCount: stepCountByChain[id] || 0,
    isPlaceholder: PLACEHOLDER.has(title) || PLACEHOLDER.has(description),
  };
});

fs.writeFileSync(OUT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), quests }, null, 2));
console.log(`Scritte ${quests.length} missioni in ${path.relative(process.cwd(), OUT_PATH)}`);
