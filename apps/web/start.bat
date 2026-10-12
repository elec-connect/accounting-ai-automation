@echo off
cd /d "%~dp0"

echo.
echo ===========================================================
echo   Accounting AI Automation
echo ===========================================================
echo.
echo   URL locale : http://localhost:3000
echo   Supabase   : http://localhost:8000
echo.
echo   Fermez cette fenetre pour arreter l'application.
echo.

REM Verifier si Supabase tourne, sinon le demarrer
docker ps --filter "name=supabase" --format "{{.Names}}" | findstr /C:"supabase" >nul
if errorlevel 1 (
    echo [INFO] Demarrage de Supabase...
    pushd "..\supabase"
    docker compose up -d
    popd
    timeout /t 10 /nobreak >nul
)

REM Demarrer Next.js (charge .env.production.local automatiquement)
node "node_modules\next\dist\bin\next" start -p 3000

echo.
echo [INFO] Le serveur s'est arrete.
pause