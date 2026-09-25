// Server statico + API REST per Hell Galaxy Database.
// Nessuna dipendenza npm: usa solo i moduli integrati di Node (http, fs, path,
// node:sqlite - richiede Node 22.5+, stabile senza flag da Node 24).
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const ROOT = __dirname;
const DB_PATH = path.join(ROOT, 'data', 'hellgalaxy.db');
const IMAGES_DIR = path.join(ROOT, 'images');
const PORT = 8936;

if (!fs.existsSync(DB_PATH)) {
  console.error(`Database non trovato: ${DB_PATH}`);
  console.error('Esegui prima: node scripts/migrate_to_db.js');
  process.exit(1);
}
const db = new DatabaseSync(DB_PATH);

function tableExists(name) {
  return !!db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(name);
}
if (!tableExists('enemies')) {
  console.error('Tabella "enemies" non trovata nel database.');
  console.error('Esegui prima: node scripts/migrate_enemies_to_db.js');
  process.exit(1);
}

const CAT_CLASS_FIELD = { body: null, engine: null, primary: 'WeaponClass', secondary: 'WeaponClass' };
const CATS_ORDER = ['body', 'engine', 'primary', 'secondary'];

function sanitizeFileName(s) { return String(s).replace(/[^A-Za-z0-9_.-]/g, '_'); }

/* ============================== DB HELPERS ============================== */
const stmts = {
  allModules: db.prepare('SELECT * FROM modules'),
  getModule: db.prepare('SELECT * FROM modules WHERE id = ?'),
  updateModule: db.prepare(`UPDATE modules SET category=?, class=?, name=?, rarity=?, price=?, producer=?, current_json=?, updated_at=? WHERE id=?`),
  resetAll: db.prepare(`UPDATE modules SET current_json = original_json, updated_at = ?`),
  allProducers: db.prepare('SELECT * FROM producers ORDER BY name'),
  upsertProducer: db.prepare(`
    INSERT INTO producers (name, image, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET image = excluded.image, updated_at = excluded.updated_at
  `),
  deleteProducer: db.prepare('DELETE FROM producers WHERE name = ?'),
  allEnemies: db.prepare('SELECT * FROM enemies'),
  getEnemy: db.prepare('SELECT * FROM enemies WHERE id = ?'),
  updateEnemy: db.prepare('UPDATE enemies SET current_json=?, updated_at=? WHERE id=?'),
  resetAllEnemies: db.prepare('UPDATE enemies SET current_json = original_json, updated_at = ?'),
};

function rowToPayload(row) {
  return { current: JSON.parse(row.current_json), original: JSON.parse(row.original_json) };
}

function getAllData() {
  const categories = {};
  CATS_ORDER.forEach(id => { categories[id] = { items: [], originals: {} }; });
  for (const row of stmts.allModules.all()) {
    const cat = categories[row.category];
    if (!cat) continue;
    const { current, original } = rowToPayload(row);
    cat.items.push(current);
    cat.originals[row.id] = original;
  }
  const producers = {};
  for (const p of stmts.allProducers.all()) { if (p.image) producers[p.name] = p.image; }
  return { categories, producers };
}

function writeModuleImageIfNeeded(catId, id, fields) {
  if (!('Image' in fields)) return;
  const val = fields.Image;
  const relDir = path.join('images', catId);
  const absPath = path.join(ROOT, relDir, sanitizeFileName(id) + '.jpg');
  if (typeof val === 'string' && val.startsWith('data:')) {
    const base64 = val.split(',')[1] || '';
    fs.mkdirSync(path.join(ROOT, relDir), { recursive: true });
    fs.writeFileSync(absPath, Buffer.from(base64, 'base64'));
    fields.Image = '/' + relDir.replace(/\\/g, '/') + '/' + sanitizeFileName(id) + '.jpg';
  } else if (val === '') {
    try { fs.unlinkSync(absPath); } catch (e) { /* già assente */ }
  }
}

function updateModule(id, fields) {
  const row = stmts.getModule.get(id);
  if (!row) return null;
  const current = JSON.parse(row.current_json);
  writeModuleImageIfNeeded(row.category, id, fields);
  Object.assign(current, fields);
  const classField = CAT_CLASS_FIELD[row.category];
  const now = new Date().toISOString();
  stmts.updateModule.run(
    row.category,
    classField ? (current[classField] || null) : null,
    current.Name || '',
    current.Rarity || '',
    Number(current.Price) || 0,
    current.Producer || '',
    JSON.stringify(current),
    now,
    id
  );
  return rowToPayload(stmts.getModule.get(id));
}

function revertModule(id) {
  const row = stmts.getModule.get(id);
  if (!row) return null;
  const original = JSON.parse(row.original_json);
  const classField = CAT_CLASS_FIELD[row.category];
  const now = new Date().toISOString();
  stmts.updateModule.run(
    row.category,
    classField ? (original[classField] || null) : null,
    original.Name || '',
    original.Rarity || '',
    Number(original.Price) || 0,
    original.Producer || '',
    row.original_json,
    now,
    id
  );
  return rowToPayload(stmts.getModule.get(id));
}

function resetAllModules() {
  stmts.resetAll.run(new Date().toISOString());
  for (const row of stmts.allModules.all()) {
    const original = JSON.parse(row.original_json);
    const classField = CAT_CLASS_FIELD[row.category];
    stmts.updateModule.run(
      row.category,
      classField ? (original[classField] || null) : null,
      original.Name || '',
      original.Rarity || '',
      Number(original.Price) || 0,
      original.Producer || '',
      row.original_json,
      row.updated_at,
      row.id
    );
  }
}

function recomputeEnemyDerived(e) {
  e.ehp = (Number(e.integrity) || 0) + (Number(e.shield) || 0);
  e.threatIndex = Math.round(Math.sqrt(e.ehp * Math.max(Number(e.dps) || 0, 1)));
  return e;
}

function getAllEnemies() {
  const items = [], originals = {};
  for (const row of stmts.allEnemies.all()) {
    const { current, original } = rowToPayload(row);
    items.push(current);
    originals[row.id] = original;
  }
  return { items, originals };
}

function updateEnemy(id, fields) {
  const row = stmts.getEnemy.get(id);
  if (!row) return null;
  const current = JSON.parse(row.current_json);
  Object.assign(current, fields);
  recomputeEnemyDerived(current);
  const now = new Date().toISOString();
  stmts.updateEnemy.run(JSON.stringify(current), now, id);
  return rowToPayload(stmts.getEnemy.get(id));
}

function revertEnemy(id) {
  const row = stmts.getEnemy.get(id);
  if (!row) return null;
  const now = new Date().toISOString();
  stmts.updateEnemy.run(row.original_json, now, id);
  return rowToPayload(stmts.getEnemy.get(id));
}

function resetAllEnemiesFn() {
  stmts.resetAllEnemies.run(new Date().toISOString());
}

function setProducerImage(name, dataURL) {
  const relDir = 'images/producers';
  const absPath = path.join(ROOT, relDir, sanitizeFileName(name) + '.jpg');
  fs.mkdirSync(path.join(ROOT, relDir), { recursive: true });
  const base64 = dataURL.split(',')[1] || '';
  fs.writeFileSync(absPath, Buffer.from(base64, 'base64'));
  const image = '/' + relDir + '/' + sanitizeFileName(name) + '.jpg';
  stmts.upsertProducer.run(name, image, new Date().toISOString());
  return image;
}

function removeProducerImage(name) {
  const absPath = path.join(ROOT, 'images', 'producers', sanitizeFileName(name) + '.jpg');
  try { fs.unlinkSync(absPath); } catch (e) { /* già assente */ }
  stmts.deleteProducer.run(name);
}

/* ============================== HTTP ============================== */
function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 20 * 1024 * 1024) req.destroy(); // limite 20MB per richiesta
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

const MIME = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.js': 'text/javascript', '.css': 'text/css' };

function serveStatic(req, res, urlPath) {
  const rel = urlPath === '/' ? 'hellgalaxy.html' : decodeURIComponent(urlPath).replace(/^\/+/, '');
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const [urlPath, ] = req.url.split('?');

  try {
    if (urlPath === '/api/data' && req.method === 'GET') {
      return sendJson(res, 200, getAllData());
    }

    let m;
    if ((m = urlPath.match(/^\/api\/modules\/([^/]+)$/)) && req.method === 'PUT') {
      const body = await readJsonBody(req);
      const result = updateModule(decodeURIComponent(m[1]), body.fields || {});
      if (!result) return sendJson(res, 404, { error: 'modulo non trovato' });
      return sendJson(res, 200, result);
    }
    if ((m = urlPath.match(/^\/api\/modules\/([^/]+)\/revert$/)) && req.method === 'POST') {
      const result = revertModule(decodeURIComponent(m[1]));
      if (!result) return sendJson(res, 404, { error: 'modulo non trovato' });
      return sendJson(res, 200, result);
    }
    if (urlPath === '/api/modules/reset-all' && req.method === 'POST') {
      resetAllModules();
      return sendJson(res, 200, getAllData());
    }
    if ((m = urlPath.match(/^\/api\/producers\/([^/]+)$/)) && req.method === 'PUT') {
      const body = await readJsonBody(req);
      const image = setProducerImage(decodeURIComponent(m[1]), body.image || '');
      return sendJson(res, 200, { name: decodeURIComponent(m[1]), image });
    }
    if ((m = urlPath.match(/^\/api\/producers\/([^/]+)$/)) && req.method === 'DELETE') {
      removeProducerImage(decodeURIComponent(m[1]));
      return sendJson(res, 200, { ok: true });
    }

    if (urlPath === '/api/enemies' && req.method === 'GET') {
      return sendJson(res, 200, getAllEnemies());
    }
    if ((m = urlPath.match(/^\/api\/enemies\/([^/]+)$/)) && req.method === 'PUT') {
      const body = await readJsonBody(req);
      const result = updateEnemy(decodeURIComponent(m[1]), body.fields || {});
      if (!result) return sendJson(res, 404, { error: 'nemico non trovato' });
      return sendJson(res, 200, result);
    }
    if ((m = urlPath.match(/^\/api\/enemies\/([^/]+)\/revert$/)) && req.method === 'POST') {
      const result = revertEnemy(decodeURIComponent(m[1]));
      if (!result) return sendJson(res, 404, { error: 'nemico non trovato' });
      return sendJson(res, 200, result);
    }
    if (urlPath === '/api/enemies/reset-all' && req.method === 'POST') {
      resetAllEnemiesFn();
      return sendJson(res, 200, getAllEnemies());
    }

    if (urlPath.startsWith('/api/')) return sendJson(res, 404, { error: 'endpoint non trovato' });
    return serveStatic(req, res, urlPath);
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: err.message });
  }
});

server.listen(PORT, () => console.log(`Hell Galaxy Database in ascolto su http://localhost:${PORT}`));
