// Gestore HTTP generico per i tab "CargoItemsAndLoots" (cargo) e "Items" (items) del foglio:
// tabelle, importazione esatta dal foglio, lettura (SOLA LETTURA) di CIDA_/LDA_/SIDA_ da Unreal.
// Rotte: /api/tabs/:tab[...], /api/sync/pull/tab/:tab, /api/sync/unreal/tab/:tab
'use strict';
const msheet = require('./modules_sheet');
const tabsSheet = require('./tabs_sheet');
const sheetMap = require('./sheet_mappings');
const { TABS, ID_KEY, SECTION_KEY } = tabsSheet;

module.exports = function createTabsHandler({ db, sendJson, readJsonBody, SheetError, UnrealError, unrealRead, fs }) {
  db.exec(`CREATE TABLE IF NOT EXISTS sheet_rows (
    tab TEXT NOT NULL, id TEXT NOT NULL, section TEXT NOT NULL, ord INTEGER NOT NULL,
    current_json TEXT NOT NULL, original_json TEXT NOT NULL, updated_at TEXT NOT NULL,
    PRIMARY KEY (tab, id))`);
  db.exec(`CREATE TABLE IF NOT EXISTS sheet_sections (
    tab TEXT NOT NULL, name TEXT NOT NULL, headers_json TEXT NOT NULL, ord INTEGER NOT NULL,
    PRIMARY KEY (tab, name))`);
  db.exec(`CREATE TABLE IF NOT EXISTS sheet_ue (
    tab TEXT NOT NULL, id TEXT NOT NULL, data_json TEXT NOT NULL, read_at TEXT NOT NULL,
    PRIMARY KEY (tab, id))`);

  const q = {
    all: db.prepare('SELECT * FROM sheet_rows WHERE tab = ? ORDER BY ord'),
    get: db.prepare('SELECT * FROM sheet_rows WHERE tab = ? AND id = ?'),
    insert: db.prepare('INSERT INTO sheet_rows (tab, id, section, ord, current_json, original_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'),
    updateCur: db.prepare('UPDATE sheet_rows SET current_json=?, updated_at=? WHERE tab=? AND id=?'),
    updateBoth: db.prepare('UPDATE sheet_rows SET section=?, current_json=?, original_json=?, updated_at=? WHERE tab=? AND id=?'),
    resetAll: db.prepare('UPDATE sheet_rows SET current_json = original_json, updated_at = ? WHERE tab = ?'),
    maxOrd: db.prepare('SELECT COALESCE(MAX(ord), -1) AS m FROM sheet_rows WHERE tab = ?'),
    sections: db.prepare('SELECT * FROM sheet_sections WHERE tab = ? ORDER BY ord'),
    clearSections: db.prepare('DELETE FROM sheet_sections WHERE tab = ?'),
    insertSection: db.prepare('INSERT INTO sheet_sections (tab, name, headers_json, ord) VALUES (?, ?, ?, ?)'),
    ueAll: db.prepare('SELECT * FROM sheet_ue WHERE tab = ?'),
    ueClear: db.prepare('DELETE FROM sheet_ue WHERE tab = ?'),
    ueInsert: db.prepare('INSERT INTO sheet_ue (tab, id, data_json, read_at) VALUES (?, ?, ?, ?)'),
  };
  const payload = row => ({ current: JSON.parse(row.current_json), original: JSON.parse(row.original_json) });

  function getAll(tab) {
    const items = [], originals = {};
    for (const row of q.all.all(tab)) { const p = payload(row); items.push(p.current); originals[row.id] = p.original; }
    const sections = q.sections.all(tab).map(s => ({ name: s.name, headers: JSON.parse(s.headers_json) }));
    const ue = {}; let readAt = null;
    for (const u of q.ueAll.all(tab)) { ue[u.id] = JSON.parse(u.data_json); readAt = u.read_at; }
    const effective = {};
    for (const it of items) effective[it[ID_KEY]] = tabsSheet.effectiveRow(tab, it, originals[it[ID_KEY]], ue[it[ID_KEY]] || null);
    return { items, originals, sections, effective, ueReadAt: readAt, ueCount: Object.keys(ue).length };
  }

  function sheetUrl(cfg) {
    if (process.env[cfg.urlEnv]) return process.env[cfg.urlEnv];
    const m = /\/spreadsheets\/d\/([^/]+)/.exec(process.env.HG_SHEET_CSV_URL || '');
    const gid = process.env[cfg.gidEnv];
    return m && gid ? `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${gid}` : '';
  }

  // Export diretto del tab (la query "gviz" perderebbe le intestazioni).
  async function fetchTab(cfg, csvText) {
    let text;
    if (csvText) text = csvText;
    else if (process.env[cfg.mockEnv]) text = fs.readFileSync(process.env[cfg.mockEnv], 'utf8');
    else {
      const url = sheetUrl(cfg);
      if (!url) throw new SheetError(`Lettura del tab ${cfg.sheetName} non configurata: imposta ${cfg.urlEnv} (oppure HG_SHEET_CSV_URL + ${cfg.gidEnv}) sul server, oppure usa "Importa CSV" con l'export del tab.`, 503);
      try {
        const r = await fetch(url, { redirect: 'follow' });
        if (!r.ok) throw new Error('HTTP ' + r.status + ' (il foglio deve essere visibile a chiunque abbia il link)');
        text = await r.text();
      } catch (e) { throw new SheetError(`Impossibile scaricare il tab ${cfg.sheetName}: ` + e.message, 502); }
    }
    const parsed = msheet.parseModulesTab(sheetMap.parseCsv(text), { defaultSection: cfg.defaultSection });
    if (!parsed.rows.length) throw new SheetError(`Nessuna riga trovata nel tab ${cfg.sheetName}: serve l'export CSV del tab, con la riga di intestazione "(ID)" o "<Sezione> (ID)".`, 502);
    const seen = new Set();
    parsed.rows = parsed.rows.filter(r => { const id = r[ID_KEY]; if (seen.has(id)) return false; seen.add(id); return true; });
    return parsed;
  }

  async function pull(cfg, { apply, skipConflicts, csv }) {
    const parsed = await fetchTab(cfg, csv);
    const dbRows = q.all.all(cfg.key).map(r => ({ id: r.id, ...payload(r) }));
    const { report, plan } = msheet.diffModules(dbRows, parsed.rows);
    report.sections = parsed.sections.map(s => ({ name: s.name, rows: parsed.rows.filter(r => r[SECTION_KEY] === s.name).length, columns: s.headers.filter(Boolean).length }));
    report.total = parsed.rows.length; report.ignoredRows = parsed.ignored; report.applied = false;
    if (!apply) return { status: 200, report };
    if (report.conflicts.length && !skipConflicts) return { status: 409, report };
    const now = new Date().toISOString();
    db.exec('BEGIN');
    try {
      let ord = q.maxOrd.get(cfg.key).m;
      for (const s of plan.insert) { const j = JSON.stringify(s); q.insert.run(cfg.key, s[ID_KEY], s[SECTION_KEY], ++ord, j, j, now); }
      for (const u of plan.update) q.updateBoth.run(u.original[SECTION_KEY], JSON.stringify(u.current), JSON.stringify(u.original), now, cfg.key, u.id);
      q.clearSections.run(cfg.key);
      parsed.sections.forEach((s, i) => q.insertSection.run(cfg.key, s.name, JSON.stringify(s.headers), i));
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    report.applied = true;
    return { status: 200, report };
  }

  // Se lo stesso ID esiste in più cartelle di Unreal si preferisce quella della sezione del foglio.
  function pick(items, prefix, secById, alias) {
    const m = new Map();
    for (const u of items) {
      if (!u.asset.startsWith(prefix)) continue;
      const id = u.asset.slice(prefix.length);
      const want = alias ? alias(secById.get(id)) : secById.get(id);
      if (!m.has(id) || u.folder === want) m.set(id, u);
    }
    return m;
  }

  async function unrealRun(cfg, apply) {
    const ueByKind = {};
    let ms = 0;
    const unloadable = [];
    for (const k of cfg.unreal) { const r = await unrealRead.readTabAssets(k, { timeoutMs: 120000 }); ueByKind[k] = r.items; unloadable.push(...(r.unloadable || [])); ms += r.ms; }
    const rows = q.all.all(cfg.key).map(r => JSON.parse(r.current_json));
    const report = tabsSheet.compareWithUnreal(cfg.key, rows, ueByKind);
    report.extra.unloadable = unloadable;
    report.applied = false; report.ms = ms;
    if (apply) {
      const secById = new Map(rows.map(r => [r[ID_KEY], r[SECTION_KEY]]));
      const data = new Map();
      const add = (key, map) => { for (const [id, u] of map) data.set(id, { ...(data.get(id) || {}), [key]: u }); };
      if (cfg.key === 'cargo') { add('cida', pick(ueByKind.cargo, 'CIDA_', secById)); add('lda', pick(ueByKind.loots, 'LDA_', secById)); }
      else add('sida', pick(ueByKind.items, 'SIDA_', secById, s => ({ BoostChargeGenerator: 'BoostCharger' }[s] || s)));
      const now = new Date().toISOString();
      db.exec('BEGIN');
      try {
        q.ueClear.run(cfg.key);
        for (const [id, d] of data) q.ueInsert.run(cfg.key, id, JSON.stringify(d), now);
        db.exec('COMMIT');
      } catch (e) { db.exec('ROLLBACK'); throw e; }
      report.applied = true;
    }
    return report;
  }

  return async function handle(req, res, urlPath, query) {
    let m;
    if ((m = urlPath.match(/^\/api\/tabs\/(cargo|items)$/)) && req.method === 'GET') { sendJson(res, 200, getAll(m[1])); return true; }
    if ((m = urlPath.match(/^\/api\/tabs\/(cargo|items)\/reset-all$/)) && req.method === 'POST') {
      q.resetAll.run(new Date().toISOString(), m[1]); sendJson(res, 200, getAll(m[1])); return true;
    }
    if ((m = urlPath.match(/^\/api\/tabs\/(cargo|items)\/([^/]+)$/)) && req.method === 'PUT') {
      const id = decodeURIComponent(m[2]);
      const row = q.get.get(m[1], id);
      if (!row) { sendJson(res, 404, { error: 'riga non trovata' }); return true; }
      const body = await readJsonBody(req);
      const cur = JSON.parse(row.current_json);
      for (const [k, v] of Object.entries(body.fields || {})) {
        if (k === ID_KEY || k === SECTION_KEY || !(k in cur)) continue;
        cur[k] = v === null || v === undefined ? '' : String(v);
      }
      q.updateCur.run(JSON.stringify(cur), new Date().toISOString(), m[1], id);
      sendJson(res, 200, payload(q.get.get(m[1], id))); return true;
    }
    if ((m = urlPath.match(/^\/api\/tabs\/(cargo|items)\/([^/]+)\/revert$/)) && req.method === 'POST') {
      const id = decodeURIComponent(m[2]);
      const row = q.get.get(m[1], id);
      if (!row) { sendJson(res, 404, { error: 'riga non trovata' }); return true; }
      q.updateCur.run(row.original_json, new Date().toISOString(), m[1], id);
      sendJson(res, 200, payload(q.get.get(m[1], id))); return true;
    }
    if ((m = urlPath.match(/^\/api\/sync\/pull\/tab\/(cargo|items)$/)) && req.method === 'POST') {
      const body = await readJsonBody(req);
      const out = await pull(TABS[m[1]], { apply: query.get('apply') === '1', skipConflicts: query.get('skipConflicts') === '1', csv: typeof body.csv === 'string' ? body.csv : '' });
      sendJson(res, out.status, out.report); return true;
    }
    if ((m = urlPath.match(/^\/api\/sync\/unreal\/tab\/(cargo|items)$/)) && req.method === 'POST') {
      try { sendJson(res, 200, await unrealRun(TABS[m[1]], query.get('apply') === '1')); }
      catch (e) { if (e instanceof UnrealError) sendJson(res, e.status, { ok: false, error: e.message, code: e.code }); else throw e; }
      return true;
    }
    return false;
  };
};
