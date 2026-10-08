// Controlli di qualità sui dati dell'app (SOLA LETTURA: non modifica niente, non tocca Unreal).
// Ogni controllo ritorna { code, severity: error|warn|info, title, hint, count, items: [id...] (max 40) }.
// Servono a vedere cosa va sistemato prima che i dati arrivino a Unreal (valori fuori elenco, chiavi mancanti, righe orfane).
'use strict';

const TYPES = ['Module', 'Consumable', 'Item', 'Collectable'];
const RARITIES = ['Salvage', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];
const BOOLS = ['TRUE', 'FALSE'];
const isNum = v => /^-?\d+(\.\d+)?$/.test(String(v ?? '').trim());
const MAX = 40;

// data: { entities:[json], modules:[json], modEff:{id:{StaticMesh:{v}}}, cargo:[json], items:[json], locKeys:Set|null, locEnglish:Map|null, links:{id:{tag}} }
function runChecks(data) {
  const out = [];
  const add = (code, severity, title, hint, ids) => { if (ids.length) out.push({ code, severity, title, hint, count: ids.length, items: ids.slice(0, MAX) }); };
  // valore effettivo (foglio, altrimenti letto da Unreal): un nome o un'icona presi da Unreal non sono "vuoti"
  const val = (e, k) => { const ef = data.entEff && data.entEff[e['(ID)']] && data.entEff[e['(ID)']][k]; return ef && ef.v !== undefined ? ef.v : e[k]; };
  const ents = data.entities, entIds = new Set(ents.map(e => e['(ID)']));
  const modIds = new Set(data.modules.map(m => m['(ID)'])), cargoIds = new Set(data.cargo.map(c => c['(ID)'])), itemIds = new Set(data.items.map(i => i['(ID)']));

  // --- ENTITIES: valori ammessi (Unreal li legge come elenchi chiusi: un valore sbagliato non viene scritto)
  add('ent-type', 'error', 'EntityType fuori elenco o vuoto', 'Valori ammessi: ' + TYPES.join(', '), ents.filter(e => !TYPES.includes(e.EntityType)).map(e => e['(ID)'] + ' = "' + (e.EntityType || '') + '"'));
  add('ent-rarity', 'error', 'BaseRarity fuori elenco o vuota', 'Valori ammessi: ' + RARITIES.join(', '), ents.filter(e => !RARITIES.includes(e.BaseRarity)).map(e => e['(ID)'] + ' = "' + (e.BaseRarity || '') + '"'));
  add('ent-price', 'error', 'BasePrice non numerico', 'Deve essere un numero', ents.filter(e => e.BasePrice !== '' && !isNum(e.BasePrice)).map(e => e['(ID)'] + ' = "' + e.BasePrice + '"'));
  add('ent-price-empty', 'warn', 'BasePrice vuoto', 'Unreal lascia il valore com\'è', ents.filter(e => e.BasePrice === '').map(e => e['(ID)']));
  add('ent-label', 'warn', 'Nome (Label) vuoto', 'Né nel foglio né in Unreal: l\'entità non avrà un nome in gioco', ents.filter(e => !String(val(e, 'Label') || '').trim()).map(e => e['(ID)']));
  add('ent-icon', 'warn', 'Entità senza icona', 'Né nel foglio né in Unreal', ents.filter(e => !String(val(e, 'Icon') || '').trim()).map(e => e['(ID)']));
  add('ent-spaces', 'warn', 'Spazi iniziali/finali in nome, ID o chiavi', 'Spesso invisibili: rompono i confronti', ents.filter(e => ['(ID)', 'Label', 'LabelKey', 'DescriptionKey', 'Icon'].some(k => String(e[k] || '') !== String(e[k] || '').trim())).map(e => e['(ID)']));

  // --- Localizzazione: chiavi presenti nel foglio Localization Master > Entities
  if (data.locKeys) {
    add('loc-label-key', 'warn', 'LabelKey assente nel Localization Master', 'La chiave non c\'è nel tab Entities del foglio di localizzazione', ents.filter(e => e.LabelKey && !data.locKeys.has(e.LabelKey)).map(e => e['(ID)'] + ' → ' + e.LabelKey));
    add('loc-desc-key', 'warn', 'DescriptionKey assente nel Localization Master', 'La chiave non c\'è nel tab Entities del foglio di localizzazione', ents.filter(e => e.DescriptionKey && !data.locKeys.has(e.DescriptionKey)).map(e => e['(ID)'] + ' → ' + e.DescriptionKey));
    add('loc-no-key', 'info', 'Entità senza LabelKey', 'Non collegate alla localizzazione', ents.filter(e => !e.LabelKey).map(e => e['(ID)']));
  }
  if (data.locEnglish) {
    add('loc-label-diff', 'warn', 'Nome diverso dal testo del Localization Master', 'Label ≠ ENGLISH della chiave (di norma sono collegati: una modifica li allinea)', ents.filter(e => e.LabelKey && data.locEnglish.has(e.LabelKey) && String(data.locEnglish.get(e.LabelKey)).trim() !== String(e.Label || '').trim()).map(e => e['(ID)']));
  }

  // --- Coerenza tra tab
  add('mod-no-entity', 'error', 'Righe in Modules senza entità', 'L\'ID non esiste in ENTITIES', data.modules.filter(m => !entIds.has(m['(ID)'])).map(m => m['(ID)']));
  add('cargo-no-entity', 'error', 'Righe in Cargo/Loot senza entità', 'L\'ID non esiste in ENTITIES', data.cargo.filter(c => !entIds.has(c['(ID)'])).map(c => c['(ID)']));
  add('item-no-entity', 'error', 'Righe in Items senza entità', 'L\'ID non esiste in ENTITIES', data.items.filter(i => !entIds.has(i['(ID)'])).map(i => i['(ID)']));
  add('ent-no-cargo', 'warn', 'Entità senza riga in Cargo/Loot', 'Non avranno CIDA_/LDA_ né i Blueprint CI_/BP_ACS_Loot_', ents.filter(e => !cargoIds.has(e['(ID)'])).map(e => e['(ID)']));
  add('module-no-row', 'info', 'Entità Module senza riga in Modules', 'Voluto per alcune (niente SMDA_/mesh): decisione dell\'utente', ents.filter(e => e.EntityType === 'Module' && !modIds.has(e['(ID)'])).map(e => e['(ID)']));
  add('type-mismatch', 'warn', 'Tipo entità incoerente con i tab', 'Es. Item senza riga in Items, o Module/Collectable che compaiono in Items', ents.filter(e => (e.EntityType === 'Item' && !itemIds.has(e['(ID)']) && !modIds.has(e['(ID)'])) || (itemIds.has(e['(ID)']) && e.EntityType !== 'Item')).map(e => e['(ID)'] + ' (' + e.EntityType + ')'));

  // --- Modules
  add('mod-no-mesh', 'warn', 'Moduli senza mesh', 'Né nel foglio né in Unreal (da assegnare)', data.modules.filter(m => { const ef = data.modEff && data.modEff[m['(ID)']]; return !(ef && ef.StaticMesh && ef.StaticMesh.v); }).map(m => m['(ID)']));

  // --- Cargo/Loot
  add('cargo-stack', 'error', 'StackValue non numerico', 'Deve essere un numero', data.cargo.filter(c => c.StackValue !== '' && !isNum(c.StackValue)).map(c => c['(ID)'] + ' = "' + c.StackValue + '"'));
  add('cargo-stack-empty', 'warn', 'StackValue vuoto', 'Unreal lascia il valore com\'è', data.cargo.filter(c => c.StackValue === '').map(c => c['(ID)']));
  add('cargo-bool', 'error', 'Attractable/ForceToInspect fuori elenco', 'Valori ammessi: TRUE, FALSE (o vuoto)', data.cargo.filter(c => ['Attractable', 'ForceToInspect'].some(k => c[k] !== undefined && c[k] !== '' && !BOOLS.includes(String(c[k]).toUpperCase()))).map(c => c['(ID)']));

  // --- Unreal (se i collegamenti sono stati letti)
  if (data.links && Object.keys(data.links).length) {
    add('unreal-zero', 'info', 'Entità con asset a 0 utilizzi in Unreal', 'Asset presenti ma non usati da niente (candidati alla pulizia)', ents.filter(e => data.links[e['(ID)']] && data.links[e['(ID)']].tag === 'zero-usi').map(e => e['(ID)']));
    add('unreal-none', 'info', 'Entità non presenti in Unreal', 'Nessun asset con questo ID (sarebbero create dal push)', ents.filter(e => data.links[e['(ID)']] && data.links[e['(ID)']].tag === 'non-in-unreal').map(e => e['(ID)']));
  }
  const order = { error: 0, warn: 1, info: 2 };
  out.sort((a, b) => order[a.severity] - order[b.severity] || b.count - a.count);
  return out;
}

module.exports = { runChecks, TYPES, RARITIES };
