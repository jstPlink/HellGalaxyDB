// Pulizia dei Data Asset inutili di Unreal (EDA_/CIDA_/LDA_/SMDA_/SIDA_ non collegati al foglio,
// copiati male, duplicati, di test). Due fasi:
//  1) findCandidates() + verifyReferences(): SOLA LETTURA. Elenca i candidati e per ognuno chi lo referenzia.
//  2) deleteAssets(): SCRIVE SU UNREAL. Disabilitata se HG_UE_ALLOW_WRITE !== '1' e richiede confirm:true.
//     Anche così, in Python ricontrolla i riferimenti e salta gli asset ancora usati.
// Mai check-in. Mai cancellazioni senza l'elenco verificato e la conferma esplicita dell'utente.
'use strict';
const fs = require('fs');
const path = require('path');
const bridge = require('./unreal_bridge');
const unrealRead = require('./unreal_read');

const BASE = '/Game/2_LOGIC/Entities/DataAssets';
const py = f => fs.readFileSync(path.join(__dirname, 'unreal', f), 'utf8').replace(/\s+$/, '');
const sub = f => (f ? '/' + f : '');
const itemFolderOf = sec => ({ BoostChargeGenerator: 'BoostCharger', AiAugmentationsSystem: 'AiAugmentationsSystem' }[sec] || sec);

// ids: { entities:Set, modules:Map(id->section), cargo:Set, items:Map(id->section) } dal database dell'app.
async function findCandidates(ids) {
  const cands = []; // { pkg, name, family, reason }
  const cache = { cargo: [], loots: [] };
  const add = (pkg, name, family, reason) => cands.push({ pkg, name, family, reason });

  const eda = (await unrealRead.readEntities()).items;
  for (const u of eda) {
    const id = u.asset.replace(/^EDA_/, '');
    if (!/^EDA_/.test(u.asset)) add(`${BASE}/Entities/${u.asset}`, u.asset, 'EDA', 'senza prefisso EDA_');
    else if (!ids.entities.has(id)) add(`${BASE}/Entities/${u.asset}`, u.asset, 'EDA', 'non è nel foglio ENTITIES');
  }
  const smda = (await unrealRead.readModules()).items;
  const seenSmda = new Map();
  smda.forEach(u => { const id = u.asset.replace(/^SMDA_/, ''); if (/^SMDA_/.test(u.asset)) (seenSmda.get(id) || seenSmda.set(id, []).get(id)).push(u); });
  for (const u of smda) {
    const pkg = `${BASE}/Modules${sub(u.folder)}/${u.asset}`;
    const id = u.asset.replace(/^SMDA_/, '');
    if (!/^SMDA_/.test(u.asset)) add(pkg, u.asset, 'SMDA', 'nomenclatura errata (senza SMDA_)');
    else if (!ids.modules.has(id)) add(pkg, u.asset, 'SMDA', 'non è nel tab Modules');
    else if (u.folder !== ids.modules.get(id) && seenSmda.get(id).some(x => x.folder === ids.modules.get(id))) add(pkg, u.asset, 'SMDA', `duplicato in cartella diversa dalla sezione (${u.folder}, sezione ${ids.modules.get(id)})`);
  }
  for (const [kind, prefix, fam, dir] of [['cargo', 'CIDA_', 'CIDA', 'CargoItems'], ['loots', 'LDA_', 'LDA', 'Loots']]) {
    const rd = await unrealRead.readTabAssets(kind);
    const items = rd.items;
    cache[kind] = items;
    for (const pkg of rd.unloadable) add(pkg, pkg.split('/').pop(), fam, 'non caricabile (classe C++ mancante o asset rotto)');
    for (const u of items) {
      const id = u.asset.replace(new RegExp('^' + prefix), '');
      const pkg = `${BASE}/${dir}${sub(u.folder)}/${u.asset}`;
      if (!u.asset.startsWith(prefix)) add(pkg, u.asset, fam, `senza prefisso ${prefix}`);
      else if (!ids.cargo.has(id)) add(pkg, u.asset, fam, 'non è nel tab CargoItemsAndLoots');
    }
  }
  const sidaRead = await unrealRead.readTabAssets('items');
  const sida = sidaRead.items;
  for (const pkg of sidaRead.unloadable) add(pkg, pkg.split('/').pop(), 'SIDA', 'non caricabile (classe C++ mancante o asset rotto)');
  const byId = new Map();
  sida.forEach(u => { const id = u.asset.replace(/^SIDA_/, ''); (byId.get(id) || byId.set(id, []).get(id)).push(u); });
  for (const u of sida) {
    const id = u.asset.replace(/^SIDA_/, '');
    const pkg = `${BASE}/Items${sub(u.folder)}/${u.asset}`;
    if (!/^SIDA_/.test(u.asset)) add(pkg, u.asset, 'SIDA', 'senza prefisso SIDA_');
    else if (!ids.items.has(id)) add(pkg, u.asset, 'SIDA', 'non è nel tab Items (asset di test o vecchio)');
    else if (u.folder !== itemFolderOf(ids.items.get(id)) && byId.get(id).some(x => x.folder === itemFolderOf(ids.items.get(id)))) add(pkg, u.asset, 'SIDA', `duplicato in cartella diversa (${u.folder}, sezione ${ids.items.get(id)})`);
  }
  // ID da cancellare su richiesta esplicita dell'utente (es. asset di test): tutti gli asset con quell'ID.
  const have = new Set(cands.map(c => c.pkg));
  for (const id of ids.extraDelete || []) {
    for (const u of eda) if (u.asset === 'EDA_' + id && !have.has(`${BASE}/Entities/${u.asset}`)) add(`${BASE}/Entities/${u.asset}`, u.asset, 'EDA', 'richiesto dall\'utente (test)');
    for (const u of smda) if (u.asset === 'SMDA_' + id && !have.has(`${BASE}/Modules${sub(u.folder)}/${u.asset}`)) add(`${BASE}/Modules${sub(u.folder)}/${u.asset}`, u.asset, 'SMDA', 'richiesto dall\'utente (test)');
    for (const u of sida) if (u.asset === 'SIDA_' + id && !have.has(`${BASE}/Items${sub(u.folder)}/${u.asset}`)) add(`${BASE}/Items${sub(u.folder)}/${u.asset}`, u.asset, 'SIDA', 'richiesto dall\'utente (test)');
    for (const [kind, prefix, fam, dir] of [['cargo', 'CIDA_', 'CIDA', 'CargoItems'], ['loots', 'LDA_', 'LDA', 'Loots']]) {
      for (const u of cache[kind]) if (u.asset === prefix + id && !have.has(`${BASE}/${dir}${sub(u.folder)}/${u.asset}`)) add(`${BASE}/${dir}${sub(u.folder)}/${u.asset}`, u.asset, fam, 'richiesto dall\'utente (test)');
    }
  }
  return cands;
}

async function verifyReferences(cands) {
  const pkgs = cands.map(c => c.pkg);
  const set = new Set(pkgs);
  const orphanBp = /\/Game\/2_LOGIC\/Entities\/BP\//;
  const info = {};
  for (let i = 0; i < pkgs.length; i += 120) {
    const chunk = pkgs.slice(i, i + 120);
    const code = `${py('refs_check.py')}\n\ncheck(${JSON.stringify(Buffer.from(JSON.stringify(chunk)).toString('base64'))})\n`;
    const r = await bridge.execPython(code, { timeoutMs: 120000 });
    if (!r.success) throw new bridge.UnrealError('Verifica riferimenti fallita: ' + (r.stderr || r.output).slice(0, 300));
    Object.assign(info, bridge.lastJsonLine(r.output));
  }
  return cands.map(c => {
    const d = info[c.pkg] || { class: '?', refs: [] };
    const other = d.refs.filter(x => !set.has(x));
    const bpOnly = other.length > 0 && other.every(x => orphanBp.test(x));
    return { ...c, class: d.class, redirectTo: d.redirect_to, refs: other, status: !other.length ? 'sicuro' : bpOnly ? 'solo-bp' : 'collegato' };
  });
}

async function deleteAssets(pkgs, { confirm } = {}) {
  if (process.env.HG_UE_ALLOW_WRITE !== '1') throw new bridge.UnrealError('Scrittura su Unreal disabilitata (HG_UE_ALLOW_WRITE non impostato).', 403, 'write_disabled');
  if (confirm !== true) throw new bridge.UnrealError('Cancellazione non confermata.', 400, 'not_confirmed');
  const out = { deleted: [], skipped: [], failed: [] };
  for (let i = 0; i < pkgs.length; i += 50) {
    const chunk = pkgs.slice(i, i + 50);
    const r = await bridge.execPython(`${py('delete_assets.py')}\n\ndelete(${JSON.stringify(Buffer.from(JSON.stringify(chunk)).toString('base64'))})\n`, { timeoutMs: 120000 });
    if (!r.success) throw new bridge.UnrealError('Cancellazione fallita: ' + (r.stderr || r.output).slice(0, 300));
    const o = bridge.lastJsonLine(r.output);
    out.deleted.push(...o.deleted); out.skipped.push(...o.skipped); out.failed.push(...o.failed);
  }
  return out;
}

module.exports = { findCandidates, verifyReferences, deleteAssets };
