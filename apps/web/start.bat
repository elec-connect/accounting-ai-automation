@echo off
cd /d "%~dp0"

echo === Demarrage Docker Desktop ===
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
timeout /t 20 /nobreak >nul

echo === Demarrage Supabase ===
cd supabase
docker compose up -d
timeout /t 30 /nobreak >nul

echo === Demarrage App ===
cd ..\web
start http://localhost:3000
node_modules\.bin\next start