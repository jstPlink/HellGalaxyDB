// Media dei moduli e delle entità: texture (icone degli EDA_) e mesh (static mesh degli SMDA_) esportate da Unreal.
// L'Editor le esporta in sola lettura (scripts/unreal/media_export.py), l'agente le carica qui; l'app le conserva in
// <cartella del database>/media/{textures,meshes,previews}:
//   textures/<nome>.png   icona (leggera, caricata subito dalla UI)
//   previews/<nome>.png   anteprima della mesh (generata qui dall'OBJ che l'agente manda; l'OBJ viene poi scartato)
//   meshes/<nome>.fbx     file 3D: si scarica solo a richiesta (GET /api/media/mesh/<nome>.fbx)
// Rotte:  POST /api/media/upload (solo agente) · GET /media/textures|previews/<nome>.png (pubbliche come images/)
//         GET /api/media · GET /api/media/mesh/<nome>.fbx · POST/GET /api/media/sync · GET /api/storage
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const PY = path.join(__dirname, 'unreal', 'media_export.py');
const NAME_RE = /^[A-Za-z0-9_.\-]{1,160}$/;
const KINDS = { texture: { dir: 'textures', ext: '.png' }, mesh: { dir: 'meshes', ext: '.fbx' }, obj: { dir: null, ext: '.obj' }, preview: { dir: 'previews', ext: '.png' } };
const MAX_UPLOAD = 1024 * 1024 * 1024;

// ---------- anteprima della mesh: rasterizzatore software da OBJ a PNG (nessuna dipendenza) ----------
function parseObj(text) {
  const V = [], tris = [];
  for (const line of text.split('\n')) {
    if (line.charCodeAt(0) === 118 && line.charCodeAt(1) === 32) { const p = line.trim().split(/\s+/); V.push([+p[1], +p[2], +p[3]]); }
    else if (line.charCodeAt(0) === 102 && line.charCodeAt(1) === 32) {
      const idx = line.trim().split(/\s+/).slice(1).map(s => { const i = parseInt(s, 10); return i < 0 ? V.length + i : i - 1; });
      for (let k = 1; k + 1 < idx.length; k++) tris.push(idx[0], idx[k], idx[k + 1]);
    }
  }
  return { V, tris };
}

function crc32(buf) { return zlib.crc32 ? zlib.crc32(buf) >>> 0 : (() => { let c, crc = ~0; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1; crc = (crc >>> 8) ^ c; } return ~crc >>> 0; })(); }
function encodePng(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const chunk = (type, data) => { const b = Buffer.alloc(12 + data.length); b.writeUInt32BE(data.length, 0); b.write(type, 4, 'ascii'); data.copy(b, 8); b.writeUInt32BE(crc32(b.subarray(4, 8 + data.length)), 8 + data.length); return b; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// Vista 3/4 (Unreal è Z-up), luce frontale, sfondo trasparente, antialias 2x2.
function renderPreview(objText, size = 256) {
  const { V, tris } = parseObj(objText);
  if (!V.length || !tris.length) throw new Error('mesh senza triangoli');
  const az = -35 * Math.PI / 180, el = 25 * Math.PI / 180, ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el);
  const rot = ([x, y, z]) => { const xr = x * ca - y * sa, yr = x * sa + y * ca; return [xr, z * ce - yr * se, yr * ce + z * se]; }; // [schermo x, schermo y (su), profondità]
  const P = V.map(rot);
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const p of P) for (let i = 0; i < 3; i++) { if (p[i] < mn[i]) mn[i] = p[i]; if (p[i] > mx[i]) mx[i] = p[i]; }
  const S = size * 2, pad = 0.08 * S, scale = (S - 2 * pad) / Math.max(mx[0] - mn[0], mx[1] - mn[1], 1e-6);
  const ox = (S - (mx[0] - mn[0]) * scale) / 2, oy = (S - (mx[1] - mn[1]) * scale) / 2;
  const sx = p => ox + (p[0] - mn[0]) * scale, sy = p => S - (oy + (p[1] - mn[1]) * scale);
  const zb = new Float32Array(S * S).fill(-Infinity), col = new Uint8Array(S * S * 3), has = new Uint8Array(S * S);
  const L = [0.35, 0.55, 0.76], ln = Math.hypot(...L); L[0] /= ln; L[1] /= ln; L[2] /= ln;
  for (let t = 0; t < tris.length; t += 3) {
    const a = P[tris[t]], b = P[tris[t + 1]], c = P[tris[t + 2]];
    if (!a || !b || !c) continue;
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const nl = Math.hypot(nx, ny, nz); if (!nl) continue;
    nx /= nl; ny /= nl; nz /= nl;
    const shade = 0.22 + 0.78 * Math.abs(nx * L[0] + ny * L[1] + nz * L[2]); // due facce: il verso dei triangoli non conta
    const r = Math.min(255, 150 * shade + 8) | 0, g = Math.min(255, 175 * shade + 8) | 0, bl = Math.min(255, 210 * shade + 8) | 0;
    const x0 = sx(a), y0 = sy(a), x1 = sx(b), y1 = sy(b), x2 = sx(c), y2 = sy(c);
    const den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2); if (!den) continue;
    const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxX = Math.min(S - 1, Math.ceil(Math.max(x0, x1, x2)));
    const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2))), maxY = Math.min(S - 1, Math.ceil(Math.max(y0, y1, y2)));
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((y1 - y2) * (px - x2) + (x2 - x1) * (py - y2)) / den, w1 = ((y2 - y0) * (px - x2) + (x0 - x2) * (py - y2)) / den, w2 = 1 - w0 - w1;
      if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
      const z = w0 * a[2] + w1 * b[2] + w2 * c[2], i = y * S + x;
      if (z > zb[i]) { zb[i] = z; col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = bl; has[i] = 1; }
    }
  }
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const i = (y * 2 + dy) * S + x * 2 + dx; if (has[i]) { r += col[i * 3]; g += col[i * 3 + 1]; b += col[i * 3 + 2]; n++; } }
    const o = (y * size + x) * 4;
    if (n) { out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = n * 63.75; }
  }
  return encodePng(size, size, out);
}

module.exports = function createMedia({ db, sendJson, readJsonBody, dbPath, imagesDir, agentToken, apiToken, bridge, getAgentStatus }) {
  const base = path.join(path.dirname(dbPath), 'media');
  for (const d of ['textures', 'meshes', 'previews']) fs.mkdirSync(path.join(base, d), { recursive: true });
  db.exec(`CREATE TABLE IF NOT EXISTS media_assets (kind TEXT NOT NULL, name TEXT NOT NULL, size INTEGER NOT NULL, preview INTEGER NOT NULL DEFAULT 0, path TEXT, exported_at TEXT NOT NULL, PRIMARY KEY (kind, name))`);
  db.exec(`CREATE TABLE IF NOT EXISTS media_links (owner TEXT NOT NULL, role TEXT NOT NULL, kind TEXT NOT NULL, name TEXT NOT NULL, PRIMARY KEY (owner, role))`);

  // ---------- caricamento (solo agente, token agente) ----------
  async function upload(req, res, query) {
    const given = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    // chi può caricare: l'agente (token agente) oppure l'app locale che replica sul server (token API; se il server non ha token API, nessuna intestazione)
    const okAgent = !!agentToken && given === agentToken, okApi = apiToken ? given === apiToken : !req.headers.authorization;
    if (!okAgent && !okApi) return sendJson(res, 401, { error: 'token mancante o errato (HG_AGENT_TOKEN / HG_API_TOKEN)' });
    const k = KINDS[query.kind], file = String(query.name || '');
    if (!k || !NAME_RE.test(file) || !file.endsWith(k.ext)) return sendJson(res, 400, { error: 'tipo o nome file non validi' });
    const name = file.slice(0, -k.ext.length);
    const tmp = path.join(base, '.up-' + crypto.randomBytes(6).toString('hex'));
    let size = 0, tooBig = false;
    const ws = fs.createWriteStream(tmp);
    await new Promise((resolve, reject) => {
      req.on('data', c => { size += c.length; if (size > MAX_UPLOAD) { tooBig = true; req.destroy(); } });
      req.pipe(ws); ws.on('finish', resolve); ws.on('error', reject); req.on('error', reject); req.on('close', () => { if (tooBig) resolve(); });
    }).catch(() => { tooBig = true; });
    if (tooBig || !size) { fs.rmSync(tmp, { force: true }); return sendJson(res, tooBig ? 413 : 400, { error: tooBig ? 'file troppo grande o trasferimento interrotto' : 'file vuoto' }); }
    try {
      if (query.kind === 'obj') {
        const png = renderPreview(fs.readFileSync(tmp, 'utf8'));
        fs.writeFileSync(path.join(base, 'previews', name + '.png'), png);
        fs.rmSync(tmp, { force: true });
        db.prepare('UPDATE media_assets SET preview = 1 WHERE kind = ? AND name = ?').run('mesh', name);
        return sendJson(res, 200, { ok: true, preview: png.length });
      }
      fs.renameSync(tmp, path.join(base, k.dir, file));
      if (query.kind === 'preview') { db.prepare('UPDATE media_assets SET preview = 1 WHERE kind = ? AND name = ?').run('mesh', name); return sendJson(res, 200, { ok: true, size }); }
      db.prepare(`INSERT INTO media_assets (kind, name, size, preview, exported_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(kind, name) DO UPDATE SET size = excluded.size, exported_at = excluded.exported_at`)
        .run(query.kind, name, size, fs.existsSync(path.join(base, 'previews', name + '.png')) && query.kind === 'mesh' ? 1 : 0, new Date().toISOString());
      return sendJson(res, 200, { ok: true, size });
    } catch (e) { fs.rmSync(tmp, { force: true }); return sendJson(res, 500, { error: 'salvataggio non riuscito: ' + e.message }); }
  }

  // ---------- spazio occupato ----------
  const dirSize = d => { let n = 0; try { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); n += e.isDirectory() ? dirSize(p) : fs.statSync(p).size; } } catch (e) { /* assente */ } return n; };
  const fileSize = f => { try { return fs.statSync(f).size; } catch (e) { return 0; } };
  function storage() {
    const dataDir = path.dirname(dbPath);
    const mediaSizes = { textures: dirSize(path.join(base, 'textures')), previews: dirSize(path.join(base, 'previews')), meshes: dirSize(path.join(base, 'meshes')) };
    const media = mediaSizes.textures + mediaSizes.previews + mediaSizes.meshes;
    const database = fileSize(dbPath) + fileSize(dbPath + '-wal') + fileSize(dbPath + '-shm');
    const images = dirSize(imagesDir);
    const dataOther = Math.max(0, dirSize(dataDir) - media - database);
    const items = [{ id: 'database', label: 'Database', bytes: database }, { id: 'images', label: 'Immagini (images/)', bytes: images }, { id: 'textures', label: 'Texture (icone)', bytes: mediaSizes.textures },
      { id: 'previews', label: 'Anteprime mesh', bytes: mediaSizes.previews }, { id: 'meshes', label: 'File FBX', bytes: mediaSizes.meshes }, { id: 'data', label: 'Altri dati (CSV/JSON)', bytes: dataOther }];
    let disk = null;
    try { const s = fs.statfsSync(dataDir); disk = { free: Number(s.bavail) * Number(s.bsize), total: Number(s.blocks) * Number(s.bsize) }; } catch (e) { /* non disponibile */ }
    return { items, total: items.reduce((a, i) => a + i.bytes, 0), disk, counts: { textures: db.prepare("SELECT COUNT(*) c FROM media_assets WHERE kind='texture'").get().c, meshes: db.prepare("SELECT COUNT(*) c FROM media_assets WHERE kind='mesh'").get().c } };
  }

  // ---------- indice per la UI ----------
  function index() {
    const assets = { texture: {}, mesh: {} };
    for (const r of db.prepare('SELECT kind, name, size, preview FROM media_assets').all()) if (fs.existsSync(path.join(base, r.kind === 'mesh' ? 'meshes' : 'textures', r.name + (r.kind === 'mesh' ? '.fbx' : '.png')))) assets[r.kind][r.name] = r.kind === 'mesh' ? { size: r.size, preview: !!r.preview } : { size: r.size };
    const links = {};
    for (const r of db.prepare('SELECT owner, role, kind, name FROM media_links').all()) {
      if (!assets[r.kind][r.name]) continue;
      (links[r.owner] = links[r.owner] || {})[r.role] = r.name;
    }
    return { links, assets };
  }

  // ---------- sincronizzazione da Unreal (in background, a lotti) ----------
  let job = { running: false };
  const py = () => fs.readFileSync(PY, 'utf8').replace(/\s+$/, '');
  async function runSync({ force, limit }) {
    const st = job = { running: true, phase: 'Inventario in Unreal…', done: 0, total: 0, textures: 0, meshes: 0, errors: [], startedAt: Date.now(), finishedAt: null };
    try {
      const inv = bridge.lastJsonLine((await bridge.execPython(`${py()}\n\ninventory()\n`, { timeoutMs: 240000 })).output);
      const save = db.prepare('INSERT OR REPLACE INTO media_links (owner, role, kind, name) VALUES (?, ?, ?, ?)');
      // le mesh dei loot (LDA_) servono solo per gli ID che esistono in ENTITIES (gli altri LDA_ sono orfani)
      const entIds = new Set(db.prepare('SELECT id FROM entities').all().map(r => r.id));
      for (const m of inv.meshes) m.owners = m.owners.filter(o => !o.role.startsWith('loot_mesh_') || entIds.has(o.id));
      inv.meshes = inv.meshes.filter(m => m.owners.length);
      db.exec('BEGIN');
      try {
        db.exec('DELETE FROM media_links');
        for (const t of inv.textures) for (const o of t.owners) save.run(o.id, o.role, 'texture', t.name);
        for (const m of inv.meshes) for (const o of m.owners) save.run(o.id, o.role, 'mesh', m.name);
        db.exec('COMMIT');
      } catch (e) { db.exec('ROLLBACK'); throw e; }
      const have = new Set(db.prepare('SELECT kind, name FROM media_assets').all().map(r => r.kind + ':' + r.name));
      const seen = new Set();
      const todo = (list, kind) => list.filter(x => { const key = kind + ':' + x.name; if (seen.has(key)) { st.errors.push(`${x.name}: nome duplicato in due cartelle (${x.path}), ignorato`); return false; } seen.add(key); return force || !have.has(key); });
      let tex = todo(inv.textures, 'texture'), mes = todo(inv.meshes, 'mesh');
      if (limit > 0) { tex = tex.slice(0, limit); mes = mes.slice(0, limit); } // prova: solo i primi N
      st.total = tex.length + mes.length;
      for (const [kind, list, size] of [['texture', tex, 30], ['mesh', mes, 5]]) {
        for (let i = 0; i < list.length; i += size) {
          const part = list.slice(i, i + size);
          st.phase = (kind === 'texture' ? 'Texture ' : 'Mesh ') + Math.min(i + size, list.length) + '/' + list.length;
          try {
            const r = await bridge.execPython(`${py()}\n\nexport_batch(kind=${JSON.stringify(kind)}, paths=${JSON.stringify(part.map(x => x.path).join(','))})\n`, { timeoutMs: 600000 });
            if (!r.success) throw new Error((r.stderr || r.output).slice(0, 300));
            if (r.savedPackages && r.savedPackages.length) throw new bridge.UnrealError('Inatteso: l\'esportazione ha salvato pacchetti: ' + r.savedPackages.join(', '));
            const res = bridge.lastJsonLine(r.output);
            st[kind === 'texture' ? 'textures' : 'meshes'] += (res.uploaded || []).filter(u => u.kind === kind).length;
            for (const e of res.errors || []) st.errors.push((e.path || '') + ': ' + e.error);
          } catch (e) {
            st.errors.push(`lotto ${kind} ${i + 1}-${i + part.length}: ${e.message}`);
            if (e.code === 'agent_offline' || e.code === 'unreachable') throw e;
          }
          st.done += part.length;
        }
      }
      st.phase = 'Completato';
    } catch (e) { st.phase = 'Interrotto'; st.errors.push(e.message); }
    finally { st.running = false; st.finishedAt = Date.now(); }
  }

  // ---------- rotte ----------
  const sendFile = (req, res, file, type, extra = {}) => {
    fs.stat(file, (err, s) => {
      if (err || !s.isFile()) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': s.size, 'Cache-Control': 'public, max-age=300', ...extra });
      fs.createReadStream(file).pipe(res);
    });
  };
  async function handle(req, res, urlPath, query) {
    let m;
    if ((m = urlPath.match(/^\/media\/(textures|previews)\/([A-Za-z0-9_.\-]+\.png)$/)) && req.method === 'GET') { sendFile(req, res, path.join(base, m[1], m[2]), 'image/png'); return true; }
    if ((m = urlPath.match(/^\/api\/media\/mesh\/([A-Za-z0-9_.\-]+)\.fbx$/)) && req.method === 'GET') {
      sendFile(req, res, path.join(base, 'meshes', m[1] + '.fbx'), 'application/octet-stream', { 'Content-Disposition': `attachment; filename="${m[1]}.fbx"`, 'Cache-Control': 'no-store' }); return true;
    }
    if (urlPath === '/api/media' && req.method === 'GET') { sendJson(res, 200, index()); return true; }
    if (urlPath === '/api/storage' && req.method === 'GET') { sendJson(res, 200, storage()); return true; }
    if (urlPath === '/api/media/sync' && req.method === 'GET') { sendJson(res, 200, job); return true; }
    if (urlPath === '/api/media/sync' && req.method === 'POST') {
      if (job.running) { sendJson(res, 409, { error: 'Sincronizzazione già in corso', job }); return true; }
      const body = await readJsonBody(req);
      if (!getAgentStatus().connected) { sendJson(res, 503, { error: 'Agente Unreal non connesso: avvia l\'agente sul PC dell\'Editor (poi riprova).', code: 'agent_offline' }); return true; }
      runSync({ force: !!body.force, limit: Number(body.limit) || 0 });
      sendJson(res, 202, { started: true }); return true;
    }
    return false;
  }
  handle.upload = upload;
  handle.storage = storage;
  handle.renderPreview = renderPreview;
  handle.baseDir = base;
  return handle;
};
module.exports.renderPreview = renderPreview;
