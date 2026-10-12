# ═══════════════════════════════════════════════════════════════
#  INSTALLATION ACCOUNTING AI - SCRIPT CLIENT
#  Execute AUTOMATIQUEMENT par l'installeur apres la copie
#  Version : 3.1 (verification next bin + docker compose + migrations)
# ═══════════════════════════════════════════════════════════════

$ErrorActionPreference = "Continue"
$InstallDir = $PSScriptRoot

# Rafraichir le PATH pour voir Git/Node fraichement installes
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("Path","User")

Write-Host ""
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "  ACCOUNTING AI AUTOMATION - CONFIGURATION" -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""

# ===============================================================
#  1. VERIFIER GIT BASH
# ===============================================================
Write-Host "[1/7] Verification de Git Bash..." -ForegroundColor Yellow

$gitBash = $null
foreach ($p in @(
    "C:\Program Files\Git\bin\bash.exe",
    "C:\Program Files (x86)\Git\bin\bash.exe"
)) {
    if (Test-Path $p) { $gitBash = $p; break }
}

if (-not $gitBash) {
    Write-Host "  [ERREUR] Git Bash introuvable" -ForegroundColor Red
    Read-Host "Appuyez sur Entree pour quitter"
    exit 1
}
Write-Host "  [OK] Git Bash : $gitBash" -ForegroundColor Green

# ===============================================================
#  2. VERIFIER LE BUILD NEXT.JS
# ===============================================================
Write-Host "[2/7] Verification du build Next.js..." -ForegroundColor Yellow

$webDir   = "$InstallDir\web"
$nextBin  = "$webDir\node_modules\next\dist\bin\next"

if (-not (Test-Path $nextBin)) {
    Write-Host "  [ERREUR] Next.js introuvable : $nextBin" -ForegroundColor Red
    Read-Host "Appuyez sur Entree pour quitter"
    exit 1
}

if (-not (Test-Path "$webDir\.next")) {
    Write-Host "  [ERREUR] .next introuvable" -ForegroundColor Red
    Read-Host "Appuyez sur Entree pour quitter"
    exit 1
}

# Packages critiques
$criticals = @("next", "react", "react-dom", "styled-jsx", "next-intl", "@supabase")
$missing = @()
foreach ($pkg in $criticals) {
    if (-not (Test-Path "$webDir\node_modules\$pkg")) { $missing += $pkg }
}

if ($missing.Count -gt 0) {
    Write-Host "  [ATTENTION] Packages manquants : $($missing -join ', ')" -ForegroundColor Yellow
} else {
    Write-Host "  [OK] Build valide" -ForegroundColor Green
}

# Verifier Node.js
$nodeExe = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeExe) {
    Write-Host "  [ERREUR] node introuvable dans le PATH" -ForegroundColor Red
    Read-Host "Appuyez sur Entree pour quitter"
    exit 1
}
Write-Host "  [OK] Node.js : $($nodeExe.Source)" -ForegroundColor Green

# ===============================================================
#  3. GENERER LES CLES SUPABASE
# ===============================================================
Write-Host "[3/7] Generation des cles Supabase..." -ForegroundColor Yellow

$supabaseDir = "$InstallDir\supabase"
$envFile     = "$supabaseDir\.env"

if (Test-Path $envFile) {
    Write-Host "  [INFO] .env existe deja - conservation" -ForegroundColor Gray
} else {
    if (-not (Test-Path "$supabaseDir\.env.example")) {
        Write-Host "  [ERREUR] .env.example introuvable" -ForegroundColor Red
        Read-Host "Appuyez sur Entree pour quitter"
        exit 1
    }
    Copy-Item "$supabaseDir\.env.example" $envFile -Force

    $bashPath = $supabaseDir -replace '\\', '/'
    $bashPath = $bashPath -replace '^C:', '/c'

    Write-Host "  Generation des cles (30 sec)..." -ForegroundColor Gray
    & $gitBash -c "cd '$bashPath' && sh ./utils/generate-keys.sh <<< 'y'"

    if (-not (Test-Path $envFile)) {
        Write-Host "  [ERREUR] Echec generation des cles" -ForegroundColor Red
        Read-Host "Appuyez sur Entree pour quitter"
        exit 1
    }
    Write-Host "  [OK] Cles generees" -ForegroundColor Green
}

# ===============================================================
#  4. EXTRAIRE LES CLES -> .env.production.local
# ===============================================================
Write-Host "[4/7] Creation de .env.production.local..." -ForegroundColor Yellow

$envContent = Get-Content $envFile -Raw
$anonMatch    = [regex]::Match($envContent, "ANON_KEY=([^\r\n]+)")
$serviceMatch = [regex]::Match($envContent, "SERVICE_ROLE_KEY=([^\r\n]+)")

$anonKey    = if ($anonMatch.Success)    { $anonMatch.Groups[1].Value.Trim() }    else { "" }
$serviceKey = if ($serviceMatch.Success) { $serviceMatch.Groups[1].Value.Trim() } else { "" }

if (-not $anonKey -or -not $serviceKey) {
    Write-Host "  [ERREUR] Cles introuvables dans .env" -ForegroundColor Red
    Read-Host "Appuyez sur Entree pour quitter"
    exit 1
}

$prodEnvContent = @"
# ===============================================================
#  Configuration Accounting AI - Installation locale
#  Genere automatiquement le $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
# ===============================================================

SUPABASE_URL=http://localhost:8000
SUPABASE_ANON_KEY=$anonKey
SUPABASE_SERVICE_ROLE_KEY=$serviceKey
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=$anonKey

LICENSE_VERIFY_URL=https://accounting-ai-automation.vercel.app/api/licenses/verify

NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3000
NODE_ENV=production
PORT=3000

NEXT_PUBLIC_ENABLE_SUPER_ADMIN=false

GROQ_API_KEY=
RESEND_API_KEY=
"@

$prodEnvPath = "$webDir\.env.production.local"
$prodEnvContent | Out-File -FilePath $prodEnvPath -Encoding utf8 -NoNewline
Write-Host "  [OK] .env.production.local cree" -ForegroundColor Green

# ===============================================================
#  5. DEMARRER DOCKER
# ===============================================================
Write-Host "[5/7] Demarrage de Docker Desktop..." -ForegroundColor Yellow

$dockerPath = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
if (-not (Test-Path $dockerPath)) {
    Write-Host "  [ERREUR] Docker Desktop introuvable" -ForegroundColor Red
    Read-Host "Appuyez sur Entree pour quitter"
    exit 1
}

$dockerProcess = Get-Process "Docker Desktop" -ErrorAction SilentlyContinue
if (-not $dockerProcess) {
    Start-Process $dockerPath
    Write-Host "  Attente du demarrage de Docker..." -ForegroundColor Gray
}

$maxWait = 180
$waited  = 0
$dockerReady = $false
while ($waited -lt $maxWait) {
    & docker info *> $null
    if ($LASTEXITCODE -eq 0) { $dockerReady = $true; break }
    Start-Sleep -Seconds 5
    $waited += 5
    Write-Host "  Attente Docker... ($waited/$maxWait sec)" -ForegroundColor Gray
}

if (-not $dockerReady) {
    Write-Host "  [ATTENTION] Docker n'a pas demarre dans le delai" -ForegroundColor Yellow
} else {
    Write-Host "  [OK] Docker pret" -ForegroundColor Green
}

# ===============================================================
#  6. DEMARRER SUPABASE + MIGRATIONS
# ===============================================================
Write-Host "[6/7] Demarrage de Supabase..." -ForegroundColor Yellow

if ($dockerReady) {
    Push-Location $supabaseDir
    try {
        Write-Host "  docker compose up -d..." -ForegroundColor Gray
        & docker compose up -d

        if ($LASTEXITCODE -eq 0) {
            Write-Host "  [OK] Supabase demarre" -ForegroundColor Green
            Write-Host "  Attente de la base (30 sec)..." -ForegroundColor Gray
            Start-Sleep -Seconds 30

            $migrations = Get-ChildItem "$InstallDir\migrations\*.sql" -ErrorAction SilentlyContinue |
                          Sort-Object Name
            if ($migrations.Count -gt 0) {
                Write-Host "  Application de $($migrations.Count) migration(s)..." -ForegroundColor Gray
                foreach ($m in $migrations) {
                    Write-Host "    -> $($m.Name)" -ForegroundColor Gray
                    Get-Content $m.FullName -Raw |
                        & docker exec -i supabase-db psql -U postgres -d postgres 2>&1 | Out-Null
                }
                Write-Host "  [OK] Migrations appliquees" -ForegroundColor Green
            }
        } else {
            Write-Host "  [ATTENTION] docker compose up a echoue" -ForegroundColor Yellow
        }
    } finally {
        Pop-Location
    }
} else {
    Write-Host "  [INFO] Supabase sera demarre au premier lancement" -ForegroundColor Yellow
}

# ===============================================================
#  7. VERIFICATIONS FINALES
# ===============================================================
Write-Host "[7/7] Verifications finales..." -ForegroundColor Yellow

if (Test-Path "$webDir\start.bat") {
    Write-Host "  [OK] start.bat present" -ForegroundColor Green
} else {
    Write-Host "  [ATTENTION] start.bat introuvable" -ForegroundColor Yellow
}

if (Test-Path "$webDir\.env.production.local") {
    Write-Host "  [OK] .env.production.local present" -ForegroundColor Green
}

# ===============================================================
#  RESUME
# ===============================================================
Write-Host ""
Write-Host "===========================================================" -ForegroundColor Green
Write-Host "  [OK] INSTALLATION TERMINEE" -ForegroundColor Green
Write-Host "===========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Dossier        : $InstallDir" -ForegroundColor Cyan
Write-Host "Cles Supabase  : generees" -ForegroundColor Cyan
Write-Host "URL locale     : http://localhost:3000" -ForegroundColor Cyan
Write-Host ""

if (-not $dockerReady) {
    Write-Host "ATTENTION : Docker n'a pas demarre automatiquement." -ForegroundColor Yellow
    Write-Host "Redemarrez Windows puis relancez 'Accounting AI' du bureau." -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Pour demarrer l'application :" -ForegroundColor Yellow
Write-Host "  -> Double-cliquez sur 'Accounting AI' sur le bureau" -ForegroundColor White
Write-Host ""
Write-Host "Pour activer votre licence :" -ForegroundColor Yellow
Write-Host "  1. Creez votre compte admin" -ForegroundColor White
Write-Host "  2. Parametres -> Ma licence" -ForegroundColor White
Write-Host "  3. Collez la cle recue par email" -ForegroundColor White
Write-Host ""

Read-Host "Appuyez sur Entree pour terminer"