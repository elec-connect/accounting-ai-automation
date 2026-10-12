; ═══════════════════════════════════════════════════════════════
;  INSTALLATEUR ACCOUNTING AI AUTOMATION
;  Script Inno Setup — Compile le .exe pour Windows
; ═══════════════════════════════════════════════════════════════

[Setup]
AppId={{8A3B2C1D-4E5F-6A7B-8C9D-0E1F2A3B4C5D}
AppName=Accounting AI Automation
AppVersion=1.0.0
AppPublisher=Elec-Connect
AppPublisherURL=https://accounting-ai-automation.vercel.app
AppSupportURL=https://accounting-ai-automation.vercel.app
AppUpdatesURL=https://accounting-ai-automation.vercel.app
DefaultDirName={autopf}\AccountingAI
DefaultGroupName=Accounting AI
AllowNoIcons=yes
LicenseFile=license.txt
OutputDir=.
OutputBaseFilename=accounting-ai-setup-1.0.0
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64
DisableProgramGroupPage=yes
SetupLogging=yes

; ─── Langues ────────────────────────────────────────────────────
[Languages]
Name: "french"; MessagesFile: "compiler:Languages\French.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

; ─── Fichiers à inclure ─────────────────────────────────────────
[Files]
; ⭐ Prérequis (Docker + Node.js)
Source: "prerequisites\DockerDesktopInstaller.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall
Source: "prerequisites\node-v20.11.0-x64.msi"; DestDir: "{tmp}"; Flags: deleteafterinstall

; ⭐ Package complet (web + supabase + migrations + install.ps1)
Source: "package\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

; ─── Raccourcis ─────────────────────────────────────────────────
[Icons]
Name: "{group}\Accounting AI"; Filename: "{app}\web\start.bat"; WorkingDir: "{app}\web"; IconFilename: "{app}\web\public\favicon.ico"
Name: "{group}\Désinstaller Accounting AI"; Filename: "{uninstallexe}"
Name: "{commondesktop}\Accounting AI"; Filename: "{app}\web\start.bat"; WorkingDir: "{app}\web"; IconFilename: "{app}\web\public\favicon.ico"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Créer un raccourci sur le bureau"; GroupDescription: "Raccourcis :"

; ─── Actions après installation ─────────────────────────────────
[Run]
; 1. Installer Node.js silencieusement
Filename: "msiexec.exe"; \
  Parameters: "/i ""{tmp}\node-v20.11.0-x64.msi"" /qn /norestart"; \
  StatusMsg: "Installation de Node.js..."; \
  Flags: waituntilterminated

; 2. Installer Docker Desktop silencieusement
Filename: "{tmp}\DockerDesktopInstaller.exe"; \
  Parameters: "install --quiet --accept-license"; \
  StatusMsg: "Installation de Docker Desktop (2-3 min)..."; \
  Flags: waituntilterminated

; 3. ⭐ Exécuter install.ps1 pour configurer l'app
Filename: "powershell.exe"; \
  Parameters: "-ExecutionPolicy Bypass -NoProfile -File ""{app}\install.ps1"""; \
  StatusMsg: "Configuration d'Accounting AI..."; \
  Flags: waituntilterminated

; 4. Proposer de démarrer l'app
Filename: "{app}\web\start.bat"; \
  Description: "Démarrer Accounting AI maintenant"; \
  Flags: postinstall nowait skipifsilent shellexec

; ─── Messages personnalisés ─────────────────────────────────────
[Messages]
french.WelcomeLabel1=Bienvenue dans l'installation d'Accounting AI Automation
french.WelcomeLabel2=Ce programme va installer Accounting AI Automation sur votre ordinateur.%n%nComposants installés automatiquement :%n  • Node.js (environnement d'exécution)%n  • Docker Desktop (conteneurs)%n  • Supabase (base de données locale)%n  • Application Accounting AI%n%nDurée estimée : 5 à 10 minutes.%n%nVos clés Supabase seront générées automatiquement et resteront privées.

french.FinishedLabel1=L'installation d'Accounting AI est terminée
french.FinishedLabel2=Accounting AI a été installé avec succès sur votre ordinateur.%n%nPour démarrer l'application :%n  1. Double-cliquez sur l'icône "Accounting AI" du bureau%n  2. Attendez que Docker et Supabase démarrent (30-60 sec)%n  3. Votre navigateur s'ouvrira automatiquement%n%n⚠️ IMPORTANT : Docker Desktop doit rester actif pour que l'application fonctionne.

; ─── Désinstallation ────────────────────────────────────────────
[UninstallRun]
; Arrêter Docker Compose au moment de la désinstallation
Filename: "powershell.exe"; \
  Parameters: "-Command ""cd '{app}\supabase'; docker compose down"""; \
  Flags: runhidden; \
  RunOnceId: "StopDocker"

[UninstallDelete]
; Nettoyer les dossiers de données à la désinstallation (optionnel)
Type: filesandordirs; Name: "{app}\web\.next\cache"
; Type: filesandordirs; Name: "{app}\supabase\volumes"  ; ⚠️ DÉCOMMENTER pour supprimer les données