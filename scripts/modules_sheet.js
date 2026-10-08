// Tab "Modules" del foglio Google: parsing a sezioni, confronto col DB, valori effettivi
// (foglio + dati letti da Unreal) e confronto foglio <-> Unreal per i moduli.
//
// Il tab ha una riga di intestazione PER SEZIONE ("MainBody (ID)", "MainEngine (ID)", ...)
// seguita dalle righe dei moduli di quella sezione. Ogni sezione ha colonne proprie.
// Il flusso Python di Unreal riconosce le sezioni per posizione; qui la sezione è un
// campo esplicito di ogni riga (__section).
//
// Importazione "esatta": si conserva ogni cella non vuota. Le celle sotto un'intestazione
// vuota finiscono in chiavi "#<lettera colonna>" (es. "#BE"); le intestazioni duplicate
// nella stessa sezione ricevono un suffisso "#2".
'use strict';
const { cellToString, sameValue } = require('./sheet_mappings');

const ID_KEY = '(ID)';
const SECTION_KEY = '__section';

function colLetter(i) {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

// rows2d: matrice di stringhe (da parseCsv). Ritorna { sections, rows, ignored }.
function parseModulesTab(rows2d, opts) {
  const sections = [], rows = [];
  let cur = null, ignored = 0;
  for (const r of rows2d) {
    const first = cellToString(r[0]).trim();
    if (/\(ID\)\s*$/.test(first)) {
      const headers = [];
      const seen = {};
      r.forEach((h, i) => {
        h = cellToString(h).trim();
        if (i === 0 || h === '') { headers.push(''); return; }
        seen[h] = (seen[h] || 0) + 1;
        headers.push(seen[h] > 1 ? `${h}#${seen[h]}` : h);
      });
      cur = { name: first.replace(/\s*\(ID\)\s*$/, '') || (opts && opts.defaultSection) || '', headers, order: sections.length };
      sections.push(cur);
      continue;
    }
    if (!first) { if (r.some(c => cellToString(c) !== '')) ignored++; continue; }
    if (!cur) { ignored++; continue; }
    const row = { [ID_KEY]: first, [SECTION_KEY]: cur.name };
    for (let i = 1; i < r.length; i++) {
      const v = cellToString(r[i]);
      if (cur.headers[i]) row[cur.headers[i]] = v;
      else if (v !== '') row['#' + colLetter(i)] = v;
    }
    // le intestazioni senza valore restano comunque presenti (vuote) per avere colonne stabili
    cur.headers.forEach(h => { if (h && !(h in row)) row[h] = ''; });
    rows.push(row);
  }
  // elimina intestazioni vuote finali e le colonne "#" da trattare come extra
  sections.forEach(s => { let l = s.headers.length; while (l > 0 && s.headers[l - 1] === '') l--; s.headers = s.headers.slice(0, l); });
  return { sections, rows, ignored };
}

// ---- diff foglio <-> DB (stessa logica dell'importazione delle entità, campi dinamici) ----
function diffModules(dbRows, sheetRows) {
  const byId = new Map(dbRows.map(r => [r.id, r]));
  const sheetIds = new Set();
  const report = { added: [], changed: [], conflicts: [], missingInSheet: [], unchanged: 0 };
  const plan = { insert: [], update: [] };
  for (const s of sheetRows) {
    const id = s[ID_KEY];
    sheetIds.add(id);
    const db = byId.get(id);
    if (!db) { report.added.push(id); plan.insert.push(s); continue; }
    const keys = new Set([...Object.keys(s), ...Object.keys(db.original)]);
    const fields = [...keys].filter(k => !sameValue(s[k], db.original[k]));
    if (!fields.length) { report.unchanged++; continue; }
    const newCurrent = { ...db.current };
    for (const f of fields) {
      if (sameValue(db.current[f], db.original[f])) { if (f in s) newCurrent[f] = s[f]; else delete newCurrent[f]; }
      else report.conflicts.push({ id, field: f, sheet: s[f], local: db.current[f] });
    }
    report.changed.push({ id, fields });
    plan.update.push({ id, original: s, current: newCurrent });
  }
  for (const r of dbRows) if (!sheetIds.has(r.id)) report.missingInSheet.push(r.id);
  return { report, plan };
}

// ---- valori effettivi ----
const s_ = v => (v === null || v === undefined) ? '' : String(v);

// current/original: righe modules_sheet; ue: SMDA letto da Unreal (o null); entityIcon: icona effettiva dell'entità omonima.
// Regole (decise dall'utente 2026-10-07): mesh e shield mesh dagli SMDA_ (la colonna StaticMesh del foglio è vuota);
// Quality: vale Unreal, tranne quando in Unreal vale 10 (= modulo non usato, valore irrilevante) → foglio;
// una modifica fatta nell'app vince; immagine = icona dell'entità (solo Texture2D).
function effectiveModule(current, original, ue, entityIcon) {
  const out = {};
  const edited = k => original && s_(current[k]) !== s_(original[k]);
  // StaticMesh
  if (edited('StaticMesh')) out.StaticMesh = { v: s_(current.StaticMesh), src: 'app' };
  else if (s_(current.StaticMesh) !== '') out.StaticMesh = { v: s_(current.StaticMesh), src: 'sheet' };
  else if (ue && ue.static_mesh && ue.static_mesh.name) out.StaticMesh = { v: ue.static_mesh.name, src: 'unreal' };
  else out.StaticMesh = { v: '', src: 'sheet' };
  // ShieldStaticMesh (solo Unreal: il foglio non ha la colonna)
  out.ShieldStaticMesh = (ue && ue.shield_static_mesh && ue.shield_static_mesh.name)
    ? { v: ue.shield_static_mesh.name, src: 'unreal' } : { v: '', src: 'sheet' };
  // Quality
  if (edited('Quality')) out.Quality = { v: s_(current.Quality), src: 'app' };
  else if (ue && ue.quality !== null && ue.quality !== undefined && Number(ue.quality) !== 10 && String(Number(ue.quality)) !== s_(current.Quality).trim()) out.Quality = { v: String(Number(ue.quality)), src: 'unreal' };
  else out.Quality = { v: s_(current.Quality), src: 'sheet' };
  // Icona (dall'entità)
  out.Icon = entityIcon ? { v: entityIcon.v, src: entityIcon.src } : { v: '', src: 'sheet' };
  return out;
}

const NUMERIC_COLUMNS = {
  PowerConsumption: 'power_consumption', Quality: 'quality', BoosterSpeedMultiplier: 'booster_speed_multiplier',
  StressDriveSpeedMultiplier: 'stress_drive_speed_multiplier', HullIntegrity: 'hull_integrity', MaxSpeed: 'max_speed',
  StressDriveStamina: 'stress_drive_stamina', FuelCapacity: 'fuel_capacity', FuelConsumption: 'fuel_consumption',
  StressDriveFuelConsumption: 'stress_drive_fuel_consumption', SpeedIncrement: 'speed_increment',
  StressDriveStaminaConsumption: 'stress_drive_stamina_consumption', BoostChargeConsumption: 'boost_charge_consumption',
  AmmoMagazineSize: 'ammo_magazine_size', Rate: 'rate', ChargeTime: 'charge_time', BaseDamageMin: 'base_damage_min',
  BaseDamageMax: 'base_damage_max', ProjectileSpeed: 'projectile_speed', ProjectileAccuracy: 'projectile_accuracy',
  ProjectileRange: 'projectile_range', HeatGeneration: 'heat_generation', SlotNumber: 'slot_number',
  LiquidFuelCapacity: 'liquid_fuel_capacity', Range: 'range', RotationSpeed: 'rotation_speed', Speed: 'speed',
  HullDamage: 'hull_damage', ShieldDamage: 'shield_damage', OrganicDamage: 'organic_damage', GhostDamage: 'ghost_damage',
  AttractionRange: 'attraction_range',
};
const BOOL_COLUMNS = { Incorporated: 'incorporated', RotableStructure: 'rotable_structure' };

// Confronto completo per il report "Leggi da Unreal" dei moduli. ueItems: SMDA letti. Non scrive nulla.
function compareModulesWithUnreal(rows, ueItems, entityIconById) {
  const bySection = {};
  const smda = new Map(), legacy = [], duplicates = [];
  for (const u of ueItems) {
    if (!/^SMDA_/.test(u.asset)) { legacy.push(u.asset); continue; }
    const id = u.asset.replace(/^SMDA_/, '');
    if (smda.has(id)) { duplicates.push(`${u.asset}: ${smda.get(id).folder} / ${u.folder}`); continue; }
    smda.set(id, u);
  }
  // in caso di duplicati si preferisce l'asset nella cartella della sezione del foglio
  for (const u of ueItems) {
    if (!/^SMDA_/.test(u.asset)) continue;
    const id = u.asset.replace(/^SMDA_/, '');
    const row = rows.find(r => r[ID_KEY] === id);
    if (row && u.folder === row[SECTION_KEY]) smda.set(id, u);
  }
  const rep = {
    readInUnreal: ueItems.length, inApp: rows.length, matched: 0,
    fills: { StaticMesh: 0, ShieldStaticMesh: 0, Quality: 0 },
    noMesh: [], missingInUnreal: [], onlyInUnreal: [], legacy, duplicates,
    qualityDiff: [], qualityUnused: [], statDiff: {}, statDiffSamples: [], folderMismatch: [],
  };
  const ids = new Set(rows.map(r => r[ID_KEY]));
  for (const r of rows) {
    const id = r[ID_KEY], u = smda.get(id);
    if (!u) { rep.missingInUnreal.push(id); continue; }
    rep.matched++;
    const ef = effectiveModule(r, null, u, entityIconById ? entityIconById[id] : null);
    ['StaticMesh', 'ShieldStaticMesh', 'Quality'].forEach(f => { if (ef[f].src === 'unreal') rep.fills[f]++; });
    if (!u.static_mesh) rep.noMesh.push(id);
    if (u.quality !== null && u.quality !== undefined && s_(r.Quality) !== '' && Number(u.quality) !== Number(r.Quality)) {
      (Number(u.quality) === 10 ? rep.qualityUnused : rep.qualityDiff).push(`${id}: foglio ${r.Quality} / Unreal ${u.quality}`);
    }
    if (u.folder !== r[SECTION_KEY]) rep.folderMismatch.push(`${id}: foglio ${r[SECTION_KEY]} / cartella Unreal ${u.folder}`);
    const p = u.props || {};
    for (const [col, prop] of Object.entries(NUMERIC_COLUMNS)) {
      if (col === 'Quality' || !(col in r) || s_(r[col]) === '' || !(prop in p) || p[prop] === null) continue;
      const a = Number(r[col]), b = Number(p[prop]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      if (Math.abs(a - b) > 1e-6 * Math.max(1, Math.abs(a))) {
        rep.statDiff[col] = (rep.statDiff[col] || 0) + 1;
        if (rep.statDiffSamples.length < 60) rep.statDiffSamples.push(`${id}.${col}: foglio ${r[col]} / Unreal ${p[prop]}`);
      }
    }
    for (const [col, prop] of Object.entries(BOOL_COLUMNS)) {
      if (!(col in r) || s_(r[col]) === '' || !(prop in p) || p[prop] === null) continue;
      if ((String(r[col]).toUpperCase() === 'TRUE') !== !!p[prop]) { rep.statDiff[col] = (rep.statDiff[col] || 0) + 1; rep.statDiffSamples.length < 60 && rep.statDiffSamples.push(`${id}.${col}: foglio ${r[col]} / Unreal ${p[prop]}`); }
    }
  }
  rep.onlyInUnreal = [...smda.keys()].filter(id => !ids.has(id)).map(id => 'SMDA_' + id).sort();
  return rep;
}

module.exports = { ID_KEY, SECTION_KEY, colLetter, parseModulesTab, diffModules, effectiveModule, compareModulesWithUnreal, NUMERIC_COLUMNS };
