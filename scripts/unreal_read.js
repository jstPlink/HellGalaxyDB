// Lettura (SOLA LETTURA) degli EDA_ e degli SMDA_ dall'Editor Unreal. Nessuna scrittura su Unreal.
'use strict';
const fs = require('fs');
const path = require('path');
const bridge = require('./unreal_bridge');

const ENTITIES_PY = path.join(__dirname, 'unreal', 'entities_read.py');
const MODULES_PY = path.join(__dirname, 'unreal', 'modules_read.py');
const ENTITIES_FOLDER = '/Game/2_LOGIC/Entities/DataAssets/Entities';
const MODULES_FOLDER = '/Game/2_LOGIC/Entities/DataAssets/Modules';
const FOLDER_RE = /^\/Game\/[A-Za-z0-9_\/]+$/;

async function runRead(pyFile, folder, timeoutMs) {
  if (!FOLDER_RE.test(folder)) throw new bridge.UnrealError('Cartella Unreal non valida: ' + folder, 400, 'bad_folder');
  const py = fs.readFileSync(pyFile, 'utf8').replace(/\s+$/, '');
  const r = await bridge.execPython(`${py}\n\nread(${JSON.stringify(folder)})\n`, { timeoutMs });
  if (!r.success) throw new bridge.UnrealError('Errore Python nell\'Editor: ' + (r.stderr || r.output).slice(0, 400));
  if (r.savedPackages.length) throw new bridge.UnrealError('Inatteso: la lettura ha salvato pacchetti: ' + r.savedPackages.join(', '));
  return { items: bridge.lastJsonLine(r.output).read, ms: r.ms };
}

// EDA_ delle entità: testi, tipo, rarità, prezzo, icona, produttore.
const readEntities = ({ folder = ENTITIES_FOLDER, timeoutMs } = {}) => runRead(ENTITIES_PY, folder, timeoutMs);
// SMDA_ dei moduli: mesh, shield mesh, quality e statistiche.
const readModules = ({ folder = MODULES_FOLDER, timeoutMs } = {}) => runRead(MODULES_PY, folder, timeoutMs);

// CIDA_ ('cargo'), LDA_ ('loots') e SIDA_ ('items'): sola lettura.
const TABS_PY = path.join(__dirname, 'unreal', 'tabs_read.py');
async function readTabAssets(kind, { timeoutMs } = {}) {
  if (!['cargo', 'loots', 'items'].includes(kind)) throw new bridge.UnrealError('Tipo di asset non valido: ' + kind, 400, 'bad_kind');
  const py = fs.readFileSync(TABS_PY, 'utf8').replace(/\s+$/, '');
  const r = await bridge.execPython(`${py}\n\nread(${JSON.stringify(kind)})\n`, { timeoutMs });
  if (!r.success) throw new bridge.UnrealError('Errore Python nell\'Editor: ' + (r.stderr || r.output).slice(0, 400));
  if (r.savedPackages.length) throw new bridge.UnrealError('Inatteso: la lettura ha salvato pacchetti: ' + r.savedPackages.join(', '));
  const out = bridge.lastJsonLine(r.output);
  return { items: out.read, unloadable: out.unloadable || [], ms: r.ms };
}

module.exports = { readEntities, readModules, readTabAssets };
