// Agente locale per Unreal: gira sul PC dove è aperto l'Editor (con il suo server MCP su 127.0.0.1:8010).
// Si collega IN USCITA all'app (server o localhost), prende i lavori con long-polling, li esegue sull'Editor
// locale e restituisce il risultato. Nessuna porta aperta sul PC; l'app non raggiunge mai l'Editor direttamente.
//
// Sicurezza: l'agente NON esegue codice ricevuto dalla rete. Ogni lavoro deve essere esattamente
//   <uno degli script di scripts/unreal/*.py> + UNA chiamata di funzione consentita con soli argomenti letterali,
// oppure il codice del test di collegamento. L'agente ricostruisce il codice dai PROPRI script (se la versione
// dell'app e quella dell'agente differiscono, il lavoro è rifiutato con un messaggio chiaro).
// Scrittura: le operazioni che scrivono (delete, import_one, run con apply=True) sono eseguite solo se sul PC
// dell'agente c'è HG_UE_ALLOW_WRITE=1, altrimenti rifiutate (il blocco sta sul PC dell'utente, non sul server).
//
// Uso:  node scripts/unreal_agent.js     (configurazione in .env o variabili d'ambiente)
//   HG_SERVER_URL   indirizzo dell'app (default http://localhost:8936)
//   HG_AGENT_TOKEN  token condiviso con l'app (obbligatorio)
//   HG_AGENT_NAME   nome mostrato nell'app (default: nome del computer)
//   HG_UE_MCP_URL   MCP dell'Editor (default http://127.0.0.1:8010/mcp)
//   HG_UE_ALLOW_WRITE=1  solo quando l'utente autorizza le scritture
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const SCRIPT_DIR = path.join(__dirname, 'unreal');
const AGENT_VERSION = '1';

// ---------- validazione dei lavori (esportata per i test) ----------
const norm = s => String(s).replace(/\r\n/g, '\n').replace(/\s+$/, '');
const STR = '"(?:[^"\\\\\\n]|\\\\.)*"';
const LIT = `(?:${STR}|-?\\d+(?:\\.\\d+)?|True|False|None)`;
const ITEM = `(?:[A-Za-z_]\\w*\\s*=\\s*)?${LIT}`;
const CALL_RE = new RegExp(`^([a-z_]+)\\(\\s*(?:${ITEM}(?:\\s*,\\s*${ITEM})*)?\\s*\\)$`);
const ALLOWED_FUNCS = new Set(['read', 'inventory', 'run', 'check', 'delete', 'export_all', 'import_one']);
const WRITE_FUNCS = new Set(['delete', 'import_one']);

function loadScripts() {
  return fs.readdirSync(SCRIPT_DIR).filter(f => f.endsWith('.py')).map(f => ({ file: f, text: norm(fs.readFileSync(path.join(SCRIPT_DIR, f), 'utf8')) }));
}

// Ritorna { ok, code?, write?, error? }. `pingCode` = codice del test di collegamento (da unreal_bridge).
function validateJob(code, { pingCode, scripts = loadScripts() } = {}) {
  const c = norm(code);
  if (pingCode && c === norm(pingCode)) return { ok: true, code: pingCode, write: false, what: 'ping' };
  for (const s of scripts) {
    if (!c.startsWith(s.text + '\n\n')) continue;
    const call = c.slice(s.text.length + 2).trim();
    if (call.includes('\n')) return { ok: false, error: 'chiamata non valida (più righe)' };
    const m = CALL_RE.exec(call);
    if (!m || !ALLOWED_FUNCS.has(m[1])) return { ok: false, error: 'chiamata non consentita: ' + call.slice(0, 60) };
    const write = WRITE_FUNCS.has(m[1]) || /apply\s*=\s*True/.test(call);
    return { ok: true, code: s.text + '\n\n' + call + '\n', write, what: s.file + ':' + m[1] };
  }
  return { ok: false, error: 'script non riconosciuto: l\'agente e l\'app hanno versioni diverse oppure il codice non è consentito' };
}

// ---------- esecuzione ----------
function loadEnv() {
  for (const f of [path.join(process.cwd(), '.env'), path.join(__dirname, '..', '.env')]) {
    try {
      for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
        const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
        if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    } catch (e) { /* nessun .env */ }
  }
}

async function main() {
  loadEnv();
  const bridge = require('./unreal_bridge');
  const server = (process.env.HG_SERVER_URL || 'http://localhost:8936').replace(/\/+$/, '');
  const token = process.env.HG_AGENT_TOKEN || '';
  const name = process.env.HG_AGENT_NAME || os.hostname();
  const agentId = name + '-' + os.userInfo().username;
  if (!token) { console.error('ERRORE: manca HG_AGENT_TOKEN (stesso valore impostato sull\'app).'); process.exit(1); }
  const log = m => console.log(new Date().toLocaleTimeString('it-IT') + '  ' + m);
  const call = async (p, body, ms = 35000) => {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
    try {
      const r = await fetch(server + p, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body), signal: ctrl.signal });
      if (r.status === 401) throw new Error('token rifiutato dall\'app (HG_AGENT_TOKEN diverso)');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  };
  log(`Agente "${agentId}" -> ${server}  (MCP ${bridge.MCP_URL()}; scrittura ${process.env.HG_UE_ALLOW_WRITE === '1' ? 'ABILITATA' : 'disabilitata'})`);
  let ueOk, appVersion;
  for (;;) {
    try {
      const { job, appVersion: av } = await call('/api/agent/poll', { agentId, name, version: AGENT_VERSION, ueOk });
      // l'app è stata aggiornata: esco con codice 42, il .bat riscarica l'agente nuovo e lo riavvia
      if (av) { if (appVersion && av !== appVersion && !job) { log('App aggiornata (' + appVersion + ' -> ' + av + '): riavvio l\'agente'); process.exit(42); } appVersion = appVersion || av; }
      if (!job) continue;
      const v = validateJob(job.code, { pingCode: bridge.PING_CODE });
      let payload;
      if (!v.ok) { log('RIFIUTATO: ' + v.error); payload = { error: 'Lavoro rifiutato dall\'agente: ' + v.error, status: 400, code: 'agent_rejected' }; }
      else if (v.write && process.env.HG_UE_ALLOW_WRITE !== '1') { log('BLOCCATO (scrittura): ' + v.what); payload = { error: 'Scrittura su Unreal disabilitata sul PC dell\'agente (HG_UE_ALLOW_WRITE non impostato).', status: 403, code: 'write_disabled' }; }
      else {
        log('esecuzione: ' + v.what);
        try { const r = await bridge.directExecPython(v.code, { timeoutMs: job.timeoutMs }); payload = { result: r }; ueOk = true; log('  ok in ' + r.ms + ' ms'); }
        catch (e) { ueOk = !(e.code === 'unreachable'); log('  ERRORE: ' + e.message); payload = { error: e.message, status: e.status || 502, code: e.code || 'unreal_error' }; }
      }
      await call('/api/agent/result', { agentId, id: job.id, ...payload }, 60000);
    } catch (e) {
      log('app non raggiungibile o errore: ' + e.message + ' (riprovo tra 3 s)');
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

if (require.main === module) main();
module.exports = { validateJob, loadScripts, CALL_RE, AGENT_VERSION, main };
