// Push delle entità verso i Data Asset EDA_<ID> di Unreal (Fase 1 del piano
// docs/PIANO_PUSH_UNREAL.md). Invia all'Editor lo script scripts/unreal/entities_push.py
// con un lotto di entità per volta (payload in base64), sempre con auto_save=false.
// Dry run (default): nessuna scrittura. Apply: crea/aggiorna e salva SOLO gli asset toccati.
// Mai cancellazioni, mai rinomine, mai check-in.
'use strict';
const fs = require('fs');
const path = require('path');
const bridge = require('./unreal_bridge');

const PY_FILE = path.join(__dirname, 'unreal', 'entities_push.py');
const BATCH = Number(process.env.HG_UE_BATCH) || 40;
const DEFAULT_FOLDER = '/Game/2_LOGIC/Entities/DataAssets/Entities';

let running = null; // { mode, since } — un solo push alla volta

function safeFolder(folder) {
  if (!folder) return DEFAULT_FOLDER;
  if (!/^\/Game\/[A-Za-z0-9_\/]+$/.test(folder)) throw new bridge.UnrealError('Cartella Unreal non valida: ' + folder, 400, 'bad_folder');
  return folder.replace(/\/+$/, '');
}

// Righe del DB (valori "current") -> payload minimo per Unreal.
function toPayload(rows) {
  return rows.map(r => ({
    id: r['(ID)'], Label: r.Label, BriefDescription: r.BriefDescription, EntityType: r.EntityType,
    BasePrice: r.BasePrice, BaseRarity: r.BaseRarity, Icon: r.Icon, ProducerIcon: r.ProducerIcon,
  })).filter(e => e.id);
}

function buildCode(py, call) { return py.replace(/\s+$/, '') + '\n\n' + call + '\n'; }

async function pushEntities(rows, { apply = false, folder, timeoutMs } = {}) {
  // SCRITTURA SU UNREAL DISABILITATA (richiesta dell'utente, 2026-10-07: sul progetto lavora
  // in parallelo un'altra sessione su un ramo dedicato). Si abilita solo con HG_UE_ALLOW_WRITE=1.
  if (apply && process.env.HG_UE_ALLOW_WRITE !== '1') {
    throw new bridge.UnrealError('Scrittura su Unreal disabilitata: l\'app per ora legge soltanto (HG_UE_ALLOW_WRITE non impostato).', 403, 'write_disabled');
  }
  if (running) throw new bridge.UnrealError(`Un push è già in corso (${running.mode}, dal ${running.since}).`, 409, 'busy');
  folder = safeFolder(folder);
  running = { mode: apply ? 'apply' : 'dry', since: new Date().toISOString() };
  const t0 = Date.now();
  try {
    const py = fs.readFileSync(PY_FILE, 'utf8');
    const payload = toPayload(rows);
    const opts = { timeoutMs: timeoutMs || undefined };

    const inv = await bridge.execPython(buildCode(py, `inventory(${JSON.stringify(folder)})`), opts);
    if (!inv.success) throw new bridge.UnrealError('Inventario degli EDA_ fallito: ' + (inv.stderr || inv.output).slice(0, 300));
    const existing = bridge.lastJsonLine(inv.output).inventory;

    const total = { apply, folder, entities: payload.length, counts: {}, items: [], saved: [], producerFirstWrite: 0, discrepancies: 0, warnings: 0, withErrors: 0, batches: 0 };
    for (let i = 0; i < payload.length; i += BATCH) {
      const chunk = payload.slice(i, i + BATCH);
      const b64 = Buffer.from(JSON.stringify(chunk), 'utf8').toString('base64');
      const r = await bridge.execPython(buildCode(py, `run(${JSON.stringify(b64)}, apply=${apply ? 'True' : 'False'}, folder=${JSON.stringify(folder)})`), opts);
      if (!r.success) throw new bridge.UnrealError(`Errore Python nell'Editor (lotto ${total.batches + 1}): ` + (r.stderr || r.output).slice(0, 400));
      const res = bridge.lastJsonLine(r.output);
      for (const [k, v] of Object.entries(res.counts)) total.counts[k] = (total.counts[k] || 0) + v;
      total.items.push(...res.items);
      total.saved.push(...res.saved);
      total.producerFirstWrite += res.producer_first_write;
      total.discrepancies += res.discrepancies;
      total.warnings += res.warnings;
      total.withErrors += res.with_errors || 0;
      total.batches++;
    }
    const ids = new Set(payload.map(e => 'EDA_' + e.id));
    total.orphans = existing.filter(n => !ids.has(n)).sort();
    total.existingInUnreal = existing.length;
    total.ms = Date.now() - t0;
    return total;
  } finally {
    running = null;
  }
}

module.exports = { pushEntities, toPayload, DEFAULT_FOLDER };
