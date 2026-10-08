// "Aggiorna il progetto": processo di passaggio dei dati (decisione dell'utente, 2026-10-08).
// Ordine fisso: 1) Data Asset in Unreal  2) DataTable in Unreal  3) Blueprint in Unreal  4) server (NAS).
// Ogni passo ha uno stato visibile (in attesa / in corso / ok / errore / bloccato / non implementato / saltato);
// al primo errore o blocco i passi successivi NON partono, così si vede dove si è fermato.
// Modalità: 'dry' = anteprima (sola lettura su Unreal), 'apply' = scrive (solo con HG_UE_ALLOW_WRITE=1 e confirm).
// Se l'app gira già sul server il passo 4 non serve e si aggiorna direttamente Unreal (da definire: agente locale, piano §9).
'use strict';
const bridge = require('./unreal_bridge');
const entitiesPush = require('./unreal_entities');
const datatables = require('./unreal_datatables');
const serverSync = require('./server_sync');
const unrealSync = require('./unreal_sync');
const unrealLinks = require('./unreal_links');

const STEPS = [
  { key: 'dataassets', title: '1. Data Asset (EDA_) in Unreal' },
  { key: 'datatables', title: '2. DataTable degli eventi in Unreal' },
  { key: 'blueprints', title: '3. Blueprint in Unreal' },
  { key: 'server', title: '4. Aggiornamento del server (NAS)' },
];

let job = null;

function newJob(mode) {
  return { mode, startedAt: new Date().toISOString(), finishedAt: null, running: true, steps: STEPS.map(s => ({ ...s, status: 'pending', detail: '', ms: 0 })) };
}

function describeError(e) {
  if (e instanceof bridge.UnrealError) return { status: e.code === 'write_disabled' ? 'blocked' : 'error', detail: e.message };
  return { status: 'error', detail: e.message };
}

// ctx: { entityRows(): righe entità current, src: {rows, headers}, confirm, db }
async function run(mode, ctx) {
  if (job && job.running) throw new bridge.UnrealError('Un aggiornamento è già in corso.', 409, 'busy');
  const apply = mode === 'apply';
  job = newJob(mode);
  const j = job;
  (async () => {
    let stop = false;
    for (const st of j.steps) {
      if (stop) { st.status = 'skipped'; st.detail = 'non eseguito: un passo precedente non è riuscito'; continue; }
      st.status = 'running';
      const t0 = Date.now();
      try {
        if (st.key === 'dataassets') {
          const r = await entitiesPush.pushEntities(ctx.entityRows(), { apply });
          const c = r.counts || {};
          st.status = 'ok';
          st.detail = (apply ? 'Applicato' : 'Anteprima') + ': ' + Object.entries(c).map(([k, v]) => v + ' ' + k).join(', ') + ' su ' + r.entities + ' entità' + (r.orphans && r.orphans.length ? ' · ' + r.orphans.length + ' EDA_ in Unreal non nell\'app (solo elencati)' : '');
        } else if (st.key === 'datatables') {
          if (apply) {
            const done = [];
            for (const k of Object.keys(datatables.TABLES)) { const r = await datatables.apply(ctx.src, k, { confirm: ctx.confirm }); done.push(datatables.TABLES[k].asset + ' (' + r.rows + ' righe' + (r.ok && r.saved ? ', salvata' : ', NON salvata') + ')'); }
            st.status = 'ok'; st.detail = 'Aggiornate: ' + done.join(', ');
          } else {
            const p = await datatables.preview(ctx.src);
            const parts = Object.values(p.tables).map(t => t.error ? t.asset + ': ' + t.error : t.asset + ': ' + t.added.length + ' nuove, ' + t.changed.length + ' cambiate, ' + t.removed.length + ' da rimuovere, ' + t.unchanged + ' uguali');
            st.status = 'ok'; st.detail = 'Anteprima: ' + parts.join(' | ');
          }
        } else if (st.key === 'blueprints') {
          // Anteprima in sola lettura: quali Blueprint attesi (CI_, BP_ACS_Loot_, SML_*) mancano in Unreal. La creazione non è implementata.
          const ids = ctx.entityRows().map(r => r['(ID)']).filter(Boolean);
          const { links } = await unrealLinks.readLinks(ids);
          const plan = unrealSync.blueprintPlan(ctx.db, ids, links);
          if (apply) { st.status = 'todo'; st.detail = plan.missing.length + ' Blueprint mancanti su ' + plan.expected + ': la creazione dei Blueprint non è ancora implementata (non scrive).'; }
          else { st.status = 'ok'; st.detail = 'Anteprima: ' + plan.missing.length + ' Blueprint da creare su ' + plan.expected + ' attesi' + (plan.missing.length ? ' (es. ' + plan.missing.slice(0, 3).map(m => m.asset).join(', ') + ')' : '') + '.'; }
        } else if (st.key === 'server') {
          const r = await serverSync.pushToRemote(ctx.db, { apply });
          if (!r.configured) { st.status = 'skipped'; st.detail = 'Nessun server remoto configurato (HG_REMOTE_URL): si lavora in locale.'; }
          else {
            const tot = Object.values(r.applied ? r.sent : r.local).reduce((a, b) => a + b, 0);
            st.status = 'ok';
            st.detail = (r.applied ? 'Inviati ' : 'Anteprima: collegamento a ' + r.remote + ' riuscito' + (r.remoteVersion ? ' (v' + r.remoteVersion + ')' : '') + ', da inviare ') + tot + ' record' + (r.applied ? ' a ' + r.remote : '');
          }
        }
      } catch (e) {
        Object.assign(st, describeError(e));
        stop = true;
      }
      st.ms = Date.now() - t0;
    }
    j.running = false; j.finishedAt = new Date().toISOString();
  })();
  return job;
}

const status = () => job;
module.exports = { run, status, STEPS };
