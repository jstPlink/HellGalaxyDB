// Condizioni di sblocco impostate nell'app (evento + stazione per modulo). Non tocca Unreal né i fogli Google:
// prevalgono sulle regole importate dal foglio STATIONS (GenericLockRules) per quell'entità.
//   GET /api/unlock-conditions            -> { items: { "<EntityID>": { event, station, user, at } } }
//   PUT /api/unlock-conditions { id, event, station } -> salva (evento e stazione vuoti = toglie l'impostazione)
// L'evento si salva SENZA il prefisso "EV_" (viene aggiunto in visualizzazione).
'use strict';

module.exports = function createUnlockConditions({ db, sendJson, readJsonBody }) {
  db.exec(`CREATE TABLE IF NOT EXISTS unlock_conditions (entity_id TEXT PRIMARY KEY, event TEXT NOT NULL, station TEXT NOT NULL, user TEXT, at TEXT)`);
  const stationIds = () => {
    const out = new Set();
    try { for (const r of db.prepare("SELECT cells_json FROM grid_rows WHERE tab = 'stationrules' ORDER BY row_no").all()) { const v = String(JSON.parse(r.cells_json)[0] || '').trim(); if (v && v !== 'SpaceStationID') out.add(v); } } catch (e) { /* tab non importato */ }
    return out;
  };
  return async function handle(req, res, urlPath) {
    if (urlPath === '/api/unlock-conditions' && req.method === 'GET') {
      const items = {};
      for (const r of db.prepare('SELECT * FROM unlock_conditions').all()) items[r.entity_id] = { event: r.event, station: r.station, user: r.user, at: r.at };
      sendJson(res, 200, { items }); return true;
    }
    if (urlPath === '/api/unlock-conditions' && req.method === 'PUT') {
      const b = await readJsonBody(req), id = String(b.id || '').trim();
      let event = String(b.event || '').trim().replace(/^EV_/i, ''), station = String(b.station || '').trim();
      if (!id || id.length > 200) { sendJson(res, 400, { error: 'ID non valido' }); return true; }
      if (!/^[A-Za-z0-9_.\-]*$/.test(event) || event.length > 200) { sendJson(res, 400, { error: 'evento non valido (lettere, numeri, - _ .)' }); return true; }
      if (station) { const st = stationIds(); if (st.size && !st.has(station)) { sendJson(res, 400, { error: 'stazione sconosciuta: ' + station }); return true; } }
      const user = String(req.headers['x-hg-user'] ? decodeURIComponent(String(req.headers['x-hg-user'])) : 'sistema').slice(0, 60);
      const old = db.prepare('SELECT event, station FROM unlock_conditions WHERE entity_id = ?').get(id);
      const fmt = (e, s) => (e ? 'EV_' + e : '') + (e && s ? ' @ ' : '') + s;
      const oldS = old ? fmt(old.event, old.station) : '', newS = fmt(event, station);
      if (oldS === newS) { sendJson(res, 200, { ok: true, unchanged: true }); return true; }
      if (!event && !station) db.prepare('DELETE FROM unlock_conditions WHERE entity_id = ?').run(id);
      else db.prepare('INSERT OR REPLACE INTO unlock_conditions (entity_id, event, station, user, at) VALUES (?, ?, ?, ?, ?)').run(id, event, station, user, new Date().toISOString());
      try { db.prepare('INSERT INTO history (at, user, area, row_id, field, old, new, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(new Date().toISOString(), user, 'MODULES', id, 'condizione di sblocco', oldS, newS, 'modifica'); } catch (e) { /* cronologia opzionale */ }
      sendJson(res, 200, { ok: true }); return true;
    }
    return false;
  };
};
