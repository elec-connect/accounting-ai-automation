===========================================================
  ACCOUNTING AI AUTOMATION
  Guide d'utilisation
===========================================================

Version : 1.0.0
Site : https://accounting-ai-automation.vercel.app


-----------------------------------------------------------
  DEMARRAGE RAPIDE
-----------------------------------------------------------

1. Double-cliquez sur l'icone "Accounting AI" sur votre Bureau

2. Attendez que Docker et Supabase demarrent (30-60 secondes)

3. Votre navigateur s'ouvre automatiquement sur l'application

4. Creez votre compte administrateur

5. Activez votre licence (voir section Activation)


-----------------------------------------------------------
  ACTIVATION DE LA LICENCE
-----------------------------------------------------------

1. Connectez-vous a l'application

2. Allez dans "Parametres" > "Ma licence"

3. Collez la cle de licence recue par email

4. Cliquez sur "Activer"

5. Votre licence est active


-----------------------------------------------------------
  CONFIGURATION MINIMALE
-----------------------------------------------------------

- Windows 10 / 11 (64-bit)
- 8 Go de RAM (16 Go recommande)
- 50 Go d'espace disque libre
- Connexion Internet (pour l'activation uniquement)

Les composants suivants sont installes automatiquement :
  * Docker Desktop (pour les conteneurs)
  * Node.js (environnement d'execution)
  * Supabase (base de donnees locale)
  * Application Accounting AI


-----------------------------------------------------------
  UTILISATION QUOTIDIENNE
-----------------------------------------------------------

POUR DEMARRER L'APPLICATION :
  > Double-cliquez sur "Accounting AI" sur le Bureau
  > Attendez 30 secondes que tout demarre
  > Utilisez l'application dans votre navigateur

POUR ARRETER L'APPLICATION :
  > Fermez la fenetre du terminal
  > Docker Desktop continuera en arriere-plan

POUR ECONOMISER LES RESSOURCES :
  > Clic droit sur l'icone Docker (barre des taches)
  > "Quit Docker Desktop"
  > Relancez plus tard si besoin


-----------------------------------------------------------
  STRUCTURE DES DOSSIERS
-----------------------------------------------------------

C:\Program Files\AccountingAI\
|- web\                    Application Next.js
|  |- start.bat            Script de demarrage
|
|- supabase\               Base de donnees locale
|  |- docker-compose.yml   Configuration Docker
|  |- volumes\             Vos donnees (NE PAS SUPPRIMER)
|  |- .env                 Cles de securite (CONFIDENTIEL)
|
|- migrations\             Structure de la base


-----------------------------------------------------------
  DEPANNAGE
-----------------------------------------------------------

QUESTION : L'application ne demarre pas ?

  1. Verifiez que Docker Desktop est lance
     > Icone baleine dans la barre des taches

  2. Attendez 1 minute (Supabase peut etre lent au demarrage)

  3. Rechargez la page dans le navigateur (F5)


QUESTION : Erreur "Can't connect to Docker" ?

  1. Ouvrez Docker Desktop
  2. Attendez qu'il soit completement demarre
  3. Relancez Accounting AI


QUESTION : Le navigateur n'affiche rien ?

  1. Ouvrez manuellement : http://localhost:3000
  2. Si erreur : attendez 30 secondes de plus
  3. Si toujours rien : redemarrez votre PC


QUESTION : Erreur "License invalid" ?

  1. Verifiez que vous avez Internet
  2. Verifiez que la cle est correcte
  3. Contactez le support


QUESTION : Comment sauvegarder mes donnees ?

  Copiez regulierement ce dossier :
  > C:\Program Files\AccountingAI\supabase\volumes\


-----------------------------------------------------------
  SECURITE
-----------------------------------------------------------

VOS DONNEES SONT 100% LOCALES
  * Vos factures et documents restent sur VOTRE PC
  * Rien n'est envoye a un serveur externe (sauf verification de licence)
  * Vos cles Supabase sont uniques a votre installation

NE JAMAIS PARTAGER :
  * Le fichier supabase\.env (contient vos cles)
  * Le dossier volumes\ (contient vos donnees)

SAUVEGARDE :
  Faites des copies regulieres de :
  > C:\Program Files\AccountingAI\supabase\volumes\


-----------------------------------------------------------
  SUPPORT
-----------------------------------------------------------

Email : support@ton-entreprise.com
Site : https://accounting-ai-automation.vercel.app

Horaires : Lundi-Vendredi, 9h-18h (UTC+1)


-----------------------------------------------------------
  LICENCE
-----------------------------------------------------------

Ce logiciel est protege par des droits d'auteur.
Votre licence personnelle vous donne le droit d'utilisation
sur UN seul ordinateur.

(c) 2026 Accounting AI Automation. Tous droits reserves.


===========================================================
  Merci d'utiliser Accounting AI Automation !
===========================================================