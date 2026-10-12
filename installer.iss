[Setup]
AppName=Accounting AI Automation
AppVersion=1.0.0
AppPublisher=Ton Entreprise
DefaultDirName={autopf}\AccountingAI
DefaultGroupName=Accounting AI
OutputBaseFilename=accounting-ai-setup
Compression=lzma2
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64
WizardStyle=modern

[Files]
; Docker Desktop installer (à télécharger et inclure)
Source: "docker-installer.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall

; Ton app
Source: "app\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Accounting AI"; Filename: "{app}\web\start.bat"
Name: "{commondesktop}\Accounting AI"; Filename: "{app}\web\start.bat"

[Run]
; Installer Docker silencieusement
Filename: "{tmp}\docker-installer.exe"; Parameters: "install --quiet --accept-license"; StatusMsg: "Installation de Docker..."; Flags: waituntilterminated

; Démarrer Docker
Filename: "C:\Program Files\Docker\Docker\Docker Desktop.exe"; StatusMsg: "Démarrage de Docker..."; Flags: nowait

; Attendre Docker
Filename: "powershell.exe"; Parameters: "-Command ""Start-Sleep 30"""; StatusMsg: "Attente de Docker..."; Flags: waituntilterminated

; Démarrer Supabase
Filename: "{app}\web\start.bat"; StatusMsg: "Démarrage de l'application..."; Flags: postinstall nowait

[Messages]
WelcomeLabel2=Ce programme va installer Accounting AI Automation sur votre ordinateur.%n%nL'installation inclut Docker Desktop, Supabase local et l'application.