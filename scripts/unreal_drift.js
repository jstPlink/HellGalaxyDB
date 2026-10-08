// Verifica "l'app era sincronizzata con Unreal?" (SOLA LETTURA su Unreal), da fare PRIMA di aggiornare Unreal.
// Confronta lo stato attuale di Unreal con l'ultima fotografia salvata nell'app (tabelle entities_ue per gli EDA_,
// modules_ue per gli SMDA_, create con "Salva questi dati nell'app"). Se qualcuno ha cambiato Unreal dopo l'ultima
// lettura, l'aggiornamento potrebbe sovrascrivere quelle modifiche: l'app lo segnala e non procede senza conferma.
// Non è un confronto app↔Unreal (quello è "Sincronizza Unreal"): le modifiche fatte nell'app NON sono "deriva".
'use strict';
const unrealRead = require('./unreal_read');

const MAX_LIST = 200;
const nm = o => (o && typeof o === 'object' ? (o.name || '') : (o == null ? '' : String(o)));
const str = v => (v == null ? '' : String(v));

const entityView = u => ({ label: str(u.label), brief: str(u.brief), entity_type: str(u.entity_type), rarity: str(u.rarity), base_price: str(u.base_price), icon: nm(u.icon), producer_icon: nm(u.producer_icon) });
const moduleView = u => ({ static_mesh: nm(u.static_mesh), shield_static_mesh: nm(u.shield_static_mesh), quality: str(u.quality), module_type: str(u.module_type), props: JSON.stringify(u.props || {}) });

function diffMaps(saved, fresh, view, onlyStored) {
  const changed = [], added = [], removed = [];
  for (const [key, s] of saved) {
    const f = fresh.get(key);
    if (!f) { removed.push(key); continue; }
    const a = view(s), b = view(f), fields = [];
    for (const k of Object.keys(a)) if (a[k] !== b[k]) fields.push({ f: k, app: k === 'props' ? '(statistiche)' : a[k], unreal: k === 'props' ? '(statistiche)' : b[k] });
    if (fields.length) changed.push({ asset: key, fields });
  }
  if (!onlyStored) for (const key of fresh.keys()) if (!saved.has(key)) added.push(key);
  return { changed, added, removed };
}

// db: handle SQLite dell'app. Ritorna { ok, total, baseline, entities, modules, checkedAt }.
async function check(db, { timeoutMs = 120000 } = {}) {
  const savedE = new Map(db.prepare('SELECT id, data_json FROM entities_ue').all().map(r => { const d = JSON.parse(r.data_json); return [d.asset || ('EDA_' + r.id), d]; }));
  const savedM = new Map(db.prepare('SELECT id, data_json FROM modules_ue').all().map(r => { const d = JSON.parse(r.data_json); return [(d.asset || r.id) + '|' + (d.folder || ''), d]; }));
  const baseline = savedE.size > 0 || savedM.size > 0;
  const ents = await unrealRead.readEntities({ timeoutMs });
  const mods = await unrealRead.readModules({ timeoutMs });
  const freshE = new Map(ents.items.map(u => [u.asset, u]));
  const freshM = new Map(mods.items.map(u => [u.asset + '|' + (u.folder || ''), u]));
  const e = savedE.size ? diffMaps(savedE, freshE, entityView, false) : { changed: [], added: [], removed: [] };
  const m = savedM.size ? diffMaps(savedM, freshM, moduleView, true) : { changed: [], added: [], removed: [] }; // gli SMDA salvati sono una scelta per ID: i nuovi non contano
  const cut = o => ({ changed: o.changed.slice(0, MAX_LIST), added: o.added.slice(0, MAX_LIST), removed: o.removed.slice(0, MAX_LIST), counts: { changed: o.changed.length, added: o.added.length, removed: o.removed.length } });
  const total = [e, m].reduce((a, o) => a + o.changed.length + o.added.length + o.removed.length, 0);
  return { ok: baseline && total === 0, baseline, total, entities: cut(e), modules: cut(m), checkedAt: new Date().toISOString(), ms: ents.ms + mods.ms };
}

module.exports = { check, entityView, moduleView };
