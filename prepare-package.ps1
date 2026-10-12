# ===============================================================
#  PREPARATION DU PACKAGE CLIENT
#  Methode classique (sans standalone) - compatible pnpm monorepo
#  Version : 3.2 (copie binaires natifs @swc/@next/@parcel)
# ===============================================================

$ErrorActionPreference = "Stop"

# --- Configuration ---
$ProjectRoot    = "C:\Projects\accounting-ai-automation"
$SupabaseSource = "C:\Users\Sahnoun HAWALA\supabase-project"
$PackageDir     = "$ProjectRoot\package"
$WebAppDir      = "$ProjectRoot\apps\web"

Write-Host ""
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "  PREPARATION DU PACKAGE CLIENT (v3.2)" -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""

# ===============================================================
#  1. VERIFICATIONS
# ===============================================================
Write-Host "[1/8] Verification des dossiers sources..." -ForegroundColor Yellow

foreach ($path in @($ProjectRoot, $SupabaseSource, $WebAppDir)) {
    if (-not (Test-Path $path)) {
        Write-Host "  [ERREUR] Introuvable : $path" -ForegroundColor Red
        exit 1
    }
}

$gitInstaller  = "$ProjectRoot\prerequisites\Git-2.56.0.2-64-bit.exe"
$nodeInstaller = "$ProjectRoot\prerequisites\node-v20.11.0-x64.msi"
$dockerInst    = "$ProjectRoot\prerequisites\DockerDesktopInstaller.exe"

foreach ($f in @($gitInstaller, $nodeInstaller, $dockerInst)) {
    if (Test-Path $f) {
        Write-Host "  [OK] $([System.IO.Path]::GetFileName($f))" -ForegroundColor Green
    } else {
        Write-Host "  [ATTENTION] Absent : $f" -ForegroundColor Yellow
    }
}

# ===============================================================
#  2. NETTOYER LE PACKAGE PRECEDENT
# ===============================================================
Write-Host "[2/8] Nettoyage du package precedent..." -ForegroundColor Yellow

if (Test-Path $PackageDir) {
    Remove-Item $PackageDir -Recurse -Force
    Write-Host "  [OK] Ancien package supprime" -ForegroundColor Green
}

New-Item -ItemType Directory -Path "$PackageDir\web"        -Force | Out-Null
New-Item -ItemType Directory -Path "$PackageDir\supabase"   -Force | Out-Null
New-Item -ItemType Directory -Path "$PackageDir\migrations" -Force | Out-Null
Write-Host "  [OK] Structure creee" -ForegroundColor Green

# ===============================================================
#  3. BUILD NEXT.JS
# ===============================================================
Write-Host "[3/8] Build de l'app Next.js..." -ForegroundColor Yellow

$envProd = @"
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=PLACEHOLDER_WILL_BE_REPLACED_AT_RUNTIME
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_ENABLE_SUPER_ADMIN=false
LICENSE_VERIFY_URL=https://accounting-ai-automation.vercel.app/api/licenses/verify
"@
$envProd | Out-File "$WebAppDir\.env.production" -Encoding utf8 -NoNewline
Write-Host "  [OK] .env.production cree" -ForegroundColor Green

Push-Location $WebAppDir
try {
    if (Test-Path "$WebAppDir\.next") {
        Remove-Item "$WebAppDir\.next" -Recurse -Force -ErrorAction SilentlyContinue
    }

    Write-Host "  Execution de pnpm build..." -ForegroundColor Gray
    & pnpm build
    if ($LASTEXITCODE -ne 0) { throw "Build Next.js echoue" }
    Write-Host "  [OK] Build Next.js reussi" -ForegroundColor Green
} finally {
    Pop-Location
}

# ===============================================================
#  4. COPIER LE BUILD
# ===============================================================
Write-Host "[4/8] Copie du build..." -ForegroundColor Yellow

# 4a. .next complet
Write-Host "  Copie de .next..." -ForegroundColor Gray
robocopy "$WebAppDir\.next" "$PackageDir\web\.next" /E /XD "cache" /XF "*.map" /NFL /NDL /NJH /NJS /NP /R:1 /W:1 | Out-Null
Write-Host "  [OK] .next copie" -ForegroundColor Green

# 4b. package.json + next.config
Copy-Item "$WebAppDir\package.json" "$PackageDir\web\package.json" -Force
foreach ($cfg in @("next.config.js","next.config.mjs","next.config.ts")) {
    if (Test-Path "$WebAppDir\$cfg") {
        Copy-Item "$WebAppDir\$cfg" "$PackageDir\web\$cfg" -Force
    }
}
Write-Host "  [OK] package.json + next.config copies" -ForegroundColor Green

# 4c. public
if (Test-Path "$WebAppDir\public") {
    Copy-Item "$WebAppDir\public" "$PackageDir\web\public" -Recurse -Force
    Write-Host "  [OK] public copie" -ForegroundColor Green
}

# 4d. messages i18n
if (Test-Path "$WebAppDir\messages") {
    Copy-Item "$WebAppDir\messages" "$PackageDir\web\messages" -Recurse -Force
    $msgCount = (Get-ChildItem "$PackageDir\web\messages\*.json" -ErrorAction SilentlyContinue).Count
    Write-Host "  [OK] $msgCount fichier(s) i18n copie(s)" -ForegroundColor Green
}

# 4e. Copier node_modules aplati (resolution symlinks .pnpm)
Write-Host "  Copie de node_modules aplati..." -ForegroundColor Gray

$destNm    = "$PackageDir\web\node_modules"
$srcNm     = "$WebAppDir\node_modules"
$pnpmStore = "$srcNm\.pnpm"

if (Test-Path $destNm) { Remove-Item $destNm -Recurse -Force }
New-Item -ItemType Directory -Path $destNm -Force | Out-Null

if (Test-Path $pnpmStore) {
    Write-Host "    Parcours du store .pnpm..." -ForegroundColor Gray

    $excludePatterns = @(
        "typescript@*", "eslint*", "prettier*", "tailwindcss@*",
        "@types+*", "@eslint*", "webpack@*",
        "terser@*", "autoprefixer@*", "concurrently@*", "cross-env@*"
    )

    Get-ChildItem $pnpmStore -Directory | ForEach-Object {
        $excluded = $false
        foreach ($pattern in $excludePatterns) {
            if ($_.Name -like $pattern) { $excluded = $true; break }
        }
        if ($excluded) { return }

        $pkgNodeModules = Join-Path $_.FullName "node_modules"
        if (-not (Test-Path $pkgNodeModules)) { return }

        Get-ChildItem $pkgNodeModules -Force | ForEach-Object {
            $name = $_.Name
            $src  = $_.FullName

            if ($name -like "@*") {
                $scopeTarget = Join-Path $destNm $name
                if (-not (Test-Path $scopeTarget)) {
                    New-Item -ItemType Directory -Path $scopeTarget -Force | Out-Null
                }
                Get-ChildItem $src -Directory -ErrorAction SilentlyContinue | ForEach-Object {
                    $subTarget = Join-Path $scopeTarget $_.Name
                    if (-not (Test-Path $subTarget)) {
                        try { robocopy $_.FullName $subTarget /E /NFL /NDL /NJH /NJS /NP /R:1 /W:1 | Out-Null } catch {}
                    }
                }
            } else {
                $target = Join-Path $destNm $name
                if (-not (Test-Path $target)) {
                    try { robocopy $src $target /E /NFL /NDL /NJH /NJS /NP /R:1 /W:1 | Out-Null } catch {}
                }
            }
        }
    }

    $count = (Get-ChildItem $destNm -Directory -ErrorAction SilentlyContinue).Count
    Write-Host "  [OK] node_modules copie ($count entrees)" -ForegroundColor Green
} else {
    Write-Host "  [ATTENTION] Store .pnpm introuvable" -ForegroundColor Yellow
}

# 4e-bis. Copier le .bin (binaires des CLI)
Write-Host "  Copie du .bin..." -ForegroundColor Gray

$srcBin  = "$WebAppDir\node_modules\.bin"
$destBin = "$PackageDir\web\node_modules\.bin"

if (Test-Path $srcBin) {
    if (-not (Test-Path $destBin)) {
        New-Item -ItemType Directory -Path $destBin -Force | Out-Null
    }
    Copy-Item "$srcBin\*" $destBin -Recurse -Force -ErrorAction SilentlyContinue
    $binCount = (Get-ChildItem $destBin -ErrorAction SilentlyContinue).Count
    Write-Host "  [OK] $binCount binaire(s) copie(s)" -ForegroundColor Green
} else {
    Write-Host "  [INFO] Pas de .bin" -ForegroundColor Gray
}

# 4e-ter. Copier les binaires natifs critiques (@swc, @next, @parcel)
Write-Host "  Copie des binaires natifs critiques..." -ForegroundColor Gray

$binariesToCopy = @(
    @{ Pattern = "@swc+core-win32*";       Target = "@swc\core-win32-x64-msvc" },
    @{ Pattern = "@swc+core@*";            Target = "@swc\core" },
    @{ Pattern = "@swc+helpers*";          Target = "@swc\helpers" },
    @{ Pattern = "@next+swc-win32*";       Target = "@next\swc-win32-x64-msvc" },
    @{ Pattern = "@next+env*";             Target = "@next\env" },
    @{ Pattern = "@parcel+watcher-win32*"; Target = "@parcel\watcher-win32-x64" },
    @{ Pattern = "@parcel+watcher@*";      Target = "@parcel\watcher" }
)

foreach ($bin in $binariesToCopy) {
    $matches = Get-ChildItem $pnpmStore -Directory -Filter $bin.Pattern -ErrorAction SilentlyContinue
    foreach ($match in $matches) {
        $scope   = ($bin.Target -split '\\')[0]
        $pkgName = ($bin.Target -split '\\')[-1]
        $srcPath = "$($match.FullName)\node_modules\$scope\$pkgName"

        if (Test-Path $srcPath) {
            $destPath = "$destNm\$scope\$pkgName"
            if (-not (Test-Path "$destNm\$scope")) {
                New-Item -ItemType Directory -Path "$destNm\$scope" -Force | Out-Null
            }
            if (-not (Test-Path $destPath)) {
                robocopy $srcPath $destPath /E /NFL /NDL /NJH /NJS /NP /R:1 /W:1 | Out-Null
                Write-Host "    [OK] $scope\$pkgName" -ForegroundColor Green
            }
        }
    }
}

Write-Host "  [OK] Binaires copies" -ForegroundColor Green

# 4f. Verifier les packages critiques
Write-Host "  Verification des packages critiques :" -ForegroundColor Gray
$criticals = @(
    "next", "react", "react-dom", "styled-jsx", "next-intl",
    "lucide-react", "@supabase", "recharts", "openai", "resend",
    "qrcode", "otplib", "tesseract.js", "exceljs", "mammoth",
    "xlsx", "pdf-lib", "pdfjs-dist",
    "@swc\core", "@swc\core-win32-x64-msvc", "@next\swc-win32-x64-msvc"
)
foreach ($pkg in $criticals) {
    $pkgPath = "$destNm\$($pkg -replace '\\','\')"
    if (Test-Path $pkgPath) {
        Write-Host "    [OK] $pkg" -ForegroundColor Green
    } else {
        Write-Host "    [ATTENTION] $pkg manquant" -ForegroundColor Yellow
    }
}

# 4g. Taille
$webSize = (Get-ChildItem "$PackageDir\web" -Recurse -ErrorAction SilentlyContinue |
            Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "  [OK] Taille web : $([math]::Round($webSize, 1)) Mo" -ForegroundColor Green

# ===============================================================
#  5. VERIFIER LES CHEMINS LONGS
# ===============================================================
Write-Host "[5/8] Verification des chemins longs..." -ForegroundColor Yellow

$longPaths = Get-ChildItem "$PackageDir\web" -Recurse -Force -ErrorAction SilentlyContinue |
             Where-Object { $_.FullName.Length -gt 200 }

if ($longPaths.Count -gt 0) {
    Write-Host "  [ATTENTION] $($longPaths.Count) chemin(s) > 200 chars" -ForegroundColor Yellow
    $maxLen = ($longPaths | ForEach-Object { $_.FullName.Length } | Measure-Object -Maximum).Maximum
    if ($maxLen -gt 250) {
        Write-Host "  [ERREUR] Chemin max = $maxLen chars" -ForegroundColor Red
        Write-Host "           Activez LongPathsEnabled=1" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  [OK] Aucun chemin > 200 chars" -ForegroundColor Green
}

# ===============================================================
#  6. COPIER SUPABASE
# ===============================================================
Write-Host "[6/8] Copie de Supabase local..." -ForegroundColor Yellow

$supabaseFiles = @(
    "docker-compose.yml", "docker-compose.s3.yml", "docker-compose.envoy.yml",
    "docker-compose.kong.yml", "docker-compose.nginx.yml", "docker-compose.caddy.yml",
    "docker-compose.logs.yml", "docker-compose.pgbouncer.yml", "docker-compose.pg15.yml",
    "docker-compose.pg17.yml", "docker-compose.rustfs.yml",
    "utils", ".env.example", "README.md"
)
foreach ($file in $supabaseFiles) {
    $source = "$SupabaseSource\$file"
    if (Test-Path $source) {
        Copy-Item $source "$PackageDir\supabase\" -Recurse -Force
        Write-Host "  [OK] $file" -ForegroundColor Green
    }
}

New-Item -ItemType Directory -Path "$PackageDir\supabase\volumes" -Force | Out-Null
Write-Host "  [OK] Dossier volumes cree" -ForegroundColor Green

# ===============================================================
#  7. COPIER LES MIGRATIONS SQL
# ===============================================================
Write-Host "[7/8] Copie des migrations SQL..." -ForegroundColor Yellow

$migrationsSource = "$ProjectRoot\infra\supabase\migrations"
if (Test-Path $migrationsSource) {
    Copy-Item "$migrationsSource\*.sql" "$PackageDir\migrations\" -Force
    $count = (Get-ChildItem "$PackageDir\migrations\*.sql").Count
    Write-Host "  [OK] $count migration(s)" -ForegroundColor Green
} else {
    Write-Host "  [ATTENTION] $migrationsSource introuvable" -ForegroundColor Yellow
}

# ===============================================================
#  8. COPIER LES SCRIPTS DE CONFIGURATION
# ===============================================================
Write-Host "[8/8] Copie des scripts..." -ForegroundColor Yellow

$installScript = "$ProjectRoot\install.ps1"
if (Test-Path $installScript) {
    Copy-Item $installScript "$PackageDir\install.ps1" -Force
    Write-Host "  [OK] install.ps1 copie" -ForegroundColor Green
}

# 8a. start.bat (sans parsing du .env - Next.js le fait automatiquement)
$startBatContent = @"
@echo off
cd /d "%~dp0"

echo.
echo   Accounting AI - http://localhost:3000
echo.

docker ps --filter "name=supabase" --format "{{.Names}}" | findstr /C:"supabase" >nul
if errorlevel 1 (
    echo [INFO] Demarrage de Supabase...
    pushd "..\supabase"
    docker compose up -d
    popd
    timeout /t 10 /nobreak >nul
)

node "node_modules\next\dist\bin\next" start -p 3000
"@
[System.IO.File]::WriteAllText("$PackageDir\web\start.bat", $startBatContent, [System.Text.Encoding]::ASCII)
Write-Host "  [OK] start.bat cree (ASCII)" -ForegroundColor Green

$readmeFile = "$ProjectRoot\README.txt"
if (Test-Path $readmeFile) {
    Copy-Item $readmeFile "$PackageDir\README.txt" -Force
    Write-Host "  [OK] README.txt copie" -ForegroundColor Green
}

# ===============================================================
#  RESUME
# ===============================================================
Write-Host ""
Write-Host "===========================================================" -ForegroundColor Green
Write-Host "  [OK] PACKAGE PRET" -ForegroundColor Green
Write-Host "===========================================================" -ForegroundColor Green
Write-Host ""

$webSize  = (Get-ChildItem "$PackageDir\web" -Recurse -ErrorAction SilentlyContinue |
             Measure-Object -Property Length -Sum).Sum / 1MB
$supaSize = (Get-ChildItem "$PackageDir\supabase" -Recurse -ErrorAction SilentlyContinue |
             Measure-Object -Property Length -Sum).Sum / 1MB
$migSize  = (Get-ChildItem "$PackageDir\migrations" -Recurse -ErrorAction SilentlyContinue |
             Measure-Object -Property Length -Sum).Sum / 1MB

Write-Host "Emplacement : $PackageDir" -ForegroundColor Cyan
Write-Host "Taille web       : $([math]::Round($webSize, 1)) Mo" -ForegroundColor Cyan
Write-Host "Taille supabase  : $([math]::Round($supaSize, 1)) Mo" -ForegroundColor Cyan
Write-Host "Taille migrations: $([math]::Round($migSize, 2)) Mo" -ForegroundColor Cyan
Write-Host ""

Write-Host "Prochaines etapes :" -ForegroundColor Yellow
Write-Host "  1. Verifier prerequisites\ (Git, Node, Docker)" -ForegroundColor White
Write-Host "  2. Compiler installer.iss" -ForegroundColor White
Write-Host ""