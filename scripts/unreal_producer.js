// ProducerIcon degli EDA_: assegna la Texture2D "ICN_producer_<sigla>" (sigla dal foglio ENTITIES) solo dove in Unreal è vuoto.
// Anteprima = sola lettura. Apply = modifica SOLO il campo producer_icon IN MEMORIA, in blocco, senza salvare (gli asset restano sporchi: li salva l'utente);
// disabilitato se HG_UE_ALLOW_WRITE !== '1' (anche l'agente lo verifica sul PC dell'utente) e richiede confirm:true.
'use strict';
const fs = require('fs');
const path = require('path');
const bridge = require('./unreal_bridge');

const PY = path.join(__dirname, 'unreal', 'producer_apply.py');

async function producerIcons(rows, { apply = false, confirm = false } = {}) {
  if (apply && process.env.HG_UE_ALLOW_WRITE !== '1') throw new bridge.UnrealError('Scrittura su Unreal disabilitata (HG_UE_ALLOW_WRITE non impostato).', 403, 'write_disabled');
  if (apply && confirm !== true) throw new bridge.UnrealError('Scrittura non confermata.', 400, 'not_confirmed');
  const payload = rows.filter(r => r['(ID)'] && String(r.ProducerIcon || '').trim()).map(r => ({ id: r['(ID)'], sigla: String(r.ProducerIcon).trim() }));
  const py = fs.readFileSync(PY, 'utf8').replace(/\s+$/, '');
  const CHUNK = payload.length || 1; // tutto in blocco: in memoria, senza salvare (regola dell'utente)
  const total = { apply, counts: {}, items: [], saved: [], entitiesWithSigla: payload.length, ms: 0, savedPackages: [], batches: 0 };
  for (let i = 0; i < Math.max(payload.length, 1); i += CHUNK) {
    const b64 = Buffer.from(JSON.stringify(payload.slice(i, i + CHUNK)), 'utf8').toString('base64');
    let r;
    // se un agente con versione vecchia rifiuta il lavoro (nessuna scrittura), il lavoro passa a un altro: si riprova
    for (let attempt = 1; ; attempt++) {
      try { r = await execBatch(py, b64, apply); break; }
      catch (e) { if (e.code !== 'agent_rejected' || attempt >= 6) throw e; }
    }
    if (!r.success) throw new bridge.UnrealError("Errore Python nell'Editor: " + (r.stderr || r.output).slice(0, 400));
    const o = bridge.lastJsonLine(r.output);
    for (const [k, v] of Object.entries(o.counts)) total.counts[k] = (total.counts[k] || 0) + v;
    total.items.push(...o.items); total.saved.push(...o.saved); total.ms += r.ms; total.savedPackages.push(...r.savedPackages); total.batches++;
  }
  return total;
}

function execBatch(py, b64, apply) {
  return bridge.execPython(`${py}

run(${JSON.stringify(b64)}, apply=${apply ? 'True' : 'False'})
`, { timeoutMs: 300000 });
}

module.exports = { producerIcons };
