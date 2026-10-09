// RIPRISTINO DEL SERVER dal database locale (giusto), una tantum (2026-10-09, dopo che dei test avevano scritto dati finti sul server).
// Uso: fermare l'app locale, poi
//   node scripts/ripristina_server.js            (anteprima: non scrive nulla)
//   node scripts/ripristina_server.js --applica  (riscrive sul server le righe mancanti/diverse ed elimina quelle di prova)
// Poi allinea lo stato di sincronizzazione locale (remote_state) al database locale. Servono HG_REMOTE_URL e HG_REMOTE_TOKEN nel .env.
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const APPLICA = process.argv.includes('--applica'); // senza questo parametro NON scrive nulla: mostra solo cosa farebbe
const { DatabaseSync } = require('node:sqlite');
const R = require(ROOT + '/scripts/remote_replica.js');
const env = {}; for (const l of fs.readFileSync(ROOT + '/.env', 'utf8').split(/\r?\n/)) { const m = /^\s*([A-Z_]+)=(.*)$/.exec(l); if (m) env[m[1]] = m[2]; }
const H = { Authorization: 'Bearer ' + env.HG_REMOTE_TOKEN }, S = env.HG_REMOTE_URL;
const J = { ...H, 'Content-Type': 'application/json', 'X-HG-User': encodeURIComponent('ripristino') };
const g = async u => { const r = await fetch(S + u, { headers: H }); if (!r.ok) throw new Error(u + ' -> ' + r.status); return r.json(); };
const post = async (u, body) => { const r = await fetch(S + u, { method: 'POST', headers: J, body: JSON.stringify(body) }); if (!r.ok) throw new Error(u + ' -> ' + r.status + ' ' + (await r.text()).slice(0, 200)); return r.json(); };
const info = (db, t) => db.prepare('PRAGMA table_info(' + t + ')').all();
(async () => {
  if (!env.HG_REMOTE_URL || !env.HG_REMOTE_TOKEN) throw new Error('.env incompleto');
  const db = new DatabaseSync(ROOT + '/data/hellgalaxy.db');
  const srv = (await g('/api/replica/manifest')).tables, local = R.manifest(db);
  let up = 0, del = 0;
  for (const t of R.TABLES) {
    const cols = info(db, t).map(c => c.name), pk = info(db, t).filter(c => c.pk > 0).sort((a, b) => a.pk - b.pk).map(c => c.name);
    const L = local[t] || {}, V = srv[t] || {};
    const need = Object.keys(L).filter(k => V[k] !== L[k]), gone = Object.keys(V).filter(k => L[k] === undefined);
    const sel = db.prepare('SELECT * FROM ' + t + ' WHERE ' + pk.map(c => c + ' = ?').join(' AND '));
    let batch = [], bytes = 0;
    const flush = async dels => { if (!batch.length && !dels.length) return; if (APPLICA) await post('/api/import/delta', { table: t, upserts: batch, deletes: dels }); up += batch.length; del += dels.length; batch = []; bytes = 0; };
    for (const k of need) { const row = { ...sel.get(...JSON.parse(k)) }; const sz = JSON.stringify(row).length; if (batch.length && bytes + sz > 2 * 1024 * 1024) await flush([]); batch.push(row); bytes += sz; }
    await flush(gone.map(k => Object.fromEntries(pk.map((c, i) => [c, JSON.parse(k)[i]]))));
    console.log(t.padEnd(18), 'riscritte', need.length, 'eliminate', gone.length);
  }
  if (!APPLICA) { console.log('ANTEPRIMA: nulla è stato scritto. Per ripristinare: node scripts/ripristina_server.js --applica'); db.close(); return; }
  // stato condiviso locale = database locale (il server ora è uguale)
  db.exec('BEGIN'); db.exec('DELETE FROM remote_state');
  const ins = db.prepare('INSERT INTO remote_state (t, k, h) VALUES (?, ?, ?)');
  for (const t of R.TABLES) for (const [k, h] of Object.entries(local[t] || {})) ins.run(t, k, h);
  db.exec('DELETE FROM replica_conflicts'); db.exec('COMMIT'); db.close();
  console.log('FATTO: righe riscritte', up, 'eliminate', del);
})().catch(e => { console.log('ERRORE', e.message); process.exit(1); });
