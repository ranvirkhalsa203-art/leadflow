@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Installing LeadFlow packages...
  call npm ci
  if errorlevel 1 exit /b 1
)
echo Open http://127.0.0.1:3000 in your browser.
call npm run dev
pause
