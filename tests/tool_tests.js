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
    env: { ...process.env, HG_DB_PATH: path.join(tmp, 'test.db'), HG_PORT: String(PORT), HG_SHEET_MOCK_CSV: mockCsv, HG_UE_MODE: 'direct', HG_UE_MCP_URL: `http://127.0.0.1:${MCP_PORT}/mcp`, HG_SHEET_MOCK_MODULES_CSV: modulesCsv, HG_SHEET_MOCK_CARGO_CSV: cargoCsv, HG_LOC_MOCK_IDENTITIES: locCsv, HG_SHEET_MOCK_ITEMS_CSV: itemsCsv, ...extraEnv },
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

test('T22 collegamento ENTITIES <-> Localization Master › Entities (modifica in un punto = modifica anche nell\'altro)', async () => {
  const csv = ['KEY,ID,ENGLISH', 'MOD02-Engine_M-Name,,Nome foglio', 'MOD02-Engine_M-Description,,Descr foglio', 'ALTRO-Name,,Altro', ''].join('\n');
  assert.equal((await api('POST', '/api/sync/pull/grid/entities?apply=1', { csv }, AUTH)).json.applied, true);
  // ENTITIES -> Localization Master
  assert.equal((await api('PUT', '/api/entities/MOD02-Engine_M', { fields: { Label: 'Nome app' } }, AUTH)).status, 200);
  let g = (await api('GET', '/api/grid/entities', null, AUTH)).json;
  assert.equal(g.rows[0][2], 'Nome app');
  assert.deepEqual(g.edits.map(e => [e.row, e.col, e.original]), [[2, 2, 'Nome foglio']]);
  // Localization Master -> ENTITIES (descrizione)
  const r = await api('PUT', '/api/grid/entities/3', { value: 'Descr nuova' }, AUTH);
  assert.equal(r.status, 200);
  const ents = (await api('GET', '/api/entities', null, AUTH)).json.items;
  assert.equal(ents.find(e => e['(ID)'] === 'MOD02-Engine_M').BriefDescription, 'Descr nuova');
  // un nuovo pull dal foglio conserva le modifiche fatte nell'app
  const p = await api('POST', '/api/sync/pull/grid/entities?apply=1', { csv }, AUTH);
  assert.equal(p.json.keptEdits, 2);
  g = (await api('GET', '/api/grid/entities', null, AUTH)).json;
  assert.equal(g.rows[0][2], 'Nome app');
  // ripristino dell'entità -> torna anche la riga e sparisce la modifica
  await api('POST', '/api/entities/MOD02-Engine_M/revert', null, AUTH);
  g = (await api('GET', '/api/grid/entities', null, AUTH)).json;
  const orig = (await api('GET', '/api/entities', null, AUTH)).json.originals['MOD02-Engine_M'];
  assert.equal(g.rows[0][2], orig.Label, "dopo il ripristino la riga mostra il testo originale dell'entità");
});

test('T23 DataTable eventi: generazione dal database, confronto con l\'export di Unreal, scrittura bloccata', async () => {
  const dt = require('../scripts/unreal_datatables');
  const rows = dt.buildRows(
    { mainevents: [['EV_A', 'EV', 'A', 'SINGLE_TRIGGER', 'X', '0', '1', '', '2'], ['', 'EV', 'B', '', '', '', '', '', '']], eventtexts: [['EV_A', "L'uomo \"x\"", 'EV_A_A']] },
    { mainevents: ['RowName', 'Prefix', 'EventId', 'MultiplicityType', 'EventType', 'System', 'Multiplicity', 'Speaker', 'Priority'], eventtexts: ['id', 'Text', 'FMOD ID'] });
  assert.equal(rows.signature.length, 1, 'le righe senza RowName si saltano');
  assert.deepEqual(rows.signature[0].cols, ['EV', 'A', '0', '1']);
  assert.deepEqual(rows.rules[0].cols, ['A', 'SINGLE_TRIGGER', '1', '2']);
  assert.equal(rows.texts[0].row, 'EV_A_A');
  assert.equal(dt.toCsv('texts', rows.texts), '---,Id,Text,FmodId\nEV_A_A,"EV_A","L\'uomo ""x""","EV_A_A"\n');
  // testo FText esportato da Unreal
  assert.equal(dt.ftextToString('NSLOCTEXT("DT_EventsText [AB]", "K_Text", "might\\\'ve")'), "might've");
  // confronto
  const unrealCsv = '---,Id,Text,FmodId\nEV_A_A,"EV_A","NSLOCTEXT(""ns"", ""EV_A_A_Text"", ""vecchio"")","EV_A_A"\nEV_OLD,"X","t","EV_OLD"\n';
  const d = dt.diffTable('texts', rows.texts, dt.parseUnrealCsv('texts', unrealCsv));
  assert.equal(d.changed.length, 1);
  assert.equal(d.changed[0].diffs[0].col, 'Text');
  assert.deepEqual(d.removed, ['EV_OLD']);
  // la scrittura è bloccata senza HG_UE_ALLOW_WRITE (e il test non deve nemmeno raggiungere l'Editor)
  const saved = process.env.HG_UE_ALLOW_WRITE; delete process.env.HG_UE_ALLOW_WRITE;
  await assert.rejects(() => dt.apply({ rows: () => [], headers: () => [] }, 'texts', { confirm: true }), /disabilitata/);
  if (saved !== undefined) process.env.HG_UE_ALLOW_WRITE = saved;
});

test('T24 agente Unreal: validazione dei lavori (solo script noti + chiamata letterale), scritture segnalate', async () => {
  const agent = require('../scripts/unreal_agent');
  const bridge = require('../scripts/unreal_bridge');
  const scripts = agent.loadScripts();
  const refs = scripts.find(s => s.file === 'refs_check.py').text;
  const ok = agent.validateJob(refs + '\n\ncheck("YWJj")\n', { pingCode: bridge.PING_CODE, scripts });
  assert.equal(ok.ok, true); assert.equal(ok.write, false);
  assert.equal(agent.validateJob(refs.replace(/\n/g, '\r\n') + '\r\n\r\ncheck("YWJj")\r\n', { pingCode: bridge.PING_CODE, scripts }).ok, true, 'tollera i fine riga CRLF');
  assert.equal(agent.validateJob(bridge.PING_CODE, { pingCode: bridge.PING_CODE, scripts }).what, 'ping');
  const del = agent.validateJob(scripts.find(s => s.file === 'delete_assets.py').text + '\n\ndelete("YWJj")\n', { pingCode: bridge.PING_CODE, scripts });
  assert.equal(del.write, true, 'delete scrive');
  const push = scripts.find(s => s.file === 'entities_push.py').text;
  assert.equal(agent.validateJob(push + '\n\nrun("YQ==", apply=False, folder="/Game/X")\n', { scripts }).write, false);
  assert.equal(agent.validateJob(push + '\n\nrun("YQ==", apply=True, folder="/Game/X")\n', { scripts }).write, true, 'apply=True scrive');
  // codice non consentito o iniettato
  for (const bad of ['import unreal\nprint(1)', refs + '\n\ncheck("a"); import os\n', refs + '\n\ncheck(os.getcwd())\n', refs + '\n\nexec("x")\n', refs + '\n\ncheck("a")\ncheck("b")\n'])
    assert.equal(agent.validateJob(bad, { pingCode: bridge.PING_CODE, scripts }).ok, false, bad.slice(-30));
});

test('T25 modalità agente: senza agente errore chiaro; con l\'agente il lavoro arriva all\'Editor (finto) e torna il risultato', async () => {
  const P2 = 18940, B2 = `http://127.0.0.1:${P2}`;
  if (!mcp || !mcp.listening) await startMockMcp();
  const env = { ...process.env, HG_DB_PATH: path.join(tmp, 'agent.db'), HG_PORT: String(P2), HG_AGENT_TOKEN: 'tok-agente', HG_AGENT_CONNECT_WAIT_MS: '800', HG_UE_MODE: 'agent' };
  fs.copyFileSync(path.join(tmp, 'test.db'), path.join(tmp, 'agent.db'));
  const srv = spawn(process.execPath, [path.join(ROOT, 'server.js')], { env, stdio: 'ignore' });
  let ag;
  try {
    for (let i = 0; i < 50; i++) { try { if ((await fetch(B2 + '/api/health')).ok) break; } catch (e) { /* non ancora su */ } await new Promise(r => setTimeout(r, 100)); }
    const off = await fetch(B2 + '/api/unreal/ping'); const offJ = await off.json();
    assert.equal(off.status, 503); assert.equal(offJ.code, 'agent_offline');
    assert.equal((await fetch(B2 + '/api/agent/poll', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401, 'senza token agente: 401');
    const before = mcpCalls.length;
    ag = spawn(process.execPath, [path.join(ROOT, 'scripts', 'unreal_agent.js')], { env: { ...process.env, HG_SERVER_URL: B2, HG_AGENT_TOKEN: 'tok-agente', HG_AGENT_NAME: 'PC-test', HG_UE_MCP_URL: `http://127.0.0.1:${MCP_PORT}/mcp`, HG_UE_ALLOW_WRITE: '' }, stdio: 'ignore', cwd: os.tmpdir() });
    let res, json;
    for (let i = 0; i < 40; i++) { res = await fetch(B2 + '/api/unreal/ping'); json = await res.json(); if (res.status === 200) break; await new Promise(r => setTimeout(r, 300)); }
    assert.equal(res.status, 200, JSON.stringify(json));
    assert.equal(json.ok, true); assert.equal(json.project, 'HellGalaxy');
    assert.ok(mcpCalls.length > before && mcpCalls[mcpCalls.length - 1].args.auto_save === 'false', 'ha raggiunto l\'Editor finto con auto_save false');
    const st = await (await fetch(B2 + '/api/agent/status')).json();
    assert.equal(st.connected, true); assert.equal(st.agents[0].name, 'PC-test');
    // cancellazione richiesta dall'app: l'agente (senza HG_UE_ALLOW_WRITE) la blocca
    const blocked = await fetch(B2 + '/api/unreal/datatables/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ table: 'texts', confirm: true }) });
    assert.equal(blocked.status, 403);
  } finally { if (ag) ag.kill(); srv.kill(); }
});

test('T26 notifiche di modifica: registro con utente, nessun blocco', async () => {
  const before = (await api('GET', '/api/changes?since=0', null, AUTH)).json.rev;
  const r = await fetch(BASE + '/api/entities/MOD02-Engine_M', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN, 'X-HG-User': encodeURIComponent('Mario'), 'X-HG-Client': 'abc' }, body: JSON.stringify({ fields: { BasePrice: '5' } }) });
  assert.equal(r.status, 200);
  const c = (await api('GET', `/api/changes?since=${before}`, null, AUTH)).json;
  assert.equal(c.changes.length, 1);
  assert.equal(c.changes[0].user, 'Mario'); assert.equal(c.changes[0].what, 'ENTITIES'); assert.equal(c.changes[0].id, 'MOD02-Engine_M'); assert.deepEqual(c.changes[0].fields, ['BasePrice']);
  // una seconda modifica da un altro utente non viene respinta (nessun blocco)
  const r2 = await fetch(BASE + '/api/entities/MOD02-Engine_M', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN, 'X-HG-User': 'Anna' }, body: JSON.stringify({ fields: { BasePrice: '6' } }) });
  assert.equal(r2.status, 200);
  await api('POST', '/api/entities/MOD02-Engine_M/revert', null, AUTH);
});

test('T27 utenti: creazione, duplicato rifiutato (senza distinzione maiuscole), selezione di un utente esistente', async () => {
  assert.deepEqual((await api('GET', '/api/users', null, AUTH)).json.users.filter(u => /^Test /.test(u.name)), []);
  const c = await api('POST', '/api/users', { name: '  Test   Anna ', create: true }, AUTH);
  assert.equal(c.status, 200); assert.equal(c.json.name, 'Test Anna'); assert.equal(c.json.created, true);
  const dup = await api('POST', '/api/users', { name: 'test anna', create: true }, AUTH);
  assert.equal(dup.status, 409); assert.equal(dup.json.name, 'Test Anna');
  const sel = await api('POST', '/api/users', { name: 'test anna' }, AUTH);
  assert.equal(sel.status, 200); assert.equal(sel.json.created, false); assert.equal(sel.json.name, 'Test Anna');
  assert.equal((await api('POST', '/api/users', { name: '   ' }, AUTH)).status, 400);
  assert.equal((await api('GET', '/api/users', null, AUTH)).json.users.filter(u => u.name === 'Test Anna').length, 1);
  assert.equal((await fetch(BASE + '/api/users')).status, 401, 'senza token API: 401');
});

test('T28 passo 4: invio dei dati al server remoto con token (anteprima senza scrivere, apply, token errato)', async () => {
  const PT = 18942, PS = 18944;
  const mk = (port, db, extra) => spawn(process.execPath, [path.join(ROOT, 'server.js')], { env: { ...process.env, HG_DB_PATH: path.join(tmp, db), HG_PORT: String(port), ...extra }, stdio: 'ignore' });
  fs.copyFileSync(path.join(tmp, 'test.db'), path.join(tmp, 'tgt.db')); fs.copyFileSync(path.join(tmp, 'test.db'), path.join(tmp, 'src.db'));
  const wait = async p => { for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://127.0.0.1:${p}/api/health`)).ok) return; } catch (e) { /* non ancora su */ } await new Promise(r => setTimeout(r, 100)); } };
  const tgt = mk(PT, 'tgt.db', { HG_API_TOKEN: 'tok-remoto' });
  const src = mk(PS, 'src.db', { HG_REMOTE_URL: `http://127.0.0.1:${PT}`, HG_REMOTE_TOKEN: 'tok-remoto' });
  const bad = mk(18946, 'src.db', { HG_REMOTE_URL: `http://127.0.0.1:${PT}`, HG_REMOTE_TOKEN: 'sbagliato' });
  const S = `http://127.0.0.1:${PS}`, T = `http://127.0.0.1:${PT}`, TA = { Authorization: 'Bearer tok-remoto' };
  try {
    await wait(PT); await wait(PS); await wait(18946);
    const put = await fetch(S + '/api/entities/MOD02-Engine_M', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { BasePrice: 777 } }) });
    assert.equal(put.status, 200);
    const price = async base => (await (await fetch(base + '/api/entities', { headers: TA })).json()).items.find(e => e['(ID)'] === 'MOD02-Engine_M').BasePrice;
    // anteprima: collegamento riuscito, nulla cambia sul server remoto
    const dry = await (await fetch(S + '/api/remote/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).json();
    assert.equal(dry.ok, true); assert.equal(dry.applied, false); assert.ok(dry.local.entities > 100);
    assert.notEqual(String(await price(T)), '777');
    // apply: il server remoto riceve le modifiche
    const ap = await (await fetch(S + '/api/remote/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apply: true }) })).json();
    assert.equal(ap.applied, true); assert.equal(ap.received.entities, dry.local.entities);
    assert.equal(String(await price(T)), '777');
    // token errato: errore chiaro, nessun invio
    const ko = await fetch(`http://127.0.0.1:18946/api/remote/push`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apply: true }) });
    assert.equal(ko.status, 502); assert.match((await ko.json()).error, /token/);
    // il server remoto senza token non accetta l'import
    assert.equal((await fetch(T + '/api/import/bundle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
  } finally { tgt.kill(); src.kill(); bad.kill(); }
});

test('T29 Sincronizza Unreal: Blueprint attesi (CI_/BP_ACS_Loot_/SML_*) e job in sola lettura; senza agente errore chiaro', async () => {
  const { DatabaseSync } = require('node:sqlite');
  const sync = require('../scripts/unreal_sync');
  const mem = new DatabaseSync(':memory:');
  mem.exec('CREATE TABLE sheet_rows (tab TEXT, id TEXT); CREATE TABLE modules_sheet (id TEXT)');
  mem.exec("INSERT INTO sheet_rows VALUES ('cargo','A'),('cargo','B'),('items','B'); INSERT INTO modules_sheet VALUES ('A')");
  const exp = sync.expectedBlueprints(mem, ['A', 'B', 'C']);
  assert.deepEqual(exp.A, ['CI_A', 'BP_ACS_Loot_A', 'SML_SM_A']);
  assert.deepEqual(exp.B, ['CI_B', 'BP_ACS_Loot_B', 'SML_SI_B']);
  assert.equal(exp.C, undefined);
  const plan = sync.blueprintPlan(mem, ['A', 'B', 'C'], { A: { assets: ['CI_A', 'BP_ACS_Loot_A', 'SML_SM_A'] }, B: { assets: ['CI_B'] } });
  assert.equal(plan.expected, 6);
  assert.deepEqual(plan.missing.map(m => m.asset), ['BP_ACS_Loot_B', 'SML_SI_B']);
  // job reale in modalità agente senza agente: parte, fallisce al primo passo con messaggio chiaro, nessuna scrittura
  const P = 18948, B = `http://127.0.0.1:${P}`;
  fs.copyFileSync(path.join(tmp, 'test.db'), path.join(tmp, 'sync.db'));
  const srv = spawn(process.execPath, [path.join(ROOT, 'server.js')], { env: { ...process.env, HG_DB_PATH: path.join(tmp, 'sync.db'), HG_PORT: String(P), HG_AGENT_TOKEN: 'x', HG_AGENT_CONNECT_WAIT_MS: '300', HG_UE_MODE: 'agent' }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 50; i++) { try { if ((await fetch(B + '/api/health')).ok) break; } catch (e) { /* non ancora su */ } await new Promise(r => setTimeout(r, 100)); }
    const r = await fetch(B + '/api/unreal-sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(r.status, 202);
    let job;
    for (let i = 0; i < 40; i++) { job = (await (await fetch(B + '/api/unreal-sync')).json()).job; if (!job.running) break; await new Promise(r => setTimeout(r, 150)); }
    assert.equal(job.running, false);
    assert.equal(job.steps[0].status, 'error'); assert.equal(job.steps[1].status, 'skipped');
    assert.match(job.discrepancies.error, /agente/i);
  } finally { srv.kill(); }
});


test('T30 agente scaricabile: .bat già configurato + pacchetto unico che si avvia da solo e collega l\'Editor (finto)', async () => {
  const P3 = 18941, B3 = `http://127.0.0.1:${P3}`;
  if (!mcp || !mcp.listening) await startMockMcp();
  fs.copyFileSync(path.join(tmp, 'test.db'), path.join(tmp, 'bundle.db'));
  const srv = spawn(process.execPath, [path.join(ROOT, 'server.js')], { env: { ...process.env, HG_DB_PATH: path.join(tmp, 'bundle.db'), HG_PORT: String(P3), HG_AGENT_TOKEN: 'tok-bundle', HG_UE_MODE: 'agent' }, stdio: 'ignore' });
  let ag;
  try {
    for (let i = 0; i < 50; i++) { try { if ((await fetch(B3 + '/api/health')).ok) break; } catch (e) { /* non ancora su */ } await new Promise(r => setTimeout(r, 100)); }
    assert.equal((await fetch(B3 + '/api/agent/script')).status, 401, 'il pacchetto richiede il token agente');
    const bat = await (await fetch(B3 + '/api/agent/bat')).text();
    assert.ok(bat.includes(`set "HG_SERVER_URL=${B3}"`) && bat.includes('set "HG_AGENT_TOKEN=tok-bundle"'), 'il .bat contiene indirizzo e token');
    assert.ok(bat.includes('\r\n') && bat.includes('/api/agent/script') && bat.includes('where node'));
    const js = await (await fetch(B3 + '/api/agent/script', { headers: { Authorization: 'Bearer tok-bundle' } })).text();
    assert.ok(js.includes('scripts/unreal_agent.js') && js.includes('scripts/unreal/links_read.py'));
    const dir = path.join(tmp, 'agentdir'); fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'agent.js'), js);
    ag = spawn(process.execPath, [path.join(dir, 'agent.js')], { env: { ...process.env, HG_SERVER_URL: B3, HG_AGENT_TOKEN: 'tok-bundle', HG_AGENT_NAME: 'PC-bundle', HG_UE_MCP_URL: `http://127.0.0.1:${MCP_PORT}/mcp`, HG_UE_ALLOW_WRITE: '' }, stdio: 'ignore', cwd: dir });
    let res, json;
    for (let i = 0; i < 40; i++) { res = await fetch(B3 + '/api/unreal/ping'); json = await res.json(); if (res.status === 200) break; await new Promise(r => setTimeout(r, 300)); }
    assert.equal(res.status, 200, JSON.stringify(json)); assert.equal(json.project, 'HellGalaxy');
    assert.ok(fs.existsSync(path.join(dir, 'app', 'scripts', 'unreal_agent.js')), 'ha estratto i file accanto a sé');
  } finally { if (ag) ag.kill(); srv.kill(); }
});

test('T31 token dell\'agente generato dal server al primo avvio (nessuna configurazione) e conservato', async () => {
  const P4 = 18942, B4 = `http://127.0.0.1:${P4}`;
  const dbf = path.join(tmp, 'auto.db'); fs.copyFileSync(path.join(tmp, 'test.db'), dbf);
  const run = () => spawn(process.execPath, [path.join(ROOT, 'server.js')], { env: { ...process.env, HG_DB_PATH: dbf, HG_PORT: String(P4), HG_AGENT_TOKEN: '', HG_UE_MODE: 'agent' }, stdio: 'ignore' });
  const up = async () => { for (let i = 0; i < 50; i++) { try { if ((await fetch(B4 + '/api/health')).ok) return; } catch (e) { /* non ancora su */ } await new Promise(r => setTimeout(r, 100)); } };
  const tokenOf = async () => /set "HG_AGENT_TOKEN=([0-9a-f]{48})"/.exec(await (await fetch(B4 + '/api/agent/bat')).text())[1];
  let srv = run(); let t1;
  try { await up(); t1 = await tokenOf(); assert.equal(fs.readFileSync(path.join(tmp, 'agent_token.txt'), 'utf8').trim(), t1); } finally { srv.kill(); }
  await new Promise(r => setTimeout(r, 300));
  srv = run();
  try { await up(); assert.equal(await tokenOf(), t1, 'dopo il riavvio il token è lo stesso (il .bat già scaricato resta valido)'); } finally { srv.kill(); }
});

test('T32 utenti: colore scelto alla creazione, predefinito se manca o non valido, modificabile', async () => {
  const mk = (body) => api('POST', '/api/users', body, AUTH);
  const a = await mk({ name: 'ColoreA', create: true, color: '#ff0000' });
  assert.equal(a.json.color, '#ff0000');
  const b = await mk({ name: 'ColoreB', create: true, color: 'rosso' });
  assert.match(b.json.color, /^#[0-9a-f]{6}$/, 'colore non valido -> uno predefinito');
  const c = await mk({ name: 'ColoreC', create: true });
  assert.match(c.json.color, /^#[0-9a-f]{6}$/);
  const upd = await mk({ name: 'ColoreA', color: '#00ff00' });
  assert.equal(upd.json.color, '#00ff00');
  const list = (await api('GET', '/api/users', null, AUTH)).json.users;
  assert.equal(list.find(u => u.name === 'ColoreA').color, '#00ff00');
  assert.ok(list.every(u => /^#[0-9a-f]{6}$/.test(u.color)), 'ogni utente ha un colore');
});

test('T33 cronologia: ogni modifica registra utente, area, campo, valore prima e dopo; anche ripristino e filtri', async () => {
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN, 'X-HG-User': encodeURIComponent('Mario') };
  const get = async q => (await api('GET', '/api/history' + q, null, AUTH)).json;
  const before = (await get('?limit=500')).items.length;
  const orig = (await api('GET', '/api/entities', null, AUTH)).json.originals['MOD02-Engine_M'].BasePrice;
  const r = await fetch(BASE + '/api/entities/MOD02-Engine_M', { method: 'PUT', headers: H, body: JSON.stringify({ fields: { BasePrice: '777' } }) });
  assert.equal(r.status, 200);
  let h = await get('?user=Mario&q=MOD02-Engine_M');
  const e = h.items.find(i => i.field === 'BasePrice' && i.new === '777');
  assert.ok(e, 'registrata la modifica'); assert.equal(e.old, orig); assert.equal(e.area, 'ENTITIES'); assert.equal(e.user, 'Mario'); assert.equal(e.source, 'modifica');
  assert.ok(h.users.includes('Mario') && h.areas.includes('ENTITIES'));
  await fetch(BASE + '/api/entities/MOD02-Engine_M/revert', { method: 'POST', headers: H });
  h = await get('?user=Mario&q=MOD02-Engine_M');
  const rv = h.items.find(i => i.field === 'BasePrice' && i.old === '777');
  assert.ok(rv && rv.new === orig && rv.source === 'ripristino', 'registrato anche il ripristino');
  // nessuna modifica = nessuna riga; le richieste in sola lettura non registrano nulla
  const n1 = (await get('?limit=500')).items.length;
  await api('GET', '/api/entities', null, AUTH);
  assert.equal((await get('?limit=500')).items.length, n1);
  assert.ok(n1 >= before + 2);
  assert.equal((await get('?area=NONESISTE')).items.length, 0, 'filtro per area');
});

test('T34 righe nuove ed eliminate dall\'app: creazione, duplicato, eliminazione che resiste al pull, ripristino', async () => {
  const mk = (area, body) => api('POST', '/api/rows/' + area, body, AUTH);
  // entità nuova
  assert.equal((await mk('entities', { id: 'COL-NuovaProva' })).status, 200);
  assert.equal((await mk('entities', { id: 'col-nuovaprova' })).status, 409, 'duplicato (senza distinzione maiuscole)');
  assert.equal((await mk('entities', { id: 'ID con spazi' })).status, 400);
  let ents = (await api('GET', '/api/entities', null, AUTH)).json.items;
  const n = ents.find(e => e['(ID)'] === 'COL-NuovaProva');
  assert.ok(n && n.Label === '' && n.EntityType === '', 'riga vuota con tutte le colonne');
  assert.equal((await api('PUT', '/api/entities/COL-NuovaProva', { fields: { Label: 'Prova' } }, AUTH)).status, 200);
  // un pull dal foglio non la tocca (resta "solo nell'app")
  const p = await api('POST', '/api/sync/pull/entities?apply=1&skipConflicts=1', null, AUTH);
  assert.equal(p.status, 200);
  assert.ok((await api('GET', '/api/entities', null, AUTH)).json.items.some(e => e['(ID)'] === 'COL-NuovaProva'));
  // eliminazione di una riga del foglio: dopo il pull NON ritorna
  const target = ents.find(e => e['(ID)'] === 'MOD02-Engine_M');
  assert.ok(target);
  assert.equal((await api('DELETE', '/api/rows/entities/MOD02-Engine_M', null, AUTH)).status, 200);
  assert.ok(!(await api('GET', '/api/entities', null, AUTH)).json.items.some(e => e['(ID)'] === 'MOD02-Engine_M'));
  await api('POST', '/api/sync/pull/entities?apply=1&skipConflicts=1', null, AUTH);
  assert.ok(!(await api('GET', '/api/entities', null, AUTH)).json.items.some(e => e['(ID)'] === 'MOD02-Engine_M'), 'il pull non la fa tornare');
  assert.ok((await api('GET', '/api/rows/deleted', null, AUTH)).json.items.some(i => i.id === 'MOD02-Engine_M'));
  // ripristino
  assert.equal((await api('POST', '/api/rows/entities/MOD02-Engine_M/restore', null, AUTH)).status, 200);
  const back = (await api('GET', '/api/entities', null, AUTH)).json.items.find(e => e['(ID)'] === 'MOD02-Engine_M');
  assert.equal(back.Label, target.Label, 'stessi dati di prima');
  // cronologia: aggiunta e rimozione registrate
  const h = (await api('GET', '/api/history?q=COL-NuovaProva', null, AUTH)).json.items;
  assert.ok(h.some(i => i.field === '(riga)' && i.new === 'aggiunta'));
  // riga nuova nei tab a sezioni: serve la sezione
  assert.equal((await mk('modules', { id: 'MOD-NuovoProva' })).status, 400, 'senza sezione valida');
  // pulizia
  await api('DELETE', '/api/rows/entities/COL-NuovaProva', null, AUTH);
});

test('T35 controlli di qualità: segnalano valori fuori elenco e righe orfane (sola lettura)', async () => {
  const q = require('../scripts/quality_checks');
  const ent = (id, o) => ({ '(ID)': id, Label: 'x', BriefDescription: '', EntityType: 'Item', BasePrice: '1', BaseRarity: 'Common', Icon: 'T_X', LabelKey: id + '-Name', DescriptionKey: '', ...o });
  const res = q.runChecks({
    entities: [ent('A'), ent('B', { EntityType: 'Boh', BaseRarity: 'Rarissimo', BasePrice: 'tanti', Icon: '' }), ent('C', { LabelKey: 'MANCA-Name' })],
    modules: [{ '(ID)': 'ORFANO' }], modEff: {}, cargo: [{ '(ID)': 'A', StackValue: 'dieci', Attractable: 'forse' }], items: [],
    locKeys: new Set(['A-Name', 'B-Name']), locEnglish: new Map([['A-Name', 'diverso']]), links: {},
  });
  const by = c => res.find(r => r.code === c);
  assert.deepEqual(by('ent-type').items, ['B = "Boh"']);
  assert.ok(by('ent-rarity') && by('ent-price') && by('ent-icon'));
  assert.deepEqual(by('mod-no-entity').items, ['ORFANO']);
  assert.ok(by('cargo-stack') && by('cargo-bool'));
  assert.deepEqual(by('loc-label-key').items, ['C → MANCA-Name']);
  assert.deepEqual(by('loc-label-diff').items, ['A']);
  assert.equal(res[0].severity, 'error', 'gli errori vengono per primi');
  // la rotta funziona sul database di test e non scrive nulla
  const before = (await api('GET', '/api/history?limit=500', null, AUTH)).json.items.length;
  const r = await api('GET', '/api/quality', null, AUTH);
  assert.equal(r.status, 200); assert.ok(Array.isArray(r.json.checks));
  assert.equal((await api('GET', '/api/history?limit=500', null, AUTH)).json.items.length, before);
});
