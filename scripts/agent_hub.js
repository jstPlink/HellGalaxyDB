// Coda dei lavori verso l'agente Unreal (lato app/server). L'app NON parla mai direttamente con l'Editor:
// ogni lettura/aggiornamento diventa un lavoro che l'agente (sul PC dove gira l'Editor) prende con long-polling,
// esegue sul proprio Editor e di cui restituisce il risultato. Vale anche in locale (localhost = come il server).
//   submit(code, {timeoutMs}) -> Promise<risultato execPython>   (usato da unreal_bridge in modalità "agent")
//   poll(agentId, info, signal) -> Promise<{id, code, timeoutMs} | null>   (rotta POST /api/agent/poll)
//   result(id, payload)         -> rotta POST /api/agent/result
//   status()                    -> { connected, agents:[{id,name,lastSeen,...}], queued, running }
// I lavori stanno solo in memoria (un riavvio del server li perde: l'app mostra l'errore e si ripete l'azione).
'use strict';
const crypto = require('crypto');
const bridge = require('./unreal_bridge');

const POLL_WAIT_MS = 20000;      // durata massima di un long-poll
const ONLINE_MS = 45000;         // un agente è "connesso" se si è fatto sentire negli ultimi 45 s
const CONNECT_WAIT_MS = Number(process.env.HG_AGENT_CONNECT_WAIT_MS) || 8000;    // quanto aspettare un agente se nessuno è connesso, prima di dare errore

const agents = new Map();        // id -> { id, name, version, lastSeen, ueOk, project }
const queue = [];                // lavori in attesa
const running = new Map();       // id -> job in esecuzione
const waiters = [];              // long-poll in attesa di un lavoro: { agentId, resolve }

function touch(agentId, info = {}) {
  const a = agents.get(agentId) || { id: agentId };
  Object.assign(a, { name: info.name || a.name || agentId, version: info.version || a.version || '', lastSeen: Date.now() });
  if (info.ueOk !== undefined) a.ueOk = info.ueOk;
  agents.set(agentId, a);
  return a;
}
const online = () => [...agents.values()].filter(a => Date.now() - a.lastSeen < ONLINE_MS);

function dispatch() {
  while (queue.length && waiters.length) {
    const job = queue.shift(), w = waiters.shift();
    job.agentId = w.agentId; running.set(job.id, job);
    w.resolve({ id: job.id, code: job.code, timeoutMs: job.timeoutMs });
  }
}

function submit(code, { timeoutMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const job = { id: crypto.randomUUID(), code, timeoutMs, createdAt: Date.now(), resolve, reject, timer: null, agentId: null };
    const fail = (err) => { clearTimeout(job.timer); const i = queue.indexOf(job); if (i >= 0) queue.splice(i, 1); running.delete(job.id); reject(err); };
    job.fail = fail;
    // se nessun agente è connesso, un breve margine (l'agente può essere in riconnessione), poi errore chiaro
    job.timer = setTimeout(() => {
      if (!job.agentId) fail(new bridge.UnrealError('Agente Unreal non connesso: avvia "Avvia agente Unreal.bat" sul PC dove è aperto l\'Editor (poi riprova).', 503, 'agent_offline'));
    }, online().length ? Math.max(timeoutMs, CONNECT_WAIT_MS) : CONNECT_WAIT_MS);
    job.timer.unref && job.timer.unref();
    queue.push(job);
    dispatch();
    // timeout complessivo dopo che l'agente ha preso il lavoro
    job.watch = setInterval(() => {
      if (job.agentId && Date.now() - job.createdAt > timeoutMs + 20000) { clearInterval(job.watch); fail(new bridge.UnrealError('Timeout: l\'agente non ha risposto in tempo.', 504, 'agent_timeout')); }
      if (!queue.includes(job) && !running.has(job.id)) clearInterval(job.watch);
    }, 1000);
    job.watch.unref && job.watch.unref();
  });
}

// Long-poll: l'agente chiede un lavoro. Risolve con il lavoro o con null dopo POLL_WAIT_MS.
function poll(agentId, info, onClose) {
  touch(agentId, info);
  return new Promise(resolve => {
    const w = { agentId, resolve: (j) => { clearTimeout(t); resolve(j); } };
    const t = setTimeout(() => { const i = waiters.indexOf(w); if (i >= 0) waiters.splice(i, 1); touch(agentId); resolve(null); }, POLL_WAIT_MS);
    t.unref && t.unref();
    if (onClose) onClose(() => { const i = waiters.indexOf(w); if (i >= 0) waiters.splice(i, 1); clearTimeout(t); });
    waiters.push(w);
    dispatch();
  });
}

function result(id, payload, agentId) {
  const job = running.get(id);
  if (agentId) touch(agentId);
  if (!job) return false;
  running.delete(id); clearTimeout(job.timer); clearInterval(job.watch);
  if (payload && payload.error) job.reject(new bridge.UnrealError(payload.error, payload.status || 502, payload.code || 'agent_error'));
  else job.resolve(payload.result);
  return true;
}

function status() {
  const on = online();
  return { connected: on.length > 0, agents: [...agents.values()].map(a => ({ ...a, online: Date.now() - a.lastSeen < ONLINE_MS })), queued: queue.length, running: running.size };
}

module.exports = { submit, poll, result, status };
