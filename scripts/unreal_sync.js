// "Sincronizza Unreal": SOLA LETTURA su Unreal. Confronta l'app con il progetto e raccoglie le discrepanze
// (Data Asset, DataTable, Blueprint mancanti) per mostrarle in una finestra. Salva nel DB dell'app solo i collegamenti letti
// (tabella entity_links, usati come "tag"); non scrive mai su Unreal.
// Passi: 1 collegamenti/Blueprint esistenti · 2 Data Asset (EDA_) · 3 DataTable degli eventi · 4 Blueprint attesi.
'use strict';
const bridge = require('./unreal_bridge');
const entitiesPush = require('./unreal_entities');
const datatables = require('./unreal_datatables');
const unrealLinks = require('./unreal_links');

const STEPS = [
  { key: 'links', title: '1. Collegamenti degli asset (tag)' },
  { key: 'dataassets', title: '2. Data Asset (EDA_)' },
  { key: 'datatables', title: '3. DataTable degli eventi' },
  { key: 'blueprints', title: '4. Blueprint attesi' },
];
const MAX_LIST = 300;
let job = null;

// Quali Blueprint ci si aspetta per ogni ID (piano §4.3): CI_ e BP_ACS_Loot_ per gli ID in Cargo; SML_SM_ se in Modules; SML_SI_ se in Items.
function expectedBlueprints(db, entityIds) {
  const ids = new Set(entityIds);
  const cargo = new Set(db.prepare("SELECT id FROM sheet_rows WHERE tab = 'cargo'").all().map(r => r.id));
  const items = new Set(db.prepare("SELECT id FROM sheet_rows WHERE tab = 'items'").all().map(r => r.id));
  const mods = new Set(db.prepare('SELECT id FROM modules_sheet').all().map(r => r.id));
  const out = {};
  for (const id of ids) {
    const e = [];
    if (cargo.has(id)) e.push('CI_' + id, 'BP_ACS_Loot_' + id);
    if (mods.has(id)) e.push('SML_SM_' + id);
    if (items.has(id)) e.push('SML_SI_' + id);
    if (e.length) out[id] = e;
  }
  return out;
}

function blueprintPlan(db, entityIds, links) {
  const exp = expectedBlueprints(db, entityIds);
  const missing = [];
  let expected = 0;
  for (const [id, names] of Object.entries(exp)) {
    const have = (links[id] && links[id].assets) || [];
    expected += names.length;
    for (const n of names) if (!have.includes(n)) missing.push({ id, asset: n });
  }
  return { expected, missing };
}

function saveLinks(db, links) {
  const now = new Date().toISOString();
  db.exec('BEGIN');
  try {
    db.exec('DELETE FROM entity_links');
    const ins = db.prepare('INSERT INTO entity_links (id, data_json, read_at) VALUES (?, ?, ?)');
    for (const [id, v] of Object.entries(links)) ins.run(id, JSON.stringify(v), now);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

function newJob(user) {
  return { startedAt: new Date().toISOString(), finishedAt: null, running: true, user: user || '', steps: STEPS.map(s => ({ ...s, status: 'pending', detail: '', ms: 0 })), discrepancies: null };
}

// ctx: { db, entityRows(), src }
function run(ctx, user) {
  if (job && job.running) throw new bridge.UnrealError('Una sincronizzazione è già in corso.', 409, 'busy');
  job = newJob(user);
  const j = job;
  (async () => {
    const rows = ctx.entityRows();
    const ids = rows.map(r => r['(ID)']).filter(Boolean);
    const disc = { dataassets: { updates: [], creates: [], orphans: [], counts: {} }, datatables: [], blueprints: { expected: 0, missing: [] }, links: {}, truncated: false };
    let links = null, stop = false;
    for (const st of j.steps) {
      if (stop) { st.status = 'skipped'; st.detail = 'non eseguito: un passo precedente non è riuscito'; continue; }
      st.status = 'running';
      const t0 = Date.now();
      try {
        if (st.key === 'links') {
          const r = await unrealLinks.readLinks(ids);
          links = r.links; saveLinks(ctx.db, links);
          for (const v of Object.values(links)) disc.links[v.tag] = (disc.links[v.tag] || 0) + 1;
          st.status = 'ok'; st.detail = ids.length + ' entità lette; tag salvati nell\'app';
        } else if (st.key === 'dataassets') {
          const r = await entitiesPush.pushEntities(rows, { apply: false });
          disc.dataassets.counts = r.counts || {};
          for (const it of r.items || []) {
            const entry = { id: it.id || it.name, fields: (it.fields || []).map(f => ({ f: f.f, app: f.to, unreal: f.from })) };
            if (it.action === 'create') disc.dataassets.creates.push(entry); else if (it.action === 'update') disc.dataassets.updates.push(entry);
          }
          disc.dataassets.orphans = r.orphans || [];
          st.status = 'ok'; st.detail = Object.entries(r.counts || {}).map(([k, v]) => v + ' ' + k).join(', ');
        } else if (st.key === 'datatables') {
          const p = await datatables.preview(ctx.src);
          for (const t of Object.values(p.tables)) {
            disc.datatables.push({ asset: t.asset, error: t.error || null, added: (t.added || []).length, changed: (t.changed || []).length, removed: (t.removed || []).length, unchanged: t.unchanged || 0,
              sample: [].concat((t.added || []).slice(0, 5).map(x => 'da aggiungere in Unreal: ' + x), (t.changed || []).slice(0, 5).map(x => 'diversa: ' + x.row + (x.diffs && x.diffs[0] ? ' (' + x.diffs[0].col + ': app "' + x.diffs[0].app + '" / Unreal "' + x.diffs[0].unreal + '")' : '')), (t.removed || []).slice(0, 5).map(x => 'in Unreal, non nell app: ' + x)) });
          }
          st.status = 'ok'; st.detail = disc.datatables.map(t => t.asset + ': ' + (t.error ? t.error : (t.added + t.changed + t.removed) + ' differenze')).join(' | ');
        } else if (st.key === 'blueprints') {
          disc.blueprints = blueprintPlan(ctx.db, ids, links || {});
          st.status = 'ok'; st.detail = disc.blueprints.missing.length + ' Blueprint attesi mancanti su ' + disc.blueprints.expected;
        }
      } catch (e) {
        st.status = 'error'; st.detail = e.message; stop = true;
        disc.error = e.message; disc.errorCode = e.code || '';
      }
      st.ms = Date.now() - t0;
    }
    for (const k of ['updates', 'creates']) if (disc.dataassets[k].length > MAX_LIST) { disc.dataassets[k] = disc.dataassets[k].slice(0, MAX_LIST); disc.truncated = true; }
    if (disc.blueprints.missing.length > MAX_LIST) { disc.blueprints.missing = disc.blueprints.missing.slice(0, MAX_LIST); disc.truncated = true; }
    const total = disc.dataassets.updates.length + disc.dataassets.creates.length + disc.dataassets.orphans.length + disc.blueprints.missing.length + disc.datatables.reduce((a, t) => a + t.added + t.changed + t.removed + (t.error ? 1 : 0), 0);
    disc.total = total;
    j.discrepancies = disc; j.running = false; j.finishedAt = new Date().toISOString();
  })();
  return job;
}

const status = () => job;
module.exports = { run, status, expectedBlueprints, blueprintPlan, saveLinks, STEPS };
