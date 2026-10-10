# 🏗️ Architecture

Vue d'ensemble de l'architecture technique du projet Accounting AI Automation.

---

## 📊 Stack technique

```
FRONTEND      →  Next.js 15 (App Router) + React 19 + Tailwind CSS
                 i18n (FR / EN / AR) via next-intl
                 Recharts pour les graphiques

BACKEND       →  Next.js API Routes (Node.js runtime)
                 Routes API : documents, settings, cron, audit
                 Middleware : auth Supabase + i18n
                 Pipeline IA : extract + summarize + detect

SERVICES      →  Supabase    : Postgres + Auth + Storage + RLS
                 Groq        : Llama 3.3 (extraction, résumé, suggestions)
                 Resend      : Emails + Webhooks + Rapports

DÉPLOIEMENT   →  Vercel (hébergement + crons)
```

---

## 🔄 Flux de traitement d'un document

```
1. ARRIVÉE
   • Upload manuel via UI
   • Email entrant via webhook Resend
        │
        ▼
2. STOCKAGE
   • Fichier  →  Supabase Storage
   • Ligne    →  table documents (status = 'received')
   • Hash     →  anti-doublon
        │
        ▼
3. EXTRACTION (IA)
   • PDF     →  unpdf
   • Image   →  tesseract.js (OCR)
   • Excel   →  xlsx
   • CSV     →  csv-parse
   • Word    →  mammoth
   • Groq analyse le texte
   • Score de confiance (0-100)
   • Type détecté (invoice/quote/delivery_note/receipt)
        │
        ▼
4. DÉCISION AUTOMATIQUE
   • Score >= seuil (90%)  →  auto_approved
   • Score <  seuil        →  exception
   • Doublon détecté       →  exception
        │
        ▼
5. RÉSUMÉ (IA)
   • Groq génère un résumé en 1-2 phrases
   • Retry automatique si échec
        │
        ▼
6. NOTIFICATION
   • Email si exception créée
   • Inclus : fichier, score, sévérité, raison
        │
        ▼
7. VÉRIFICATION HUMAINE (si exception)
   • Approuver
   • Rejeter (avec motif)
   • Éditer les champs extraits
   • Reprocesser si besoin
        │
        ▼
8. LIVRAISON
   • Bouton "Marquer comme livré"
   • Statut  →  delivered
        │
        ▼
9. RAPPORTS
   • Envoi automatique par cron
   • Export Excel / PDF / CSV
   • Relances automatiques des exceptions
```

---

## 🗄️ Schéma de base de données

```
auth.users
    │
    ▼
profiles  (role, is_active, 2FA)

documents  1──N  extractions
    │
    │ 1─N
    ▼
exceptions

audit_log  (journal de toutes les actions)
settings   (configuration applicative)
document_embeddings  (RAG / recherche sémantique)
```

### Tables principales

| Table | Rôle |
|-------|------|
| `documents` | Documents uploadés/reçus (20 colonnes) |
| `extractions` | Données extraites par l'IA |
| `exceptions` | Documents nécessitant vérification manuelle |
| `audit_log` | Journal d'audit automatique |
| `settings` | Configuration (email, cron, seuils) |
| `profiles` | Profils utilisateurs étendus |
| `document_embeddings` | Embeddings vectoriels pour RAG |

---

## 🔐 Sécurité

```
Row Level Security (RLS)
   • Activée sur TOUTES les tables
   • Policies basées sur le rôle (admin / accountant / viewer)

Authentification
   • Supabase Auth (email + password)
   • 2FA TOTP (Google Authenticator, Authy)
   • Codes de secours

Audit
   • Triggers automatiques sur documents/exceptions/settings/profiles
   • Masking des clés sensibles (API keys, secrets)
   • Nettoyage automatique après 90 jours

Pipelines serveur
   • Client admin (service_role) pour bypass RLS
   • CRON_SECRET pour protéger les crons
   • VERCEL_AUTOMATION_BYPASS_SECRET pour les appels internes
```

---

## 📁 Structure du projet

```
accounting-ai-automation/
├── apps/
│   └── web/                       # Application Next.js
│       ├── src/
│       │   ├── app/              # App Router (pages + API)
│       │   ├── components/       # Composants React
│       │   ├── lib/              # Utilitaires (supabase, email, audit)
│       │   ├── hooks/            # Hooks React
│       │   └── i18n/             # Configuration i18n
│       ├── messages/             # Fichiers de traduction (fr, en, ar)
│       └── public/               # Fichiers statiques
│
├── infra/
│   ├── supabase/
│   │   ├── migrations/           # Migrations SQL
│   │   ├── config.toml           # Config Supabase local
│   │   └── seed.sql              # Données de test
│   ├── docker/                   # Dockerfiles
│   └── terraform/                # IaC (optionnel)
│
├── docs/                         # Documentation
│   ├── api/                      # Endpoints
│   ├── architecture/             # (ce fichier)
│   ├── case-study/               # Exemples
│   └── runbooks/                 # Procédures d'incident
│
├── scripts/                      # Scripts utilitaires
├── tests/                        # Tests unitaires et E2E
├── .github/workflows/            # CI/CD GitHub Actions
├── vercel.json                   # Config Vercel (crons)
└── README.md                     # Documentation principale
```

---

## 🔗 Liens utiles

- [API Reference](../api/README.md)
- [Runbooks](../runbooks/README.md)
- [Case Studies](../case-study/README.md)