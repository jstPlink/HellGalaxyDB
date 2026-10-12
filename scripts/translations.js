// Traduzioni dei testi (per il narrative): una per chiave di localizzazione e lingua. Oggi solo l'italiano ('it'), scritto
// nell'app (il Localization Master di ENTITIES ha solo la colonna ENGLISH). Non tocca Unreal né i fogli Google.
//   GET /api/translations?lang=it           -> { items: { "<chiave>": "<testo>" } }
//   PUT /api/translations { key, lang, text } -> salva (testo vuoto = toglie la traduzione); registrata in cronologia
'use strict';
const LANGS = ['it'];

module.exports = function createTranslations({ db, sendJson, readJsonBody }) {
  db.exec(`CREATE TABLE IF NOT EXISTS translations (key TEXT NOT NULL, lang TEXT NOT NULL, text TEXT NOT NULL, user TEXT, at TEXT, PRIMARY KEY (key, lang))`);
  return async function handle(req, res, urlPath, query) {
    if (urlPath === '/api/translations' && req.method === 'GET') {
      const lang = String(query.get('lang') || 'it');
      if (!LANGS.includes(lang)) { sendJson(res, 400, { error: 'lingua non supportata: ' + LANGS.join(', ') }); return true; }
      const items = {};
      for (const r of db.prepare('SELECT key, text FROM translations WHERE lang = ?').all(lang)) items[r.key] = r.text;
      sendJson(res, 200, { lang, items }); return true;
    }
    if (urlPath === '/api/translations' && req.method === 'PUT') {
      const b = await readJsonBody(req), key = String(b.key || '').trim(), lang = String(b.lang || 'it'), text = String(b.text ?? '');
      if (!key || key.length > 200) { sendJson(res, 400, { error: 'chiave non valida' }); return true; }
      if (!LANGS.includes(lang)) { sendJson(res, 400, { error: 'lingua non supportata: ' + LANGS.join(', ') }); return true; }
      if (text.length > 4000) { sendJson(res, 400, { error: 'testo troppo lungo (massimo 4000 caratteri)' }); return true; }
      const user = String(req.headers['x-hg-user'] ? decodeURIComponent(String(req.headers['x-hg-user'])) : 'sistema').slice(0, 60);
      const old = db.prepare('SELECT text FROM translations WHERE key = ? AND lang = ?').get(key, lang);
      if ((old ? old.text : '') === text) { sendJson(res, 200, { ok: true, unchanged: true }); return true; }
      if (text.trim() === '') db.prepare('DELETE FROM translations WHERE key = ? AND lang = ?').run(key, lang);
      else db.prepare('INSERT OR REPLACE INTO translations (key, lang, text, user, at) VALUES (?, ?, ?, ?, ?)').run(key, lang, text, user, new Date().toISOString());
      try { db.prepare('INSERT INTO history (at, user, area, row_id, field, old, new, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(new Date().toISOString(), user, 'Localization', key, 'traduzione ' + lang.toUpperCase(), (old ? old.text : '').slice(0, 2000), text.slice(0, 2000), 'modifica'); } catch (e) { /* cronologia opzionale */ }
      sendJson(res, 200, { ok: true }); return true;
    }
    return false;
  };
};
