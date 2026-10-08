// Pacchetto dell'agente Unreal scaricabile dall'app (stesso comportamento in locale e sul server):
//  - buildScript(root): UN solo file JS con dentro unreal_bridge.js, unreal_agent.js e gli script Python di scripts/unreal/;
//    all'avvio li scrive in %LOCALAPPDATA%\HellGalaxyAgent\app e avvia l'agente. Quindi l'agente è sempre della stessa
//    versione dell'app (il .bat lo riscarica a ogni avvio e quando l'app si aggiorna).
//  - buildBat(opts): file .bat da lasciare sul desktop: contiene indirizzo dell'app e token, controlla Node.js,
//    scarica il pacchetto, avvia l'agente e lo riavvia da solo (anche dopo un aggiornamento dell'app).
// Il .bat contiene il token dell'agente: si scarica solo da utenti autenticati (/api/agent/bat).
'use strict';
const fs = require('fs');
const path = require('path');

const JS_FILES = ['unreal_bridge.js', 'unreal_agent.js'];

function buildScript(root) {
  const files = {};
  for (const f of JS_FILES) files['scripts/' + f] = fs.readFileSync(path.join(root, 'scripts', f), 'utf8');
  const pyDir = path.join(root, 'scripts', 'unreal');
  for (const f of fs.readdirSync(pyDir).filter(n => n.endsWith('.py'))) files['scripts/unreal/' + f] = fs.readFileSync(path.join(pyDir, f), 'utf8');
  return `// Agente Unreal di Hell Galaxy Database (generato dall'app: non modificare)
'use strict';
const fs = require('fs'), path = require('path');
const FILES = ${JSON.stringify(files)};
const base = path.join(__dirname, 'app');
for (const [rel, text] of Object.entries(FILES)) {
  const p = path.join(base, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
}
// ripulisce gli script Python che non fanno più parte del pacchetto
const pyDir = path.join(base, 'scripts', 'unreal');
for (const f of fs.readdirSync(pyDir)) if (f.endsWith('.py') && !FILES['scripts/unreal/' + f]) fs.unlinkSync(path.join(pyDir, f));
require(path.join(base, 'scripts', 'unreal_agent.js')).main();
`;
}

function buildBat({ serverUrl, token }) {
  const lines = [
    '@echo off',
    'title Agente Unreal - Hell Galaxy Database',
    'rem Generato dall\'app. Lascialo aperto mentre lavori (puoi metterlo nella cartella di avvio di Windows: Win+R, shell:startup).',
    `set "HG_SERVER_URL=${serverUrl}"`,
    `set "HG_AGENT_TOKEN=${token}"`,
    'set "HG_AGENT_NAME=%COMPUTERNAME%"',
    'set "DIR=%LOCALAPPDATA%\\HellGalaxyAgent"',
    '',
    'where node >nul 2>nul',
    'if errorlevel 1 if exist "%ProgramFiles%\\nodejs\\node.exe" set "PATH=%PATH%;%ProgramFiles%\\nodejs"',
    'where node >nul 2>nul',
    'if errorlevel 1 (',
    '  echo Node.js non trovato: lo installo automaticamente ^(serve qualche minuto, accetta l\'eventuale richiesta di Windows^)...',
    '  where winget >nul 2>nul',
    '  if not errorlevel 1 winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements',
    '  if exist "%ProgramFiles%\\nodejs\\node.exe" set "PATH=%PATH%;%ProgramFiles%\\nodejs"',
    '  where node >nul 2>nul',
    '  if errorlevel 1 (',
    '    echo Provo con il programma di installazione scaricato da nodejs.org...',
    '    powershell -NoProfile -Command "try { $v=(Invoke-RestMethod https://nodejs.org/dist/index.json | Where-Object { $_.lts } | Select-Object -First 1).version; $f=Join-Path $env:TEMP (\'node-\' + $v + \'-x64.msi\'); Invoke-WebRequest -UseBasicParsing -Uri (\'https://nodejs.org/dist/\' + $v + \'/node-\' + $v + \'-x64.msi\') -OutFile $f; Start-Process msiexec.exe -ArgumentList (\'/i \"\' + $f + \'\" /passive /norestart\') -Wait } catch { Write-Host $_.Exception.Message; exit 1 }"',
    '    if exist "%ProgramFiles%\\nodejs\\node.exe" set "PATH=%PATH%;%ProgramFiles%\\nodejs"',
    '  )',
    ')',
    'where node >nul 2>nul',
    'if errorlevel 1 (',
    '  echo Installazione di Node.js non riuscita. Installa la versione LTS da https://nodejs.org e riapri questo file.',
    '  start https://nodejs.org',
    '  pause',
    '  exit /b 1',
    ')',
    'if not exist "%DIR%" mkdir "%DIR%"',
    '',
    ':avvio',
    'echo.',
    'echo Agente Unreal collegato a %HG_SERVER_URL%',
    'echo Scarico l\'ultima versione dell\'agente...',
    'powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -Uri \'%HG_SERVER_URL%/api/agent/script\' -Headers @{Authorization=\'Bearer %HG_AGENT_TOKEN%\'} -OutFile \'%DIR%\\agent.js\' } catch { Write-Host (\'Download non riuscito: \' + $_.Exception.Message); exit 1 }"',
    'if errorlevel 1 (',
    '  if not exist "%DIR%\\agent.js" (',
    '    echo Impossibile scaricare l\'agente e non ce n\'e\' una copia locale. Controlla che l\'app sia raggiungibile.',
    '    pause',
    '    exit /b 1',
    '  )',
    '  echo Uso la copia locale dell\'agente.',
    ')',
    'echo (Lascia questa finestra aperta. L\'Editor Unreal deve essere aperto sul progetto HellGalaxy.)',
    'node "%DIR%\\agent.js"',
    'if "%ERRORLEVEL%"=="42" (',
    '  echo L\'app e\' stata aggiornata: riavvio l\'agente con la nuova versione...',
    '  goto avvio',
    ')',
    'echo L\'agente si e\' fermato. Riavvio tra 5 secondi (chiudi la finestra per uscire)...',
    'timeout /t 5 /nobreak >nul',
    'goto avvio',
    '',
  ];
  return lines.join('\r\n');
}

module.exports = { buildScript, buildBat };
