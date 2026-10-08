// Test automatici del tool (lato HellGalaxyDB): API entità, pull dal foglio
// (con CSV finto al posto di Apps Script), conflitti, autenticazione.
// Non toccano il database vero: usano una copia temporanea e una porta libera.
//
// Uso: node --test tests/tool_tests.js
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const PORT = 18936;
const BASE = `http://127.0.0.1:${PORT}`;
const TOKEN = 'token-di-test';
let tmp, proc, mockCsv;

// Mini tab "Modules": intestazione per sezione, colonna senza intestazione con un dato ("x"), sezione vuota.
const MODULES_FIXTURE = [
  'MainBody (ID),ItemType,PowerConsumption,Incorporated,Quality,StaticMesh,ModuleType,HullIntegrity,,Price,Rarity',
  'BODY-T1,Radar,0,FALSE,480,,MainBody,14000,,900,Uncommon',
  'BODY-T2,Radar,0,FALSE,770,,MainBody,25000,,2700,Legendary',
  'MainEngine (ID),ItemType,PowerConsumption,Incorporated,Quality,StaticMesh,ModuleType,SpeedIncrement,,Price,Rarity',
  'ENG-T1,Radar,0,FALSE,0,,MainEngine,840,x,0,Salvage',
  'Cargo (ID)',
  '',
].join('\n');

// Tab del Localization Master: colonne finali vuote e riga finale vuota da tagliare, cella con a capo.
const LOC_FIXTURE = ['KEY,ID,ENGLISH,,', 'SUB-A,,Alpha,,', 'SUB-B,,"Beta', 'con a capo",,', ',,,,', ''].join('\n');

// Tab CargoItemsAndLoots (piatto, riga senza ID da ignorare) e Items (a sezioni).
const CARGO_FIXTURE = [
  '(ID),Ovveride,StackValue,Override,Attractable,ForceToInspect,LootStaticMesh0,LootStaticMesh1',
  'COL-A,,20,,TRUE,FALSE,,',
  'COL-B,,10,,FALSE,TRUE,SM_Given,',
  ',,,,FALSE,FALSE,,',
  '',
].join('\n');
const ITEMS_FIXTURE = [
  'SecondaryEngine (ID),ItemType,PowerConsumption,Incorporated,Quality,TranslationalForce',
  'ENG-I,SecondaryEngine,0,FALSE,100,1800000',
  'PowerGenerator (ID),ItemType,PowerConsumption,Incorporated,Quality,PowerGenerated',
  'PG-I,PowerGenerator,1,FALSE,50,416',
  '',
].join('\n');

// Finto server MCP dell'Editor Unreal (stesso protocollo verificato sull'Editor vero).
const MCP_PORT = 18938;
const mcpCalls = [];
let mcpSse = false;
let mcpReadItems = [];
let mcpModulesItems = [];
let mcpTabItems = {};
let cargoCsv, itemsCsv, locCsv;
let modulesCsv;
let mcp;
function startMockMcp() {
  mcp = require('node:http').createServer((req, res) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const m = body ? JSON.parse(body) : {};
      const send = obj => {
        const text = JSON.stringify(obj);
        if (mcpSse) { res.writeHead(200, { 'Content-Type': 'text/event-stream' }); res.end('event: message\ndata: ' + text + '\n\n'); }
        else { res.writeHead(200, { 'Content-Type': 'application/json', 'Mcp-Session-Id': 'sess-1' }); res.end(text); }
      };
      if (m.method === 'initialize') { res.setHeader('Mcp-Session-Id', 'sess-1'); return send({ jsonrpc: '2.0', id: m.id, result: { protocolVersion: '2025-11-25', capabilities: {} } }); }
      if (m.method === 'notifications/initialized') { res.writeHead(202); return res.end(); }
      if (m.method === 'tools/call') {
        mcpCalls.push({ session: req.headers['mcp-session-id'], name: m.params.name, args: m.params.arguments });
        if (m.params.arguments.code.includes("FOLDERS = {'cargo'")) {
          const kind = /read\("(\w+)"\)\s*$/.exec(m.params.arguments.code)[1];
          return send({ jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text: JSON.stringify({ success: true, output: JSON.stringify({ read: mcpTabItems[kind] || [] }), saved_packages: [] }) }] } });
        }
        if (m.params.arguments.code.includes("DEFAULT_FOLDER = '/Game/2_LOGIC/Entities/DataAssets/Modules'")) {
          return send({ jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text: JSON.stringify({ success: true, output: JSON.stringify({ read: mcpModulesItems }), saved_packages: [] }) }] } });
        }
        if (m.params.arguments.code.includes("print(json.dumps({'read': items}))")) {
          return send({ jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text: JSON.stringify({ success: true, output: JSON.stringify({ read: mcpReadItems }), saved_packages: [] }) }] } });
        }
        const out = '[warning] qualcosa di deprecato\n' + JSON.stringify({ engine: '5.8.0-test', project: 'HellGalaxy', project_dir: 'D:/Plastic/HellGalaxy/', dirty_content: 0, dirty_maps: 0 });
        return send({ jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text: JSON.stringify({ success: true, output: out, saved_packages: [] }) }] } });
      }
      res.writeHead(404); res.end();
    });
  });
  return new Promise(r => mcp.listen(MCP_PORT, '127.0.0.1', r));
}
function stopMockMcp() { return new Promise(r => { if (!mcp) return r(); mcp.close(() => r()); mcp.closeAllConnections && mcp.closeAllConnections(); }); }

function csvLines() { return fs.readFileSync(path.join(ROOT, 'data', 'HS - Entity - ENTITIES.csv'), 'utf8'); }

async function startServer(extraEnv) {
  proc = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    env: { ...process.env, HG_DB_PATH: path.join(tmp, 'test.db'), HG_PORT: String(PORT), HG_SHEET_MOCK_CSV: mockCsv, HG_UE_MCP_URL: `http://127.0.0.1:${MCP_PORT}/mcp`, HG_SHEET_MOCK_MODULES_CSV: modulesCsv, HG_SHEET_MOCK_CARGO_CSV: cargoCsv, HG_LOC_MOCK_IDENTITIES: locCsv, HG_SHEET_MOCK_ITEMS_CSV: itemsCsv, ...extraEnv },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) return; } catch (e) { /* non ancora su */ }
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('server non partito');
}
async function stopServer() {
  if (!proc) return;
  proc.kill();
  await new Promise(r => setTimeout(r, 300));
  proc = null;
}
async function api(method, url, body, headers) {
  const r = await fetch(BASE + url, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, json: await r.json() };
}

before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hgdb-test-'));
  fs.copyFileSync(path.join(ROOT, 'data', 'hellgalaxy.db'), path.join(tmp, 'test.db'));
  locCsv = path.join(tmp, 'loc.csv'); fs.writeFileSync(locCsv, LOC_FIXTURE);
  cargoCsv = path.join(tmp, 'cargo.csv'); fs.writeFileSync(cargoCsv, CARGO_FIXTURE);
  itemsCsv = path.join(tmp, 'items.csv'); fs.writeFileSync(itemsCsv, ITEMS_FIXTURE);
  modulesCsv = path.join(tmp, 'modules.csv');
  fs.writeFileSync(modulesCsv, MODULES_FIXTURE);
  mockCsv = path.join(tmp, 'sheet.csv');
  fs.writeFileSync(mockCsv, csvLines());
  // Il database di test riparte SEMPRE dal CSV: i test non dipendono dallo stato del DB vero.
  {
    const { DatabaseSync } = require('node:sqlite');
    const sheet = require('../scripts/sheet_mappings');
    const tdb = new DatabaseSync(path.join(tmp, 'test.db'));
    tdb.exec('DELETE FROM entities');
    for (const tbl of ['entities_ue', 'modules_sheet', 'modules_sections', 'modules_ue', 'sheet_rows', 'sheet_sections', 'sheet_ue', 'grid_rows', 'grid_tabs']) { try { tdb.exec('DELETE FROM ' + tbl); } catch (e) { /* tabella non ancora creata */ } }
    const { headers, rows } = sheet.csvToTable(csvLines());
    const ins = tdb.prepare('INSERT INTO entities (id, current_json, original_json, updated_at) VALUES (?, ?, ?, ?)');
    for (const raw of rows) { const e = sheet.normalizeEntityRow(raw, headers); if (e) { const j = JSON.stringify(e); ins.run(e['(ID)'], j, j, new Date().toISOString()); } }
    tdb.close();
  }
  await startMockMcp();
  await startServer({});
});
after(async () => { await stopServer(); await stopMockMcp(); fs.rmSync(tmp, { recursive: true, force: true }); });

test('T1 health: il server risponde e conosce le entità', async () => {
  const { status, json } = await api('GET', '/api/health');
  assert.equal(status, 200);
  assert.equal(json.ok, true);
  assert.equal(json.authRequired, false);
  assert.ok(json.entities >= 1, 'tabella entities vuota: esegui node scripts/migrate_entities_to_db.js');
});

test('T2 GET /api/entities: tutte le colonne del foglio, nulla scartato', async () => {
  const { json } = await api('GET', '/api/entities');
  assert.ok(json.items.length >= 270);
  const e = json.items.find(x => x['(ID)'] === 'COL-IC_Raw');
  for (const c of ['(ID)', 'Label', 'BriefDescription', 'EntityType', 'BasePrice', 'BaseRarity', 'Icon', 'LabelKey', 'DescriptionKey', 'ProducerIcon', 'ModuleType', 'Quality', 'extra']) assert.ok(c in e, 'manca ' + c);
  assert.equal(e.Label, 'Ionic Coal');
  assert.equal(e.BasePrice, '8');
  assert.ok('ModuleType BAKCUP 26.03.26' in e.extra, 'la colonna di backup deve stare in extra');
  assert.ok(json.originals['COL-IC_Raw']);
});

test('T3 modifica, dirty e ripristino di un campo', async () => {
  const id = 'COL-Gold';
  const put = await api('PUT', '/api/entities/' + id, { fields: { Label: 'Gold TEST', '(ID)': 'HACK', Inesistente: 'x' } });
  assert.equal(put.json.current.Label, 'Gold TEST');
  assert.equal(put.json.current['(ID)'], id, "l'ID non è modificabile");
  assert.equal(put.json.current.Inesistente, undefined);
  assert.equal(put.json.original.Label, 'Gold');
  const rev = await api('POST', `/api/entities/${id}/revert`);
  assert.equal(rev.json.current.Label, 'Gold');
  assert.equal((await api('PUT', '/api/entities/NON-ESISTE', { fields: {} })).status, 404);
});

test('T4 pull senza modifiche sul foglio: dry run tutto invariato', async () => {
  const { status, json } = await api('POST', '/api/sync/pull/entities');
  assert.equal(status, 200);
  assert.deepEqual([json.added.length, json.changed.length, json.conflicts.length, json.missingInSheet.length], [0, 0, 0, 0]);
  assert.ok(json.unchanged >= 270);
  assert.equal(json.applied, false);
});

test('T5 pull: nuova riga, riga cambiata, riga assente (mai cancellata)', async () => {
  let csv = csvLines();
  csv = csv.replace('COL-Gold,Gold,[C],Collectable,10,', 'COL-Gold,Gold,[C],Collectable,99,');           // cambiata
  csv = csv.replace(/\r?\nCOL-Aluminium,[^\n]*/, '');                                                      // assente
  csv = csv.trimEnd() + '\nTEST-New,Nuova,desc,Item,5,Rare,T_Test,,,,,,,,,,,,,\n';                        // nuova
  fs.writeFileSync(mockCsv, csv);
  const dry = await api('POST', '/api/sync/pull/entities');
  assert.deepEqual(dry.json.added, ['TEST-New']);
  assert.equal(dry.json.changed.length, 1);
  assert.deepEqual(dry.json.changed[0], { id: 'COL-Gold', fields: ['BasePrice'] });
  assert.deepEqual(dry.json.missingInSheet, ['COL-Aluminium']);
  // il dry run non scrive
  assert.equal((await api('GET', '/api/entities')).json.items.find(x => x['(ID)'] === 'TEST-New'), undefined);

  const app = await api('POST', '/api/sync/pull/entities?apply=1');
  assert.equal(app.status, 200);
  assert.equal(app.json.applied, true);
  const all = (await api('GET', '/api/entities')).json;
  assert.equal(all.items.find(x => x['(ID)'] === 'TEST-New').Label, 'Nuova');
  assert.equal(all.items.find(x => x['(ID)'] === 'COL-Gold').BasePrice, '99');
  assert.ok(all.items.find(x => x['(ID)'] === 'COL-Aluminium'), 'una riga assente dal foglio non va mai cancellata');
  // secondo apply: nulla da fare
  const again = await api('POST', '/api/sync/pull/entities');
  assert.equal(again.json.added.length + again.json.changed.length, 0);
});

test('T6 conflitto: campo modificato sia nel tool sia nel foglio', async () => {
  await api('PUT', '/api/entities/COL-Crystal', { fields: { Label: 'Crystal LOCALE' } });
  fs.writeFileSync(mockCsv, fs.readFileSync(mockCsv, 'utf8').replace('COL-Crystal,Crystal,', 'COL-Crystal,Crystal DAL FOGLIO,'));
  const dry = await api('POST', '/api/sync/pull/entities');
  assert.equal(dry.json.conflicts.length, 1);
  assert.equal(dry.json.conflicts[0].field, 'Label');
  const refused = await api('POST', '/api/sync/pull/entities?apply=1');
  assert.equal(refused.status, 409);
  const after = (await api('GET', '/api/entities')).json.items.find(x => x['(ID)'] === 'COL-Crystal');
  assert.equal(after.Label, 'Crystal LOCALE', 'con conflitto non deve cambiare nulla');
  const forced = await api('POST', '/api/sync/pull/entities?apply=1&skipConflicts=1');
  assert.equal(forced.status, 200);
  const kept = (await api('GET', '/api/entities')).json.items.find(x => x['(ID)'] === 'COL-Crystal');
  assert.equal(kept.Label, 'Crystal LOCALE', 'skipConflicts tiene il valore del tool');
});

test('T7 reset-all ripristina tutte le entità agli originali', async () => {
  const r = await api('POST', '/api/entities/reset-all');
  assert.ok(r.json.items.every(e => JSON.stringify(e) === JSON.stringify(r.json.originals[e['(ID)']])));
});

test('T8 autenticazione: con HG_API_TOKEN serve il Bearer', async () => {
  await stopServer();
  await startServer({ HG_API_TOKEN: TOKEN });
  assert.equal((await api('GET', '/api/health')).json.authRequired, true);
  assert.equal((await api('GET', '/api/entities')).status, 401);
  assert.equal((await api('GET', '/api/entities', null, { Authorization: 'Bearer sbagliato' })).status, 401);
  const ok = await api('GET', '/api/entities', null, { Authorization: 'Bearer ' + TOKEN });
  assert.equal(ok.status, 200);
  assert.ok(ok.json.items.length >= 270);
});

test('T9 file statici: UI e JSON sì, database e codice no', async () => {
  const get = async p => (await fetch(BASE + p)).status;
  assert.equal(await get('/'), 200);
  assert.equal(await get('/data/stations.json'), 200);
  assert.equal(await get('/data/hellgalaxy.db'), 404);
  assert.equal(await get('/server.js'), 404);
  assert.equal(await get('/scripts/apps-script-sync.gs'), 404);
});

test('T10 pull da CSV caricato a mano (senza Apps Script)', async () => {
  const csv = fs.readFileSync(path.join(ROOT, 'data', 'HS - Entity - ENTITIES.csv'), 'utf8').replace('COL-Radium,Radium,', 'COL-Radium,Radium CSV,');
  const r = await fetch(BASE + '/api/sync/pull/entities', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN }, body: JSON.stringify({ csv }) });
  const json = await r.json();
  assert.equal(r.status, 200);
  assert.ok(json.changed.some(c => c.id === 'COL-Radium' && c.fields.includes('Label')));
});

const AUTH = { Authorization: 'Bearer ' + TOKEN };

test('T11 ping Unreal: sola lettura, sessione MCP e auto_save=false', async () => {
  const r = await api('GET', '/api/unreal/ping', null, AUTH);
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
  assert.equal(r.json.engine, '5.8.0-test');
  assert.equal(r.json.project, 'HellGalaxy');
  assert.equal(r.json.dirtyContent, 0);
  assert.deepEqual(r.json.savedPackages, []);
  const c = mcpCalls[mcpCalls.length - 1];
  assert.equal(c.name, 'execute_python_code');
  assert.equal(c.args.auto_save, 'false', 'auto_save deve essere sempre "false"');
  assert.ok(c.args.code.startsWith('import unreal'));
  assert.ok(!/save_asset|save_loaded|delete_asset|rename_asset|set_editor_property/.test(c.args.code), 'il ping non deve scrivere');
  assert.equal(c.session, 'sess-1', 'deve rimandare Mcp-Session-Id');
});

test('T12 ping Unreal: risposta MCP in formato SSE', async () => {
  mcpSse = true;
  await stopServer(); await startServer({ HG_API_TOKEN: TOKEN }); // nuova sessione
  const r = await api('GET', '/api/unreal/ping', null, AUTH);
  mcpSse = false;
  assert.equal(r.status, 200);
  assert.equal(r.json.engine, '5.8.0-test');
});

test('T13 ping Unreal: Editor chiuso -> messaggio chiaro (503), senza token -> 401', async () => {
  assert.equal((await api('GET', '/api/unreal/ping')).status, 401);
  await stopMockMcp();
  const r = await api('GET', '/api/unreal/ping', null, AUTH);
  assert.equal(r.status, 503);
  assert.equal(r.json.ok, false);
  assert.match(r.json.error, /Editor non raggiungibile/);
  assert.equal(r.json.code, 'unreachable');
});

test('T14 valori effettivi: foglio master, Unreal solo dove il foglio è vuoto/non utilizzabile', () => {
  const { effectiveEntity } = require('../scripts/entity_effective');
  const row = { Label: 'Gold', BriefDescription: '[C]', Icon: 'T_Old', ProducerIcon: '' };
  const ue = { label: 'Gold UE', brief: 'Descrizione vera', icon: { name: 'T_New', class: 'Texture2D' }, producer_icon: { name: 'ICN_producer_TTF', class: 'Texture2D' } };
  const e = effectiveEntity(row, row, ue);
  assert.deepEqual(e.Label, { v: 'Gold', src: 'sheet' }, 'nome del foglio utilizzabile: vale il foglio');
  assert.deepEqual(e.BriefDescription, { v: 'Descrizione vera', src: 'unreal' }, '[C] non è utilizzabile: si legge Unreal');
  assert.deepEqual(e.Icon, { v: 'T_New', src: 'unreal' }, 'icona: in contraddizione vale Unreal');
  assert.deepEqual(e.ProducerIcon, { v: 'TTF', src: 'unreal' }, 'produttore vuoto nel foglio: da Unreal');
  const mat = effectiveEntity(row, row, { icon: { name: 'MI_X', class: 'MaterialInstanceConstant' } });
  assert.deepEqual(mat.Icon, { v: 'T_Old', src: 'sheet' }, "un materiale non è un'immagine: ignorato");
  const edited = effectiveEntity({ ...row, Icon: 'T_App' }, row, ue);
  assert.deepEqual(edited.Icon, { v: 'T_App', src: 'app' }, "una modifica fatta nell'app vince");
  assert.deepEqual(effectiveEntity(row, row, null).Icon, { v: 'T_Old', src: 'sheet' }, 'senza dati da Unreal resta il foglio');
});

test("T15 lettura da Unreal: anteprima non scrive, apply salva SOLO nel DB dell'app, Unreal mai scritto", async () => {
  await startMockMcp();
  mcpReadItems = [
    { asset: 'EDA_COL-Gold', label: 'Gold', brief: 'Descrizione vera', entity_type: 'Collectable', rarity: 'Common', base_price: 10, icon: { name: 'T_COL_Gold_UE', class: 'Texture2D', path: 'x' }, producer_icon: { name: 'ICN_producer_TTF', class: 'Texture2D', path: 'x' } },
    { asset: 'EDA_COL-Crystal', label: 'Crystal', brief: '[C]', entity_type: 'Consumable', rarity: 'Uncommon', base_price: 99, icon: { name: 'MI_X', class: 'MaterialInstanceConstant', path: 'x' }, producer_icon: null },
    { asset: 'EDA_SOLO-IN-UNREAL', label: 'x', brief: '', entity_type: 'Item', rarity: 'Rare', base_price: 1, icon: null, producer_icon: null },
  ];
  const before = mcpCalls.length;
  const dry = await api('POST', '/api/sync/unreal/entities', null, AUTH);
  assert.equal(dry.status, 200);
  assert.equal(dry.json.applied, false);
  assert.equal(dry.json.fills.Icon, 1);
  assert.equal(dry.json.fills.ProducerIcon, 1);
  assert.equal(dry.json.fills.BriefDescription, 1);
  assert.equal(dry.json.iconNotImage.length, 1);
  assert.deepEqual(dry.json.onlyInUnreal, ['EDA_SOLO-IN-UNREAL']);
  assert.ok(dry.json.sheetVsUnreal.entity_type.some(x => x.startsWith('COL-Crystal')), 'differenza di tipo solo segnalata');
  assert.ok(dry.json.sheetVsUnreal.base_price.some(x => x.startsWith('COL-Crystal')));
  let ents = (await api('GET', '/api/entities', null, AUTH)).json;
  assert.equal(ents.ueCount, 0, "l'anteprima non salva nulla");

  const app = await api('POST', '/api/sync/unreal/entities?apply=1', null, AUTH);
  assert.equal(app.json.applied, true);
  ents = (await api('GET', '/api/entities', null, AUTH)).json;
  assert.equal(ents.ueCount, 3);
  assert.deepEqual(ents.effective['COL-Gold'].ProducerIcon, { v: 'TTF', src: 'unreal' });
  assert.deepEqual(ents.effective['COL-Gold'].Icon, { v: 'T_COL_Gold_UE', src: 'unreal' });
  assert.equal(ents.effective['COL-Crystal'].Icon.src, 'sheet');
  // i dati del foglio (current/original) non sono stati toccati
  assert.equal(ents.items.find(x => x['(ID)'] === 'COL-Gold').Icon, 'T_COL_Gold');
  // nessuna chiamata a Unreal contiene operazioni di scrittura
  for (const c of mcpCalls.slice(before)) {
    assert.equal(c.args.auto_save, 'false');
    assert.ok(!/save_asset|save_loaded|delete_asset|rename_asset|set_editor_property|create_asset|checkout/.test(c.args.code), 'la lettura non deve scrivere su Unreal');
  }
  await stopMockMcp();
});

test('T16 scrittura su Unreal disabilitata (HG_UE_ALLOW_WRITE non impostato)', async () => {
  const { pushEntities } = require('../scripts/unreal_entities');
  await assert.rejects(() => pushEntities([], { apply: true }), /Scrittura su Unreal disabilitata/);
});

test('T17 tab Modules: parsing esatto per sezioni, pull con anteprima/apply, extra senza intestazione conservati', async () => {
  const { parseModulesTab } = require('../scripts/modules_sheet');
  const p = parseModulesTab(require('../scripts/sheet_mappings').parseCsv(MODULES_FIXTURE));
  assert.deepEqual(p.sections.map(s => s.name), ['MainBody', 'MainEngine', 'Cargo']);
  assert.equal(p.rows.length, 3);
  const eng = p.rows.find(r => r['(ID)'] === 'ENG-T1');
  assert.equal(eng.__section, 'MainEngine');
  assert.equal(eng.SpeedIncrement, '840');
  assert.equal(eng['#I'], 'x', 'la cella sotto intestazione vuota non si perde');
  assert.equal(p.rows.find(r => r['(ID)'] === 'BODY-T1').HullIntegrity, '14000');

  const dry = await api('POST', '/api/sync/pull/modules', null, AUTH);
  assert.equal(dry.status, 200);
  assert.equal(dry.json.added.length, 3);
  assert.equal(dry.json.applied, false);
  assert.equal((await api('GET', '/api/modules-sheet', null, AUTH)).json.items.length, 0, "l'anteprima non scrive");
  const app = await api('POST', '/api/sync/pull/modules?apply=1', null, AUTH);
  assert.equal(app.json.applied, true);
  const all = (await api('GET', '/api/modules-sheet', null, AUTH)).json;
  assert.equal(all.items.length, 3);
  assert.deepEqual(all.sections.map(s => s.name), ['MainBody', 'MainEngine', 'Cargo']);
  assert.equal((await api('POST', '/api/sync/pull/modules', null, AUTH)).json.unchanged, 3);

  // modifica nell'app e poi cambio nel foglio sullo stesso campo = conflitto
  const put = await api('PUT', '/api/modules-sheet/BODY-T1', { fields: { Price: '999', '(ID)': 'HACK', Inesistente: 'x' } }, AUTH);
  assert.equal(put.json.current.Price, '999');
  assert.equal(put.json.current['(ID)'], 'BODY-T1');
  assert.equal(put.json.current.Inesistente, undefined);
  fs.writeFileSync(modulesCsv, MODULES_FIXTURE.replace('BODY-T1,Radar,0,FALSE,480,,MainBody,14000,,900,', 'BODY-T1,Radar,0,FALSE,480,,MainBody,14000,,950,'));
  const conf = await api('POST', '/api/sync/pull/modules?apply=1', null, AUTH);
  assert.equal(conf.status, 409);
  assert.equal(conf.json.conflicts[0].field, 'Price');
  const rev = await api('POST', '/api/modules-sheet/BODY-T1/revert', null, AUTH);
  assert.equal(rev.json.current.Price, '900');
  const ok = await api('POST', '/api/sync/pull/modules?apply=1', null, AUTH);
  assert.equal(ok.status, 200);
  assert.equal((await api('GET', '/api/modules-sheet', null, AUTH)).json.items.find(r => r['(ID)'] === 'BODY-T1').Price, '950');
});

test("T18 moduli: valori effettivi (mesh/shield dagli SMDA_, quality vale Unreal tranne 10) e lettura da Unreal senza scrivere", async () => {
  await startMockMcp();
  const mesh = n => ({ name: n, class: 'StaticMesh', path: 'x' });
  mcpModulesItems = [
    { asset: 'SMDA_BODY-T1', folder: 'MainBody', class: 'CPP_DA_MainBody', static_mesh: mesh('SM_Body'), shield_static_mesh: mesh('SM_Shield'), quality: 480, module_type: 'ENT_MT_MAIN_BODY', props: { quality: 480, hull_integrity: 14000 } },
    { asset: 'SMDA_BODY-T2', folder: 'MainBody', class: 'CPP_DA_MainBody', static_mesh: null, shield_static_mesh: null, quality: 10, module_type: 'ENT_MT_MAIN_BODY', props: { quality: 10, hull_integrity: 25000 } },
    { asset: 'SMDA_ENG-T1', folder: 'MainEngine', class: 'CPP_DA_MainEngine', static_mesh: mesh('SM_Eng'), shield_static_mesh: null, quality: 5, module_type: 'ENT_MT_MAIN_ENGINE', props: { quality: 5, speed_increment: 999 } },
    { asset: 'SMDA_ORFANO', folder: 'Pylon', class: 'CPP_DA_Pylon', static_mesh: null, shield_static_mesh: null, quality: 1, module_type: null, props: {} },
    { asset: 'SMDAMOD01-Vecchio', folder: 'Pylon', class: 'CPP_DA_Pylon', static_mesh: null, shield_static_mesh: null, quality: 1, module_type: null, props: {} },
  ];
  const before = mcpCalls.length;
  const dry = await api('POST', '/api/sync/unreal/modules', null, AUTH);
  assert.equal(dry.status, 200);
  assert.equal(dry.json.matched, 3);
  assert.equal(dry.json.fills.StaticMesh, 2);
  assert.equal(dry.json.fills.ShieldStaticMesh, 1);
  assert.equal(dry.json.fills.Quality, 1, 'solo ENG-T1 (5): BODY-T2 ha 10 = non usato');
  assert.deepEqual(dry.json.noMesh, ['BODY-T2']);
  assert.deepEqual(dry.json.onlyInUnreal, ['SMDA_ORFANO']);
  assert.deepEqual(dry.json.legacy, ['SMDAMOD01-Vecchio']);
  assert.ok(dry.json.statDiffSamples.some(x => x.startsWith('ENG-T1.SpeedIncrement')), 'differenza di statistica segnalata, non applicata');
  assert.equal((await api('GET', '/api/modules-sheet', null, AUTH)).json.ueCount, 0);

  await api('POST', '/api/sync/unreal/modules?apply=1', null, AUTH);
  const all = (await api('GET', '/api/modules-sheet', null, AUTH)).json;
  assert.equal(all.ueCount, 4, 'salvati anche gli SMDA_ non nel foglio (orfani), non i legacy senza SMDA_');
  assert.deepEqual(all.effective['BODY-T1'].StaticMesh, { v: 'SM_Body', src: 'unreal' });
  assert.deepEqual(all.effective['BODY-T1'].ShieldStaticMesh, { v: 'SM_Shield', src: 'unreal' });
  assert.deepEqual(all.effective['BODY-T2'].Quality, { v: '770', src: 'sheet' }, 'Unreal=10 -> modulo non usato -> foglio');
  assert.deepEqual(all.effective['ENG-T1'].Quality, { v: '5', src: 'unreal' });
  assert.equal(all.items.find(r => r['(ID)'] === 'ENG-T1').Quality, '0', 'i dati del foglio non sono toccati');
  for (const c of mcpCalls.slice(before)) {
    assert.equal(c.args.auto_save, 'false');
    assert.ok(!/save_asset|save_loaded|delete_asset|rename_asset|set_editor_property|create_asset|checkout/.test(c.args.code), 'la lettura non deve scrivere su Unreal');
  }
  await stopMockMcp();
});

test('T19 tab CargoItemsAndLoots: import esatto (tabella piatta), lettura CIDA_/LDA_ da Unreal senza scrivere', async () => {
  const p = await api('POST', '/api/sync/pull/tab/cargo', null, AUTH);
  assert.equal(p.status, 200);
  assert.deepEqual(p.json.added.sort(), ['COL-A', 'COL-B']);
  assert.equal(p.json.ignoredRows, 1, 'la riga senza ID è ignorata e contata');
  assert.equal(p.json.sections[0].name, 'CargoItemsAndLoots');
  await api('POST', '/api/sync/pull/tab/cargo?apply=1', null, AUTH);
  let all = (await api('GET', '/api/tabs/cargo', null, AUTH)).json;
  assert.equal(all.items.length, 2);
  assert.equal(all.items.find(r => r['(ID)'] === 'COL-B').LootStaticMesh0, 'SM_Given');
  assert.equal((await api('POST', '/api/sync/pull/tab/cargo', null, AUTH)).json.unchanged, 2);

  await startMockMcp();
  mcpTabItems = {
    cargo: [{ asset: 'CIDA_COL-A', folder: '', class: 'CPP_DA_CargoItem', stack_value: 25, can_be_sold: false }, { asset: 'CIDA_COL-B', folder: '', class: 'CPP_DA_CargoItem', stack_value: 10, can_be_sold: true }, { asset: 'CIDA_ZZZ', folder: '', class: 'CPP_DA_CargoItem', stack_value: 1, can_be_sold: true }],
    loots: [{ asset: 'LDA_COL-A', folder: '', class: 'CPP_DA_Loot', attractable: false, force_to_inspect: false, loot_static_mesh: ['SM_X'] }, { asset: 'LDA_COL-B', folder: '', class: 'CPP_DA_Loot', attractable: false, force_to_inspect: true, loot_static_mesh: ['SM_Other'] }],
  };
  const before = mcpCalls.length;
  const dry = await api('POST', '/api/sync/unreal/tab/cargo', null, AUTH);
  assert.equal(dry.status, 200);
  assert.equal(dry.json.matched, 2);
  assert.equal(dry.json.diffs.StackValue, 1);
  assert.equal(dry.json.diffs.Attractable, 1);
  assert.equal(dry.json.diffs.LootStaticMesh, 1, 'COL-B: mesh del foglio diversa da quella di Unreal');
  assert.equal(dry.json.fills.LootStaticMesh, 1, 'COL-A: mesh vuota nel foglio, presa da Unreal');
  assert.deepEqual(dry.json.orphans.CIDA, ['CIDA_ZZZ']);
  assert.deepEqual(dry.json.extra.cantBeSold, ['COL-A']);
  assert.equal((await api('GET', '/api/tabs/cargo', null, AUTH)).json.ueCount, 0, "l'anteprima non salva");
  await api('POST', '/api/sync/unreal/tab/cargo?apply=1', null, AUTH);
  all = (await api('GET', '/api/tabs/cargo', null, AUTH)).json;
  assert.deepEqual(all.effective['COL-A'].LootStaticMesh0, { v: 'SM_X', src: 'unreal' });
  assert.deepEqual(all.effective['COL-B'].LootStaticMesh0, { v: 'SM_Given', src: 'sheet' });
  assert.equal(all.items.find(r => r['(ID)'] === 'COL-A').StackValue, '20', 'i dati del foglio non sono toccati');
  for (const c of mcpCalls.slice(before)) {
    assert.equal(c.args.auto_save, 'false');
    assert.ok(!/save_asset|save_loaded|delete_asset|rename_asset|set_editor_property|create_asset|checkout/.test(c.args.code), 'la lettura non deve scrivere su Unreal');
  }
  await stopMockMcp();
});

test('T20 tab Items (a sezioni): import esatto, SIDA_ da Unreal, quality vale Unreal tranne 10', async () => {
  await api('POST', '/api/sync/pull/tab/items?apply=1', null, AUTH);
  let all = (await api('GET', '/api/tabs/items', null, AUTH)).json;
  assert.deepEqual(all.sections.map(s => s.name), ['SecondaryEngine', 'PowerGenerator']);
  assert.equal(all.items.find(r => r['(ID)'] === 'PG-I').PowerGenerated, '416');
  await startMockMcp();
  mcpTabItems = { items: [
    { asset: 'SIDA_ENG-I', folder: 'SecondaryEngine', class: 'CPP_DA_SecondaryEngine', item_type: 'ENT_IT_SECONDARY_ENGINE', quality: 90, props: { quality: 90, translational_force: 1800000 } },
    { asset: 'SIDA_PG-I', folder: 'PowerGenerator', class: 'CPP_DA_PowerGenerator', item_type: 'ENT_IT_POWER_GENERATOR', quality: 10, props: { quality: 10, power_generated: 500 } },
    { asset: 'SIDA_ORFANO', folder: 'Radar', class: 'CPP_DA_Radar', item_type: null, quality: 1, props: {} },
  ] };
  const dry = await api('POST', '/api/sync/unreal/tab/items', null, AUTH);
  assert.equal(dry.json.matched, 2);
  assert.equal(dry.json.fills.Quality, 1);
  assert.equal(dry.json.diffs.PowerGenerated, 1, 'statistica diversa: solo segnalata');
  assert.equal(dry.json.diffs.Quality, 1);
  assert.deepEqual(dry.json.orphans.SIDA, ['SIDA_ORFANO']);
  await api('POST', '/api/sync/unreal/tab/items?apply=1', null, AUTH);
  all = (await api('GET', '/api/tabs/items', null, AUTH)).json;
  assert.deepEqual(all.effective['ENG-I'].Quality, { v: '90', src: 'unreal' });
  assert.deepEqual(all.effective['PG-I'].Quality, { v: '50', src: 'sheet' }, 'Unreal=10 -> non usato -> foglio');
  await stopMockMcp();
});

test('T21 Localization Master: copia fedele di sola lettura (colonne/righe vuote finali tagliate, a capo conservati)', async () => {
  const { parseGrid } = require('../scripts/grid_tabs');
  const g = parseGrid(LOC_FIXTURE);
  assert.deepEqual(g.headers, ['KEY', 'ID', 'ENGLISH']);
  assert.equal(g.rows.length, 2);
  assert.equal(g.rows[1][2], 'Beta\ncon a capo');

  assert.equal((await api('GET', '/api/grid/identities', null, AUTH)).json.count, 0);
  const dry = await api('POST', '/api/sync/pull/grid/identities', null, AUTH);
  assert.equal(dry.status, 200);
  assert.equal(dry.json.sheetRows, 2);
  assert.equal(dry.json.columns, 3);
  assert.equal(dry.json.applied, false);
  assert.equal((await api('GET', '/api/grid/identities', null, AUTH)).json.count, 0, "l'anteprima non scrive");
  const app = await api('POST', '/api/sync/pull/grid/identities?apply=1', null, AUTH);
  assert.equal(app.json.applied, true);
  const got = (await api('GET', '/api/grid/identities', null, AUTH)).json;
  assert.deepEqual(got.headers, ['KEY', 'ID', 'ENGLISH']);
  assert.equal(got.rows[0][2], 'Alpha');
  assert.equal((await api('POST', '/api/sync/pull/grid/identities', null, AUTH)).json.identical, true);
  const changed = await api('POST', '/api/sync/pull/grid/identities', { csv: LOC_FIXTURE.replace('Alpha', 'Alfa') }, AUTH);
  assert.equal(changed.json.changedRows, 1);
  assert.equal(changed.json.identical, false);
  assert.equal((await api('GET', '/api/grid/nonesiste', null, AUTH)).status, 404);
});
