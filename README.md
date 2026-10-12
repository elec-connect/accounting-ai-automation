═══════════════════════════════════════════════════════════════════
  ACCOUNTING AI AUTOMATION
  Guide d'utilisation
═══════════════════════════════════════════════════════════════════

Version : 1.0.0
Site : https://accounting-ai-automation.vercel.app
Support : support@ton-entreprise.com


───────────────────────────────────────────────────────────────────
  🚀 DÉMARRAGE RAPIDE
───────────────────────────────────────────────────────────────────

1. Double-cliquez sur l'icône "Accounting AI" sur votre Bureau

2. Attendez que Docker et Supabase démarrent (30-60 secondes)

3. Votre navigateur s'ouvre automatiquement sur l'application

4. Créez votre compte administrateur

5. Activez votre licence (voir section Activation)


───────────────────────────────────────────────────────────────────
  🔑 ACTIVATION DE LA LICENCE
───────────────────────────────────────────────────────────────────

1. Connectez-vous à l'application

2. Allez dans "Paramètres" → "Ma licence"

3. Collez la clé de licence reçue par email

4. Cliquez sur "Activer"

5. ✅ Votre licence est active


───────────────────────────────────────────────────────────────────
  💻 CONFIGURATION MINIMALE
───────────────────────────────────────────────────────────────────

• Windows 10 / 11 (64-bit)
• macOS 12+ (Intel ou Apple Silicon)
• 8 Go de RAM (16 Go recommandé)
• 50 Go d'espace disque libre
• Connexion Internet (pour l'activation uniquement)

Les composants suivants sont installés automatiquement :
  ✓ Docker Desktop (pour les conteneurs)
  ✓ Node.js (environnement d'exécution)
  ✓ Supabase (base de données locale)
  ✓ Application Accounting AI


───────────────────────────────────────────────────────────────────
  ⚙️ UTILISATION QUOTIDIENNE
───────────────────────────────────────────────────────────────────

POUR DÉMARRER L'APPLICATION :
  → Double-cliquez sur "Accounting AI" sur le Bureau
  → Attendez 30 secondes que tout démarre
  → Utilisez l'application dans votre navigateur

POUR ARRÊTER L'APPLICATION :
  → Fermez la fenêtre du terminal
  → Docker Desktop continuera en arrière-plan

POUR ÉCONOMISER LES RESSOURCES :
  → Clic droit sur l'icône Docker (barre des tâches)
  → "Quit Docker Desktop"
  → Relancez plus tard si besoin


───────────────────────────────────────────────────────────────────
  📁 STRUCTURE DES DOSSIERS
───────────────────────────────────────────────────────────────────

C:\Program Files\AccountingAI\
├── web\                    Application Next.js
│   └── start.bat           Script de démarrage
│
├── supabase\               Base de données locale
│   ├── docker-compose.yml  Configuration Docker
│   ├── volumes\            Vos données (⚠️ NE PAS SUPPRIMER)
│   └── .env                Clés de sécurité (⚠️ CONFIDENTIEL)
│
└── migrations\             Structure de la base


───────────────────────────────────────────────────────────────────
  🛠️ DÉPANNAGE
───────────────────────────────────────────────────────────────────

❓ L'application ne démarre pas ?

  1. Vérifiez que Docker Desktop est lancé
     → Icône baleine 🐳 dans la barre des tâches
     
  2. Attendez 1 minute (Supabase peut être lent au démarrage)
  
  3. Rechargez la page dans le navigateur (F5)


❓ Erreur "Can't connect to Docker" ?

  1. Ouvrez Docker Desktop
  2. Attendez qu'il soit complètement démarré
  3. Relancez Accounting AI


❓ Le navigateur n'affiche rien ?

  1. Ouvrez manuellement : http://localhost:3000
  2. Si erreur : attendez 30 secondes de plus
  3. Si toujours rien : redémarrez votre PC


❓ Erreur "License invalid" ?

  1. Vérifiez que vous avez Internet
  2. Vérifiez que la clé est correcte (majuscules OK)
  3. Contactez le support


❓ Comment sauvegarder mes données ?

  Copiez régulièrement ce dossier :
  → C:\Program Files\AccountingAI\supabase\volumes\


───────────────────────────────────────────────────────────────────
  🔒 SÉCURITÉ
───────────────────────────────────────────────────────────────────

VOS DONNÉES SONT 100% LOCALES
  • Vos factures et documents restent sur VOTRE PC
  • Rien n'est envoyé à un serveur externe (sauf vérification de licence)
  • Vos clés Supabase sont uniques à votre installation

⚠️  NE JAMAIS PARTAGER :
  • Le fichier supabase\.env (contient vos clés)
  • Le dossier volumes\ (contient vos données)

⚠️  SAUVEGARDE :
  Faites des copies régulières de :
  → C:\Program Files\AccountingAI\supabase\volumes\


───────────────────────────────────────────────────────────────────
  📞 SUPPORT
───────────────────────────────────────────────────────────────────

Email : support@ton-entreprise.com
Site : https://accounting-ai-automation.vercel.app
Documentation : https://accounting-ai-automation.vercel.app/docs

Horaires : Lundi-Vendredi, 9h-18h (UTC+1)


───────────────────────────────────────────────────────────────────
  📄 LICENCE
───────────────────────────────────────────────────────────────────

Ce logiciel est protégé par des droits d'auteur.
Votre licence personnelle vous donne le droit d'utilisation
sur UN seul ordinateur.

© 2026 Accounting AI Automation. Tous droits réservés.


═══════════════════════════════════════════════════════════════════
  Merci d'utiliser Accounting AI Automation !
═══════════════════════════════════════════════════════════════════