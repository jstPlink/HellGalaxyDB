// Legge i CSV "HS - Enemies - *.csv" in data/ e produce data/enemies.json,
// un elenco pulito di nemici (uno per NPC individuale) con stat, arma e abilità,
// usato dalla tab "Enemies" del tool (sola lettura, nessun DB).
//
// Uso: node scripts/build_enemies_data.js
'use strict';
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const OUT_PATH = path.join(DATA_DIR, 'enemies.json');

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.length > 0);
  const rows = lines.map(parseCsvLine);
  const header = rows[0];
  return rows.slice(1).map(cols => {
    const obj = {};
    header.forEach((h, i) => { obj[h.trim()] = (cols[i] ?? '').trim(); });
    return obj;
  });
}

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

function splitList(s) {
  if (!s) return [];
  return s.split(',').map(x => x.trim()).filter(Boolean);
}

function toNum(s) {
  const n = Number(String(s ?? '').trim());
  return Number.isFinite(n) ? n : 0;
}

function toBool(s) {
  return String(s ?? '').trim().toUpperCase() === 'TRUE';
}

function readCsv(filename) {
  const p = path.join(DATA_DIR, filename);
  return parseCsv(fs.readFileSync(p, 'utf8'));
}

/* ---------- weapon class detection ---------- */
function detectWeaponTags(text) {
  const t = (text || '').toLowerCase();
  const tags = [];
  if (t.includes('gatling')) tags.push('Gatling');
  if (t.includes('laser')) tags.push('Laser');
  if (t.includes('razzi') || t.includes('rocket') || t.includes('missil')) tags.push('Rocket');
  if (t.includes('shotgun')) tags.push('Shotgun');
  return tags;
}

/* ============================== 1. Association.csv (roster) ============================== */
const assocRows = readCsv('HS - Enemies - Association.csv');
const enemyMap = new Map(); // id -> enemy object (later rows override earlier, per NPC id)

assocRows.forEach(row => {
  const groupRaw = row['AssociatedNPC'];
  const ids = splitList(groupRaw);
  if (!ids.length || !row['RuleId']) return;
  const enemy = {
    ruleId: row['RuleId'],
    group: ids,
    tier: toNum(row['Base Tier']),
    integrity: toNum(row['Integrity']),
    shield: toNum(row['Shield']),
    damagePrimary: toNum(row['Damage med']),
    damageSecondary: toNum(row['Damage Secondary med']),
    accuracy: toNum(row['Accuracy Primary']),
    attackRate: toNum(row['Primary Attack rate']),
    dps: toNum(row['DPS med']),
    inGame: toBool(row['InGame']),
    isBoss: toBool(row['IsBoss']),
  };
  enemy.ehp = enemy.integrity + enemy.shield;
  ids.forEach(id => {
    enemyMap.set(id, { id, ...enemy, group: ids });
  });
});

/* ============================== 2. EnemyWeapons.csv ============================== */
const weaponRows = readCsv('HS - Enemies - EnemyWeapons.csv');
const weaponsByNpc = new Map(); // id -> {loadout:[], flavor:Set, fireRate}

let lastWeaponIds = [];
weaponRows.forEach(row => {
  const groupRaw = row['AssociatedNPC'];
  if (groupRaw && groupRaw.trim()) lastWeaponIds = splitList(groupRaw);
  if (!lastWeaponIds.length) return;

  const pWeapon = row['P Weapon'];
  const flavor = row['P Flavor'];
  const fireRate = toNum(row['P FireRate']);
  const sWeapon = row['S Weapon'];
  const hasPrimary = pWeapon && pWeapon.trim() && pWeapon.trim() !== '//';
  const hasSecondary = sWeapon && sWeapon.trim() && sWeapon.trim() !== '//';
  if (!hasPrimary && !hasSecondary && !flavor && !fireRate) return;

  lastWeaponIds.forEach(id => {
    let w = weaponsByNpc.get(id);
    if (!w) { w = { loadout: [], flavor: new Set(), fireRate: 0 }; weaponsByNpc.set(id, w); }
    if (hasPrimary) w.loadout.push(pWeapon.trim());
    if (hasSecondary) w.loadout.push(sWeapon.trim());
    detectWeaponTags(flavor).forEach(t => w.flavor.add(t));
    if (fireRate > w.fireRate) w.fireRate = fireRate;
  });
});

/* ============================== 3. AbilitiesAssociation.csv ============================== */
const abilityRows = readCsv('HS - Enemies - AbilitiesAssociation.csv');
const abilitiesByNpc = new Map(); // id -> [{name, cooldown, cooldownToAttackAgain, priority}]

let lastAbilityIds = [];
abilityRows.forEach(row => {
  const groupRaw = row['Enemy'];
  if (groupRaw && groupRaw.trim()) lastAbilityIds = splitList(groupRaw);
  const abilityName = row['Ability'];
  if (!abilityName || !abilityName.trim() || !lastAbilityIds.length) return;
  const entry = {
    name: abilityName.trim(),
    priority: toNum(row['Priority']),
    cooldown: row['Cooldown'] ? toNum(row['Cooldown']) : null,
    cooldownToAttack: row['Cooldown to attack again'] ? toNum(row['Cooldown to attack again']) : null,
  };
  lastAbilityIds.forEach(id => {
    if (!abilitiesByNpc.has(id)) abilitiesByNpc.set(id, []);
    abilitiesByNpc.get(id).push(entry);
  });
});

/* ============================== merge ============================== */
const enemies = Array.from(enemyMap.values()).map(e => {
  const w = weaponsByNpc.get(e.id);
  const abilities = abilitiesByNpc.get(e.id) || [];
  const weaponTags = w ? Array.from(w.flavor) : [];
  return {
    ...e,
    weaponClass: weaponTags[0] || 'N/D',
    weaponTags,
    weaponLoadout: w ? Array.from(new Set(w.loadout)) : [],
    abilities,
    threatIndex: Math.round(Math.sqrt(e.ehp * Math.max(e.dps, 1))),
  };
});

enemies.sort((a, b) => b.threatIndex - a.threatIndex);

fs.writeFileSync(OUT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), enemies }, null, 2));
console.log(`Scritti ${enemies.length} nemici in ${path.relative(process.cwd(), OUT_PATH)}`);
