# 🏗️ Vue d'ensemble

Architecture technique du projet Accounting AI Automation.

---

## 🎯 Objectif

Automatiser le traitement comptable :
- **Extraction** des factures, devis, bons de livraison
- **Classification** automatique du type
- **Vérification** par un humain (si nécessaire)
- **Rapports** et exports

---

## 🏛️ Architecture globale

```
┌─────────────────────────────────────────────────────────┐
│                       CLIENT                            │
│  Navigateur (Chrome, Firefox, Safari)                   │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    VERCEL (CDN + Edge)                  │
│  • Static assets                                        │
│  • Middleware (auth + i18n)                             │
│  • API Routes                                           │
│  • Cron Jobs                                            │
└──────────────────────────┬──────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  Supabase    │   │    Groq      │   │   Resend     │
│              │   │              │   │              │
│  • Postgres  │   │  • LLM       │   │  • Emails    │
│  • Auth      │   │  • Extraction│   │  • Webhooks  │
│  • Storage   │   │  • Résumé    │   │              │
│  • RLS       │   │              │   │              │
└──────────────┘   └──────────────┘   └──────────────┘
```

---

## 🔧 Composants

### Frontend

- **Framework** : Next.js 15 (App Router)
- **UI** : React 19 + Tailwind CSS
- **Graphiques** : Recharts
- **i18n** : next-intl (FR / EN / AR)
- **State** : React hooks + Context

### Backend

- **Runtime** : Node.js (Vercel Functions)
- **API** : Next.js Route Handlers
- **Auth** : Supabase Auth + 2FA TOTP
- **Middleware** : Auth Supabase + i18n

### Base de données

- **PostgreSQL** : Supabase
- **Auth** : Supabase Auth
- **Storage** : Supabase Storage
- **RLS** : Row Level Security

### Services externes

- **Groq** : Extraction IA, résumés, suggestions
- **Resend** : Emails transactionnels et webhooks

### Déploiement

- **Vercel** : Hébergement + crons

---

## 📊 Modules fonctionnels

### 1. Documents

- Upload manuel / email
- Extraction IA
- Résumé IA
- Édition des champs
- Reprocesser

### 2. Exceptions

- Détection automatique (score < seuil)
- Workflow : approuver / rejeter
- Relances automatiques

### 3. Audit

- Journal automatique (triggers)
- Filtres par action
- Détection d'activité suspecte

### 4. Rapports

- Top fournisseurs
- Évolution mensuelle
- Export Excel / PDF / CSV

### 5. Settings

- Configuration email (Resend)
- Cron (rapport automatique)
- Relances (exceptions)
- Seuil de confiance IA
- 2FA

---

## 🔐 Sécurité

- RLS sur toutes les tables
- 2FA TOTP pour les admins
- Audit log automatique
- Client admin isolé (service_role)
- Secrets dans variables d'environnement

---

## 📈 Scalabilité

- **Stateless** : API Routes (scalables horizontalement)
- **Cache** : Next.js Data Cache + Vercel Edge
- **Crons** : Vercel Cron Jobs
- **DB** : Pooling Supabase

---

## 🔗 Liens

- [Data Flow](./data-flow.md)
- [Security](./security.md)
- [Diagrams](./diagrams/)