// Tab "CargoItemsAndLoots" e "Items" del foglio Google: configurazione, valori effettivi
// (foglio + dati letti da Unreal) e confronto foglio <-> Unreal. Logica pura, senza I/O.
//
//  - cargo: tabella piatta (una intestazione "(ID)") -> CIDA_<ID> (StackValue) e LDA_<ID>
//           (Attractable, ForceToInspect, LootStaticMesh0..6).
//  - items: tab a sezioni ("SecondaryEngine (ID)", ...) -> SIDA_<ID>.
// Regole (decise dall'utente 2026-10-07): foglio = master; mesh e quality dagli asset di Unreal
// (vale Unreal; Quality 10 = non usato -> foglio); per ogni altro campo solo confronto.
'use strict';
const { sameValue } = require('./sheet_mappings');
const { ID_KEY, SECTION_KEY } = require('./modules_sheet');

const TABS = {
  cargo: { key: 'cargo', title: 'CARGO/LOOT', sheetName: 'CargoItemsAndLoots', gidEnv: 'HG_SHEET_CARGO_GID', urlEnv: 'HG_SHEET_CARGO_URL', mockEnv: 'HG_SHEET_MOCK_CARGO_CSV', defaultSection: 'CargoItemsAndLoots', unreal: ['cargo', 'loots'] },
  items: { key: 'items', title: 'ITEMS', sheetName: 'Items', gidEnv: 'HG_SHEET_ITEMS_GID', urlEnv: 'HG_SHEET_ITEMS_URL', mockEnv: 'HG_SHEET_MOCK_ITEMS_CSV', defaultSection: 'Items', unreal: ['items'] },
};

const s_ = v => (v === null || v === undefined) ? '' : String(v);
const snake = str => str.replace(/(.)([A-Z][a-z]+)/g, '$1_$2').replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
const isTrue = v => s_(v).trim().toUpperCase() === 'TRUE' || s_(v).trim().toUpperCase() === 'VERO';
const MESH_COLS = [0, 1, 2, 3, 4, 5, 6].map(i => 'LootStaticMesh' + i);

// ue: { cida, lda, sida } letti da Unreal per quell'ID (campi mancanti = null).
function effectiveRow(tab, current, original, ue) {
  const out = {};
  const edited = k => original && s_(current[k]) !== s_(original[k]);
  if (tab === 'cargo') {
    MESH_COLS.forEach((c, i) => {
      if (edited(c)) out[c] = { v: s_(current[c]), src: 'app' };
      else if (s_(current[c]) !== '') out[c] = { v: s_(current[c]), src: 'sheet' };
      else {
        const m = ue && ue.lda && ue.lda.loot_static_mesh && ue.lda.loot_static_mesh[i];
        out[c] = m ? { v: m, src: 'unreal' } : { v: '', src: 'sheet' };
      }
    });
  } else {
    const q = ue && ue.sida ? ue.sida.quality : null;
    if (edited('Quality')) out.Quality = { v: s_(current.Quality), src: 'app' };
    else if (q !== null && q !== undefined && Number(q) !== 10 && String(Number(q)) !== s_(current.Quality).trim()) out.Quality = { v: String(Number(q)), src: 'unreal' };
    else out.Quality = { v: s_(current.Quality), src: 'sheet' };
  }
  return out;
}

const numDiff = (a, b) => Math.abs(a - b) > 1e-6 * Math.max(1, Math.abs(a));

// rows: righe del DB (current); ueByKind: { cargo:[...], loots:[...], items:[...] } (SOLO quelli del tab).
function compareWithUnreal(tab, rows, ueByKind) {
  const rep = { tab, inApp: rows.length, matched: 0, missing: {}, orphans: {}, fills: {}, diffs: {}, samples: [], extra: {} };
  const ids = new Set(rows.map(r => r[ID_KEY]));
  const idx = (arr, prefix) => { const m = new Map(), dups = []; for (const u of arr || []) { if (!u.asset.startsWith(prefix)) { (rep.extra.legacy = rep.extra.legacy || []).push(u.asset); continue; } const id = u.asset.slice(prefix.length); if (m.has(id)) dups.push(u.asset + ': ' + m.get(id).folder + ' / ' + u.folder); else m.set(id, u); } return { m, dups }; };
  const note = s => { if (rep.samples.length < 80) rep.samples.push(s); };
  const bump = (k, n = 1) => { rep.diffs[k] = (rep.diffs[k] || 0) + n; };
  if (tab === 'cargo') {
    const c = idx(ueByKind.cargo, 'CIDA_'), l = idx(ueByKind.loots, 'LDA_');
    rep.readInUnreal = { CIDA: (ueByKind.cargo || []).length, LDA: (ueByKind.loots || []).length };
    rep.missing = { CIDA: [], LDA: [] };
    rep.fills = { LootStaticMesh: 0 };
    rep.extra.duplicates = [...c.dups, ...l.dups];
    rep.extra.cantBeSold = [];
    rep.extra.lootWithMeshes = 0;
    for (const r of rows) {
      const id = r[ID_KEY], cida = c.m.get(id), lda = l.m.get(id);
      if (!cida) rep.missing.CIDA.push(id);
      if (!lda) rep.missing.LDA.push(id);
      if (cida || lda) rep.matched++;
      if (cida) {
        if (s_(r.StackValue) !== '' && cida.stack_value !== null && Number(r.StackValue) !== Number(cida.stack_value)) { bump('StackValue'); note(`${id}.StackValue: foglio ${r.StackValue} / Unreal ${cida.stack_value}`); }
        if (cida.can_be_sold === false) rep.extra.cantBeSold.push(id);
      }
      if (lda) {
        for (const [col, key] of [['Attractable', 'attractable'], ['ForceToInspect', 'force_to_inspect']]) {
          if (s_(r[col]) !== '' && lda[key] !== null && isTrue(r[col]) !== !!lda[key]) { bump(col); note(`${id}.${col}: foglio ${r[col]} / Unreal ${lda[key]}`); }
        }
        const meshes = (lda.loot_static_mesh || []).filter(Boolean);
        if (meshes.length) rep.extra.lootWithMeshes++;
        MESH_COLS.forEach((col, i) => { if (s_(r[col]) === '' && lda.loot_static_mesh && lda.loot_static_mesh[i]) rep.fills.LootStaticMesh++; });
        MESH_COLS.forEach((col, i) => { if (s_(r[col]) !== '' && lda.loot_static_mesh && lda.loot_static_mesh[i] && lda.loot_static_mesh[i] !== r[col]) { bump('LootStaticMesh'); note(`${id}.${col}: foglio ${r[col]} / Unreal ${lda.loot_static_mesh[i]}`); } });
      }
    }
    rep.orphans = { CIDA: [...c.m.keys()].filter(i => !ids.has(i)).map(i => 'CIDA_' + i).sort(), LDA: [...l.m.keys()].filter(i => !ids.has(i)).map(i => 'LDA_' + i).sort() };
  } else {
    const it = idx(ueByKind.items, 'SIDA_');
    rep.readInUnreal = { SIDA: (ueByKind.items || []).length };
    rep.missing = { SIDA: [] };
    rep.fills = { Quality: 0 };
    rep.extra.duplicates = it.dups;
    rep.extra.sectionMismatch = [];
    // alias cartelle (come BlueprintSwitch/NormalizeItemFolder del flusso Google)
    const folderOf = sec => ({ BoostChargeGenerator: 'BoostCharger' }[sec] || sec);
    for (const r of rows) {
      const id = r[ID_KEY], u = it.m.get(id);
      if (!u) { rep.missing.SIDA.push(id); continue; }
      rep.matched++;
      const ef = effectiveRow('items', r, null, { sida: u });
      if (ef.Quality.src === 'unreal') rep.fills.Quality++;
      if (u.folder !== folderOf(r[SECTION_KEY])) rep.extra.sectionMismatch.push(`${id}: foglio ${r[SECTION_KEY]} / cartella Unreal ${u.folder}`);
      const p = u.props || {};
      for (const k of Object.keys(r)) {
        if (k === ID_KEY || k === SECTION_KEY || k === 'ItemType' || k[0] === '#') continue;
        const prop = snake(k);
        if (!(prop in p) || s_(r[k]) === '') continue;
        if (k === 'Quality') { if (Number(p[prop]) !== 10 && numDiff(Number(r[k]), Number(p[prop]))) { bump('Quality'); note(`${id}.Quality: foglio ${r[k]} / Unreal ${p[prop]}`); } continue; }
        if (typeof p[prop] === 'boolean') { if (isTrue(r[k]) !== p[prop]) { bump(k); note(`${id}.${k}: foglio ${r[k]} / Unreal ${p[prop]}`); } continue; }
        const a = Number(r[k]);
        if (Number.isFinite(a) && numDiff(a, Number(p[prop]))) { bump(k); note(`${id}.${k}: foglio ${r[k]} / Unreal ${p[prop]}`); }
      }
    }
    rep.orphans = { SIDA: [...it.m.keys()].filter(i => !ids.has(i)).map(i => 'SIDA_' + i).sort() };
  }
  return rep;
}

module.exports = { TABS, MESH_COLS, effectiveRow, compareWithUnreal, snake, ID_KEY, SECTION_KEY };
