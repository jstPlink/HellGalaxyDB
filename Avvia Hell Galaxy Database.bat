@echo off
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js non trovato. Installalo da https://nodejs.org e riprova.
  pause
  exit /b 1
)

if not exist "data\hellgalaxy.db" (
  echo Primo avvio su questo computer: creo il database...
  node scripts\migrate_to_db.js
  echo.
)

echo Avvio il server. NON chiudere questa finestra finche' lavori con il tool.
echo Per chiuderlo: premi un tasto qui, oppure Ctrl+C.
echo.

start "" cmd /c "timeout /t 2 >nul & start http://localhost:8936"
node server.js

pause
