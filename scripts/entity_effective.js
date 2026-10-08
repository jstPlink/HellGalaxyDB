// Valore "effettivo" delle entità: unisce i dati del foglio Google (colonne ENTITIES,
// salvate in entities.current/original) con quelli letti da Unreal (tabella entities_ue).
// Modalità M1 (docs/PIANO_PUSH_UNREAL.md §0): il foglio è il master; i dati non
// compilati correttamente si leggono da Unreal. Regole decise dall'utente:
//  - Label/BriefDescription: valore grezzo della cella; se vuoto o placeholder "[C]"
//    si usa il testo già presente nell'EDA_ di Unreal;
//  - Icon: solo immagini (Texture2D); in caso di contraddizione vale Unreal; materiali ignorati;
//  - ProducerIcon: la prima volta si compila da Unreal (ICN_producer_<sigla>); in caso di
//    contraddizione vale Unreal; se Unreal è vuoto vale il foglio;
//  - una modifica fatta nell'app (current diverso da original) vince sempre;
//  - tutti gli altri campi (tipo, rarità, prezzo…): vale il foglio, Unreal serve solo da confronto.
'use strict';

const EFFECTIVE_FIELDS = ['Label', 'BriefDescription', 'Icon', 'ProducerIcon'];

const s = v => (v === null || v === undefined) ? '' : String(v);
const usableText = v => s(v).trim() !== '' && !s(v).includes('[C]');

function producerSigla(obj) {
  const m = obj && /^ICN_producer_(.+)$/.exec(obj.name || '');
  return m ? m[1] : '';
}

// current/original: righe entities; ue: dati letti da Unreal (o null).
// Ritorna { Campo: { v, src } } con src = 'app' | 'sheet' | 'unreal'.
function effectiveEntity(current, original, ue) {
  const out = {};
  for (const f of EFFECTIVE_FIELDS) {
    const cur = s(current[f]);
    if (original && cur !== s(original[f])) { out[f] = { v: cur, src: 'app' }; continue; }
    let res = { v: cur, src: 'sheet' };
    if (ue) {
      if (f === 'Label' || f === 'BriefDescription') {
        const t = f === 'Label' ? ue.label : ue.brief;
        if (!usableText(cur) && usableText(t)) res = { v: t, src: 'unreal' };
      } else if (f === 'Icon') {
        if (ue.icon && ue.icon.class === 'Texture2D' && ue.icon.name !== cur) res = { v: ue.icon.name, src: 'unreal' };
      } else if (f === 'ProducerIcon') {
        const sg = producerSigla(ue.producer_icon);
        if (sg && sg !== cur) res = { v: sg, src: 'unreal' };
      }
    }
    out[f] = res;
  }
  return out;
}

// Confronto completo per il report "Leggi da Unreal". rows: righe entities (current/original);
// ueItems: elenco letto da Unreal. Non scrive nulla.
function compareWithUnreal(rows, ueItems) {
  const ueById = new Map();
  for (const u of ueItems) ueById.set(u.asset.replace(/^EDA_/, ''), u);
  const rep = {
    readInUnreal: ueItems.length, inApp: rows.length, matched: 0,
    fills: { Label: 0, BriefDescription: 0, Icon: 0, ProducerIcon: 0 },
    fillSamples: {}, contradictions: { Icon: [], ProducerIcon: [] },
    iconNotImage: [], noIcon: [], producerNotStandard: [], missingInUnreal: [], onlyInUnreal: [],
    sheetVsUnreal: { entity_type: [], rarity: [], base_price: [], label: [], brief: [] },
  };
  for (const r of rows) {
    const id = r['(ID)'];
    const u = ueById.get(id);
    if (!u) { rep.missingInUnreal.push(id); continue; }
    rep.matched++;
    const eff = effectiveEntity(r, null, u);
    for (const f of EFFECTIVE_FIELDS) {
      if (eff[f].src === 'unreal') {
        rep.fills[f]++;
        (rep.fillSamples[f] = rep.fillSamples[f] || []).length < 12 && rep.fillSamples[f].push(`${id}: "${s(r[f])}" → "${eff[f].v}"`);
        if (f === 'Icon' && s(r.Icon) !== '') rep.contradictions.Icon.push(`${id}: foglio ${r.Icon} / Unreal ${eff.Icon.v}`);
        if (f === 'ProducerIcon' && s(r.ProducerIcon) !== '') rep.contradictions.ProducerIcon.push(`${id}: foglio ${r.ProducerIcon} / Unreal ${eff.ProducerIcon.v}`);
      }
    }
    if (!u.icon) rep.noIcon.push(id);
    else if (u.icon.class !== 'Texture2D') rep.iconNotImage.push(`${id} (${u.icon.class}: ${u.icon.name})`);
    if (u.producer_icon && !producerSigla(u.producer_icon)) rep.producerNotStandard.push(`${id}: ${u.producer_icon.name}`);
    const cmp = (key, a, b) => { if (s(a) !== '' && s(a) !== s(b)) rep.sheetVsUnreal[key].push(`${id}: foglio "${s(a)}" / Unreal "${s(b)}"`); };
    cmp('entity_type', r.EntityType, u.entity_type);
    cmp('rarity', r.BaseRarity, u.rarity);
    if (s(r.BasePrice) !== '' && Number(r.BasePrice) !== Number(u.base_price)) rep.sheetVsUnreal.base_price.push(`${id}: foglio ${r.BasePrice} / Unreal ${u.base_price}`);
    if (usableText(r.Label) && s(r.Label) !== s(u.label)) rep.sheetVsUnreal.label.push(`${id}: foglio "${s(r.Label)}" / Unreal "${s(u.label)}"`);
    if (usableText(r.BriefDescription) && s(r.BriefDescription) !== s(u.brief)) rep.sheetVsUnreal.brief.push(`${id}: foglio "${s(r.BriefDescription).slice(0, 60)}" / Unreal "${s(u.brief).slice(0, 60)}"`);
  }
  const appIds = new Set(rows.map(r => r['(ID)']));
  rep.onlyInUnreal = ueItems.map(u => u.asset).filter(n => !appIds.has(n.replace(/^EDA_/, ''))).sort();
  return rep;
}

module.exports = { EFFECTIVE_FIELDS, effectiveEntity, compareWithUnreal, producerSigla, usableText };
