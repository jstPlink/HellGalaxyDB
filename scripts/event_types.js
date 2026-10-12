// Tipi di evento lanciabili (nome + prefisso, es. "Interaction complete" / "IC"), inseriti a mano nell'app.
// Non tocca Unreal né i fogli Google. Alla prima creazione della tabella si inseriscono IC e QE; il resto lo aggiunge l'utente.
//   GET    /api/event-types              -> { items: [{ id, name, prefix }] }
//   POST   /api/event-types {name,prefix} -> crea una riga (anche vuota)
//   PUT    /api/event-types/:id {name,prefix} -> modifica
//   DELETE /api/event-types/:id          -> elimina
'use strict';

module.exports = function createEventTypes({ db, sendJson, readJsonBody }) {
  const fresh = !db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'event_types'").get();
  db.exec(`CREATE TABLE IF NOT EXISTS event_types (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL DEFAULT '', prefix TEXT NOT NULL DEFAULT '', user TEXT, at TEXT)`);
  if (fresh) {
    const ins = db.prepare('INSERT INTO event_types (name, prefix, user, at) VALUES (?, ?, ?, ?)');
    ins.run('Interaction complete', 'IC', 'sistema', new Date().toISOString());
    ins.run('Quest end', 'QE', 'sistema', new Date().toISOString());
  }
  const userOf = req => String(req.headers['x-hg-user'] ? decodeURIComponent(String(req.headers['x-hg-user'])) : 'sistema').slice(0, 60);
  const hist = (user, id, field, oldV, newV) => {
    try { db.prepare('INSERT INTO history (at, user, area, row_id, field, old, new, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(new Date().toISOString(), user, 'Events', String(id), field, String(oldV).slice(0, 500), String(newV).slice(0, 500), 'modifica'); } catch (e) { /* cronologia opzionale */ }
  };
  const clean = b => ({ name: String(b.name ?? '').trim().slice(0, 120), prefix: String(b.prefix ?? '').trim().replace(/^["']|["']$/g, '').slice(0, 30) });
  return async function handle(req, res, urlPath) {
    let m;
    if (urlPath === '/api/event-types' && req.method === 'GET') {
      sendJson(res, 200, { items: db.prepare('SELECT id, name, prefix FROM event_types ORDER BY id').all() }); return true;
    }
    if (urlPath === '/api/event-types' && req.method === 'POST') {
      const c = clean(await readJsonBody(req)), user = userOf(req);
      if (c.prefix && !/^[A-Za-z0-9_]+$/.test(c.prefix)) { sendJson(res, 400, { error: 'prefisso non valido (lettere, numeri, _)' }); return true; }
      const r = db.prepare('INSERT INTO event_types (name, prefix, user, at) VALUES (?, ?, ?, ?)').run(c.name, c.prefix, user, new Date().toISOString());
      hist(user, r.lastInsertRowid, 'nuovo tipo di evento', '', c.name + ' / ' + c.prefix);
      sendJson(res, 200, { ok: true, id: Number(r.lastInsertRowid) }); return true;
    }
    if ((m = urlPath.match(/^\/api\/event-types\/(\d+)$/))) {
      const id = Number(m[1]), old = db.prepare('SELECT name, prefix FROM event_types WHERE id = ?').get(id);
      if (!old) { sendJson(res, 404, { error: 'riga non trovata' }); return true; }
      const user = userOf(req);
      if (req.method === 'PUT') {
        const c = clean(await readJsonBody(req));
        if (c.prefix && !/^[A-Za-z0-9_]+$/.test(c.prefix)) { sendJson(res, 400, { error: 'prefisso non valido (lettere, numeri, _)' }); return true; }
        if (c.name !== old.name) hist(user, id, 'nome evento', old.name, c.name);
        if (c.prefix !== old.prefix) hist(user, id, 'prefisso evento', old.prefix, c.prefix);
        db.prepare('UPDATE event_types SET name = ?, prefix = ?, user = ?, at = ? WHERE id = ?').run(c.name, c.prefix, user, new Date().toISOString(), id);
        sendJson(res, 200, { ok: true }); return true;
      }
      if (req.method === 'DELETE') {
        db.prepare('DELETE FROM event_types WHERE id = ?').run(id);
        hist(user, id, 'tipo di evento eliminato', old.name + ' / ' + old.prefix, '');
        sendJson(res, 200, { ok: true }); return true;
      }
    }
    return false;
  };
};
