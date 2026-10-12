// Condizioni di sblocco impostate nell'app: uno o più eventi (+ una stazione) per modulo, e uno o più eventi per stazione.
// Non toccano Unreal né i fogli Google: prevalgono sulle regole importate dal foglio STATIONS per quell'entità/stazione.
//   GET /api/unlock-conditions            -> { items: { "<EntityID>": { events:[...], event, station, user, at } } }
//   PUT /api/unlock-conditions { id, events:[...] | event, station } -> salva (eventi e stazione vuoti = toglie l'impostazione)
//   GET /api/station-unlocks              -> { items: { "<SpaceStationID>": { events:[...], user, at } } }
//   PUT /api/station-unlocks { id, events:[...] } -> salva (nessun evento = toglie l'impostazione)
// Gli eventi si salvano SENZA il prefisso "EV_" (viene aggiunto in visualizzazione), uno per riga nel campo di testo.
'use strict';

module.exports = function createUnlockConditions({ db, sendJson, readJsonBody }) {
  db.exec(`CREATE TABLE IF NOT EXISTS unlock_conditions (entity_id TEXT PRIMARY KEY, event TEXT NOT NULL, station TEXT NOT NULL, user TEXT, at TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS station_unlocks (station_id TEXT PRIMARY KEY, events TEXT NOT NULL, user TEXT, at TEXT)`);
  const stationIds = () => {
    const out = new Set();
    try { for (const r of db.prepare("SELECT cells_json FROM grid_rows WHERE tab = 'stationrules' ORDER BY row_no").all()) { const v = String(JSON.parse(r.cells_json)[0] || '').trim(); if (v && v !== 'SpaceStationID') out.add(v); } } catch (e) { /* tab non importato */ }
    return out;
  };
  const userOf = req => String(req.headers['x-hg-user'] ? decodeURIComponent(String(req.headers['x-hg-user'])) : 'sistema').slice(0, 60);
  // Elenco di eventi dal corpo ({events:[...]} oppure {event:"..."}): senza prefisso EV_, senza doppioni; null se non valido.
  const parseEvents = b => {
    const src = Array.isArray(b.events) ? b.events : (b.event !== undefined ? String(b.event).split(/\r?\n/) : []);
    const out = [];
    for (const x of src) {
      const e = String(x ?? '').trim().replace(/^EV_/i, '');
      if (!e) continue;
      if (!/^[A-Za-z0-9_.\-]+$/.test(e) || e.length > 200) return null;
      if (!out.includes(e)) out.push(e);
    }
    return out.length > 20 ? null : out;
  };
  const fmtEv = evs => evs.map(e => 'EV_' + e).join(', ');
  const hist = (user, area, id, field, oldV, newV) => {
    try { db.prepare('INSERT INTO history (at, user, area, row_id, field, old, new, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(new Date().toISOString(), user, area, id, field, oldV, newV, 'modifica'); } catch (e) { /* cronologia opzionale */ }
  };
  const split = s => String(s || '').split('\n').filter(Boolean);
  return async function handle(req, res, urlPath) {
    if (urlPath === '/api/unlock-conditions' && req.method === 'GET') {
      const items = {};
      for (const r of db.prepare('SELECT * FROM unlock_conditions').all()) { const events = split(r.event); items[r.entity_id] = { events, event: events[0] || '', station: r.station, user: r.user, at: r.at }; }
      sendJson(res, 200, { items }); return true;
    }
    if (urlPath === '/api/unlock-conditions' && req.method === 'PUT') {
      const b = await readJsonBody(req), id = String(b.id || '').trim(), events = parseEvents(b), station = String(b.station || '').trim();
      if (!id || id.length > 200) { sendJson(res, 400, { error: 'ID non valido' }); return true; }
      if (!events) { sendJson(res, 400, { error: 'evento non valido (lettere, numeri, - _ .; al massimo 20)' }); return true; }
      if (station) { const st = stationIds(); if (st.size && !st.has(station)) { sendJson(res, 400, { error: 'stazione sconosciuta: ' + station }); return true; } }
      const user = userOf(req), old = db.prepare('SELECT event, station FROM unlock_conditions WHERE entity_id = ?').get(id);
      const fmt = (evs, s) => fmtEv(evs) + (evs.length && s ? ' @ ' : '') + s;
      const oldS = old ? fmt(split(old.event), old.station) : '', newS = fmt(events, station);
      if (oldS === newS) { sendJson(res, 200, { ok: true, unchanged: true }); return true; }
      if (!events.length && !station) db.prepare('DELETE FROM unlock_conditions WHERE entity_id = ?').run(id);
      else db.prepare('INSERT OR REPLACE INTO unlock_conditions (entity_id, event, station, user, at) VALUES (?, ?, ?, ?, ?)').run(id, events.join('\n'), station, user, new Date().toISOString());
      hist(user, 'MODULES', id, 'condizione di sblocco', oldS, newS);
      sendJson(res, 200, { ok: true }); return true;
    }
    if (urlPath === '/api/station-unlocks' && req.method === 'GET') {
      const items = {};
      for (const r of db.prepare('SELECT * FROM station_unlocks').all()) items[r.station_id] = { events: split(r.events), user: r.user, at: r.at };
      sendJson(res, 200, { items }); return true;
    }
    if (urlPath === '/api/station-unlocks' && req.method === 'PUT') {
      const b = await readJsonBody(req), id = String(b.id || '').trim(), events = parseEvents(b);
      if (!id || id.length > 200) { sendJson(res, 400, { error: 'ID non valido' }); return true; }
      if (!events) { sendJson(res, 400, { error: 'evento non valido (lettere, numeri, - _ .; al massimo 20)' }); return true; }
      const st = stationIds(); if (st.size && !st.has(id)) { sendJson(res, 400, { error: 'stazione sconosciuta: ' + id }); return true; }
      const user = userOf(req), old = db.prepare('SELECT events FROM station_unlocks WHERE station_id = ?').get(id);
      const oldS = old ? fmtEv(split(old.events)) : '', newS = fmtEv(events);
      if (oldS === newS) { sendJson(res, 200, { ok: true, unchanged: true }); return true; }
      if (!events.length) db.prepare('DELETE FROM station_unlocks WHERE station_id = ?').run(id);
      else db.prepare('INSERT OR REPLACE INTO station_unlocks (station_id, events, user, at) VALUES (?, ?, ?, ?)').run(id, events.join('\n'), user, new Date().toISOString());
      hist(user, 'Stations', id, 'eventi di sblocco', oldS, newS);
      sendJson(res, 200, { ok: true }); return true;
    }
    return false;
  };
};
