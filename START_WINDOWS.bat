@echo off
cd /d "%~dp0"
where node >nul 2>&1 || (echo Install Node.js 22 or newer & pause & exit /b 1)
if not exist ".env" (echo Copy .env.example to .env and enter your Watchmode key. & pause & exit /b 1)
if not exist "node_modules" call npm install
call npm start
pause
