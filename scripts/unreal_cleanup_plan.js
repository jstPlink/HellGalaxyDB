// Pulizia di Unreal in due tempi, SEMPRE tramite l'agente:
//   buildPlan(db)   SOLA LETTURA. Trova gli asset inutili (Data Asset non nel foglio, scritti male, di test, duplicati, non
//                   caricabili) e i Blueprint orfani che li usano, e calcola l'insieme che si può cancellare SENZA lasciare
//                   riferimenti rotti: un asset resta nell'elenco solo se tutti i suoi riferimenti vengono da asset dello
//                   stesso elenco (si toglie l'asset e, a cascata, ciò che dipende da lui). Il resto va in "keep" con il motivo.
//   applyPlan(plan) SCRIVE SU UNREAL (cancella). Richiede HG_UE_ALLOW_WRITE=1 sull'app e sull'agente e confirm:true.
//                   Ordine: prima i Blueprint, poi i Data Asset. Per ogni asset ricontrolla i riferimenti in Python.
// Mai check-in. Decisioni dell'utente: docs/INTERVENTI_UNREAL.md (gruppi A e B da cancellare, C da tenere; Test* da rimuovere).
'use strict';
const fs = require('fs');
const path = require('path');
const bridge = require('./unreal_bridge');
const cleanup = require('./unreal_cleanup');

const py = f => fs.readFileSync(path.join(__dirname, 'unreal', f), 'utf8').replace(/\s+$/, '');
const BP_RE = /^\/Game\/2_LOGIC\/Entities\/BP\//;
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64');
const famOf = pkg => { const n = pkg.split('/').pop(); const m = /^(EDA|CIDA|LDA|SIDA|SMDA|CI|BP_ACS_Loot|SML_SM|SML_SI)_/.exec(n); return m ? m[1] : (BP_RE.test(pkg) ? 'BP' : 'altro'); };

function idsFromDb(db) {
  const rows = sql => db.prepare(sql).all();
  const entities = new Set(rows('SELECT id FROM entities').map(r => r.id));
  const modules = new Map(rows('SELECT id, section FROM modules_sheet').map(r => [r.id, r.section]));
  const cargo = new Set(rows("SELECT id FROM sheet_rows WHERE tab = 'cargo'").map(r => r.id));
  const items = new Map(rows("SELECT id, section FROM sheet_rows WHERE tab = 'items'").map(r => [r.id, r.section]));
  // asset di test: restano nei fogli ma vanno rimossi da Unreal (decisione dell'utente)
  const extraDelete = [...entities].filter(id => /(^|[-_])Test/i.test(id));
  return { entities, modules, cargo, items, extraDelete };
}

async function rawRefs(pkgs) {
  const info = {};
  for (let i = 0; i < pkgs.length; i += 100) {
    const r = await bridge.execPython(`${py('refs_check.py')}\n\ncheck(${JSON.stringify(b64(pkgs.slice(i, i + 100)))})\n`, { timeoutMs: 180000 });
    if (!r.success) throw new bridge.UnrealError('Verifica riferimenti fallita: ' + (r.stderr || r.output).slice(0, 300));
    Object.assign(info, bridge.lastJsonLine(r.output));
  }
  return info;
}

async function buildPlan(db) {
  const cands = await cleanup.findCandidates(idsFromDb(db));
  const daPkgs = [...new Set(cands.map(c => c.pkg))];
  const reason = new Map(cands.map(c => [c.pkg, c.reason]));
  let raw = await rawRefs(daPkgs);
  // Blueprint che usano questi Data Asset
  const bps = new Set();
  for (const p of daPkgs) for (const r of (raw[p] || {}).refs || []) if (BP_RE.test(r)) bps.add(r);
  const bpPkgs = [...bps].filter(b => !raw[b]);
  Object.assign(raw, await rawRefs(bpPkgs));
  const S = new Set([...daPkgs, ...bps]);
  const keep = [];
  // un asset resta solo se TUTTI i suoi riferimenti vengono da asset dell'elenco; altrimenti esce e trascina chi dipende da lui
  for (let changed = true; changed;) {
    changed = false;
    for (const x of [...S]) {
      const d = raw[x] || { class: '?', refs: [] };
      const ext = d.refs.filter(r => !S.has(r));
      if (ext.length || d.class === 'ObjectRedirector' || String(d.class).startsWith('ERR')) {
        S.delete(x); changed = true;
        keep.push({ pkg: x, class: d.class, why: ext.length ? 'usato da asset che restano' : 'redirector o non leggibile', refs: ext.slice(0, 4), reason: reason.get(x) || 'Blueprint orfano' });
      }
    }
  }
  const all = [...S];
  const bpList = all.filter(x => bps.has(x)).sort();
  const daList = all.filter(x => !bps.has(x)).sort();
  // quali Data Asset non hanno nessun Blueprint (cancellazione più semplice: si parte da questi)
  const daNoBp = daList.filter(x => !((raw[x] || {}).refs || []).some(r => bps.has(r)));
  const byFam = {}; for (const x of all) byFam[famOf(x)] = (byFam[famOf(x)] || 0) + 1;
  return { builtAt: new Date().toISOString(), counts: { candidatiDataAsset: daPkgs.length, blueprintOrfani: bpList.length, dataAssetDaCancellare: daList.length, totaleDaCancellare: all.length, daTenere: keep.length, perFamiglia: byFam, dataAssetSenzaBlueprint: daNoBp.length },
    bpList, daList, daNoBp, keep, reasons: Object.fromEntries(daList.map(x => [x, reason.get(x)])) };
}

// ---- cancellazione (job in background con stato) ----
let job = null;
const status = () => job;

function applyPlan(plan, { confirm, limit = 0, chunk = 20 } = {}) {
  if (process.env.HG_UE_ALLOW_WRITE !== '1') throw new bridge.UnrealError('Scrittura su Unreal disabilitata (HG_UE_ALLOW_WRITE non impostato sull\'app).', 403, 'write_disabled');
  if (confirm !== true) throw new bridge.UnrealError('Cancellazione non confermata.', 400, 'not_confirmed');
  if (job && job.running) throw new bridge.UnrealError('Una cancellazione è già in corso.', 409, 'busy');
  // ordine: prima i Data Asset senza Blueprint (prova), poi i Blueprint, poi i Data Asset rimasti
  const order = [...plan.daNoBp, ...plan.bpList, ...plan.daList.filter(x => !plan.daNoBp.includes(x))];
  const todo = limit > 0 ? order.slice(0, limit) : order;
  const inset = [...plan.bpList, ...plan.daList];
  job = { running: true, startedAt: new Date().toISOString(), finishedAt: null, total: todo.length, done: 0, deleted: [], skipped: [], failed: [], error: '', dirtyBefore: null, dirtyAfter: null };
  const j = job;
  (async () => {
    try {
      const p0 = await bridge.ping(); j.dirtyBefore = { content: p0.dirtyContent, maps: p0.dirtyMaps };
      for (let i = 0; i < todo.length; i += chunk) {
        const part = todo.slice(i, i + chunk);
        const r = await bridge.execPython(`${py('delete_assets.py')}\n\ndelete(${JSON.stringify(b64({ pkgs: part, inset }))})\n`, { timeoutMs: 300000 });
        if (!r.success) throw new bridge.UnrealError('Cancellazione fallita: ' + (r.stderr || r.output).slice(0, 300));
        const o = bridge.lastJsonLine(r.output);
        j.deleted.push(...o.deleted); j.skipped.push(...o.skipped); j.failed.push(...o.failed); j.done += part.length;
      }
      const p1 = await bridge.ping(); j.dirtyAfter = { content: p1.dirtyContent, maps: p1.dirtyMaps };
    } catch (e) { j.error = e.message; }
    j.running = false; j.finishedAt = new Date().toISOString();
  })();
  return j;
}

module.exports = { buildPlan, applyPlan, status, idsFromDb };
