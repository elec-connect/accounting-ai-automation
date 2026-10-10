# 🤖 Accounting AI Automation

Automatisation comptable avec IA : extraction, vérification et rapports de documents comptables.

## ✨ Fonctionnalités

- 📤 Upload manuel + 📧 réception par email (webhook Resend)
- 🤖 Extraction IA avec score de confiance (Groq)
- ⚠️ Workflow d'exceptions (vérification manuelle)
- 📝 Résumé automatique
- 🔍 Détection de doublons
- 🏷️ Détection auto du type (facture, devis, BL, reçu)
- 💡 Suggestions IA de correction
- 📊 Dashboard avec graphiques
- 📤 Export Excel / PDF / CSV
- 🌍 Multilingue (FR / EN / AR)
- 🔒 2FA + audit log
- ⏰ Crons configurables
- 📧 Relances automatiques

## 🛠️ Stack

- **Frontend** : Next.js 15 (App Router) + React 19 + Tailwind CSS
- **Backend** : Next.js API Routes (Node.js)
- **Base de données** : Supabase (PostgreSQL + Auth + Storage)
- **IA** : Groq (Llama 3.3)
- **Emails** : Resend
- **Déploiement** : Vercel
- **Crons** : Vercel Cron

## 📋 Prérequis

- Node.js 20+
- pnpm 9+
- Supabase (compte + projet)
- Groq (clé API)
- Resend (clé API)
- Vercel (pour la production)

## 🚀 Installation

```bash
# Cloner le repo
git clone https://github.com/elec-connect/accounting-ai-automation.git
cd accounting-ai-automation

# Installer les dépendances
pnpm install

# Configurer les variables d'environnement
cp .env.example .env.local
# Remplir .env.local avec tes clés

# Lancer Supabase (optionnel, en local)
cd infra/supabase
supabase start
supabase db reset

# Lancer le serveur
cd apps/web
pnpm dev