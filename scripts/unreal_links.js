// Collegamenti degli asset di ogni entità in Unreal (SOLA LETTURA): quali asset esistono e chi li usa.
// Genera un'etichetta per ogni ID:
//   in-uso      almeno un asset (Blueprint o Data Asset) è referenziato da qualcosa di diverso dai suoi "fratelli"
//   zero-usi    gli asset esistono ma nessuno li usa (0 utilizzi: tipici Blueprint orfani)
//   senza-bp    esistono solo i Data Asset, nessun Blueprint
//   non-in-unreal  nessun asset con quell'ID
// DT_EntityTranslations (tabella generata dagli script) non conta come utilizzo: è segnalata a parte.
'use strict';
const fs = require('fs');
const path = require('path');
const bridge = require('./unreal_bridge');

const PY = path.join(__dirname, 'unreal', 'links_read.py');

function summarize(d) {
  const names = Object.keys(d.assets);
  const bps = names.filter(n => d.assets[n].kind === 'bp');
  const used = names.filter(n => d.assets[n].refs > 0);
  let tag;
  if (!names.length) tag = 'non-in-unreal';
  else if (used.length) tag = 'in-uso';
  else if (!bps.length) tag = 'senza-bp';
  else tag = 'zero-usi';
  const notes = [];
  if (names.length && !bps.length) notes.push('nessun Blueprint');
  if (d.inTranslations) notes.push('in DT_EntityTranslations');
  const dup = names.filter(n => d.assets[n].copies > 1);
  if (dup.length) notes.push('asset duplicati: ' + dup.join(', '));
  return { tag, assets: names, bpCount: bps.length, usedBy: used.map(n => ({ asset: n, refs: d.assets[n].refs, sample: d.assets[n].sample })), inTranslations: !!d.inTranslations, notes };
}

async function readLinks(ids, { timeoutMs = 180000, chunk = 60 } = {}) {
  const py = fs.readFileSync(PY, 'utf8').replace(/\s+$/, '');
  const out = {};
  let ms = 0;
  for (let i = 0; i < ids.length; i += chunk) {
    const part = ids.slice(i, i + chunk);
    const r = await bridge.execPython(`${py}\n\nread(${JSON.stringify(Buffer.from(JSON.stringify(part)).toString('base64'))})\n`, { timeoutMs });
    if (!r.success) throw new bridge.UnrealError('Errore Python nell\'Editor: ' + (r.stderr || r.output).slice(0, 400));
    if (r.savedPackages.length) throw new bridge.UnrealError('Inatteso: la lettura ha salvato pacchetti: ' + r.savedPackages.join(', '));
    const links = bridge.lastJsonLine(r.output).links;
    for (const id of part) out[id] = summarize(links[id] || { assets: {}, inTranslations: false });
    ms += r.ms;
  }
  return { links: out, ms };
}

module.exports = { readLinks, summarize };
