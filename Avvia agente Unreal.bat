@echo off
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js non trovato. Installalo da https://nodejs.org e riprova.
  pause
  exit /b 1
)

echo Agente Unreal: il ponte tra l'app e l'Editor. Tienilo aperto mentre usi l'app.
echo (L'Editor Unreal deve essere aperto sul progetto HellGalaxy.)
echo Configurazione in .env: HG_SERVER_URL, HG_AGENT_TOKEN, HG_AGENT_NAME.
echo.
node scripts\unreal_agent.js

pause
