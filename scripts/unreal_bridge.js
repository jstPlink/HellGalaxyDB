// Client minimo per il server MCP dell'Editor Unreal (UE 5.8), usato dall'app per
// eseguire Python dentro l'Editor aperto. Nessuna dipendenza npm: solo fetch.
//
// Protocollo (verificato il 2026-10-07): POST JSON-RPC su HG_UE_MCP_URL
// (default http://127.0.0.1:8010/mcp) con Accept "application/json,text/event-stream";
// initialize -> header Mcp-Session-Id da rimandare -> notifications/initialized ->
// tools/call execute_python_code { code, auto_save: "false" }.
// "auto_save" va SEMPRE passato a "false": altrimenti l'Editor salva tutto il
// contenuto sporco prima di eseguire.
'use strict';

const MCP_URL = () => process.env.HG_UE_MCP_URL || 'http://127.0.0.1:8010/mcp';
const DEFAULT_TIMEOUT_MS = Number(process.env.HG_UE_TIMEOUT_MS) || 120000;

class UnrealError extends Error {
  constructor(message, status, code) { super(message); this.status = status || 502; this.code = code || 'unreal_error'; }
}

let sessionId = null;
let nextId = 1;

function parseBody(text, contentType) {
  // Risposta JSON semplice oppure SSE ("data: {...}")
  if ((contentType || '').includes('text/event-stream')) {
    const datas = text.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).filter(Boolean);
    if (!datas.length) throw new UnrealError('Risposta MCP vuota.');
    return JSON.parse(datas[datas.length - 1]);
  }
  return JSON.parse(text);
}

async function rpc(body, { timeoutMs = DEFAULT_TIMEOUT_MS, withSession = true } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json,text/event-stream' };
    if (withSession && sessionId) headers['Mcp-Session-Id'] = sessionId;
    const res = await fetch(MCP_URL(), { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal });
    const sid = res.headers.get('mcp-session-id');
    if (sid) sessionId = sid;
    const text = await res.text();
    if (!res.ok) {
      if (res.status === 404 || res.status === 400) sessionId = null; // sessione scaduta: si reinizializza
      throw new UnrealError(`Il server MCP dell'Editor ha risposto HTTP ${res.status}.`, 502, 'http_' + res.status);
    }
    if (!text.trim()) return null; // notifiche: nessun corpo
    return parseBody(text, res.headers.get('content-type'));
  } catch (e) {
    if (e instanceof UnrealError) throw e;
    if (e.name === 'AbortError') throw new UnrealError(`Timeout dopo ${Math.round(timeoutMs / 1000)} s: l'Editor potrebbe essere occupato (compilazione, salvataggio) oppure bloccato.`, 504, 'timeout');
    const code = (e.cause && e.cause.code) || e.code || '';
    if (code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'UND_ERR_SOCKET' || /fetch failed/i.test(e.message)) {
      throw new UnrealError(`Editor non raggiungibile su ${MCP_URL()}: apri il progetto HellGalaxy in Unreal e controlla che il server MCP sia attivo (porta 8010, console: ModelContextProtocol.StartServer 8010).`, 503, 'unreachable');
    }
    throw new UnrealError('Errore di comunicazione con l\'Editor: ' + e.message, 502, 'comm');
  } finally {
    clearTimeout(timer);
  }
}

async function ensureSession(opts) {
  if (sessionId) return;
  const init = await rpc({ jsonrpc: '2.0', id: nextId++, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'hellgalaxy-db', version: '1' } } }, { ...opts, withSession: false });
  if (!init || init.error) throw new UnrealError('Inizializzazione MCP rifiutata: ' + (init && init.error ? init.error.message : 'risposta vuota'));
  await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' }, opts);
}

async function callTool(name, args, opts = {}) {
  await ensureSession(opts);
  let reply;
  try {
    reply = await rpc({ jsonrpc: '2.0', id: nextId++, method: 'tools/call', params: { name, arguments: args } }, opts);
  } catch (e) {
    if (e.code === 'http_404' || e.code === 'http_400') { // sessione persa: un solo nuovo tentativo
      await ensureSession(opts);
      reply = await rpc({ jsonrpc: '2.0', id: nextId++, method: 'tools/call', params: { name, arguments: args } }, opts);
    } else throw e;
  }
  if (!reply || reply.error) throw new UnrealError('Chiamata MCP fallita: ' + (reply && reply.error ? reply.error.message : 'risposta vuota'));
  return reply.result;
}

// Esegue Python nell'Editor. Ritorna { success, output, stderr, ms, saved_packages, raw }.
// auto_save e' sempre "false" (non e' configurabile da qui di proposito).
// Modalità "agente" (predefinita nell'app, anche in locale): execPython non parla con l'Editor ma accoda un lavoro
// all'agente (scripts/agent_hub.js). L'agente stesso, e la modalità "diretta" (HG_UE_MODE=direct, test), usano il percorso diretto.
let remote = null;
function useRemote(fn) { remote = fn; }

async function execPython(code, opts = {}) {
  if (!/^\s*import unreal/.test(code)) throw new UnrealError('Il codice Python deve iniziare con "import unreal".', 400, 'bad_code');
  if (remote && !opts.direct) return remote(code, opts);
  return directExecPython(code, opts);
}

async function directExecPython(code, opts = {}) {
  if (!/^\s*import unreal/.test(code)) throw new UnrealError('Il codice Python deve iniziare con "import unreal".', 400, 'bad_code');
  const t0 = Date.now();
  const result = await callTool('execute_python_code', { code, auto_save: 'false' }, opts);
  const textPart = (result && result.content || []).find(c => c.type === 'text');
  let inner;
  try { inner = JSON.parse(textPart.text); } catch (e) { throw new UnrealError('Risposta di execute_python_code non interpretabile.'); }
  return {
    success: inner.success !== false,
    output: inner.output || '',
    stderr: inner.stderr || inner.error || inner.error_message || '',
    ms: Date.now() - t0,
    savedPackages: inner.saved_packages || [],
    raw: inner,
  };
}

// L'output Python puo' contenere righe di warning prima del JSON: prende l'ultima riga che inizia con { o [.
function lastJsonLine(output) {
  const line = String(output).split(/\r?\n/).filter(l => /^\s*[{[]/.test(l)).pop();
  if (!line) throw new UnrealError('Nessun JSON nell\'output di Unreal: ' + String(output).slice(0, 300));
  return JSON.parse(line);
}

const PING_CODE = `import unreal, json
dc = unreal.EditorLoadingAndSavingUtils.get_dirty_content_packages()
dm = unreal.EditorLoadingAndSavingUtils.get_dirty_map_packages()
print(json.dumps({
    "engine": str(unreal.SystemLibrary.get_engine_version()),
    "project": str(unreal.SystemLibrary.get_game_name()),
    "project_dir": str(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())),
    "dirty_content": len(dc),
    "dirty_maps": len(dm),
}))
`;

// Test di collegamento: SOLA LETTURA, nessun asset toccato o salvato.
async function ping(opts = {}) {
  const r = await execPython(PING_CODE, opts);
  if (!r.success) throw new UnrealError('Python nell\'Editor ha restituito un errore: ' + (r.stderr || r.output).slice(0, 300));
  const info = lastJsonLine(r.output);
  return { ok: true, url: MCP_URL(), ms: r.ms, savedPackages: r.savedPackages, engine: info.engine, project: info.project, projectDir: info.project_dir, dirtyContent: info.dirty_content, dirtyMaps: info.dirty_maps };
}

function resetSession() { sessionId = null; }

module.exports = { UnrealError, execPython, directExecPython, useRemote, PING_CODE, callTool, ping, lastJsonLine, resetSession, MCP_URL };
