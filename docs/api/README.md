# 🔌 API Reference

Documentation des endpoints de l'API.

## Base URL

- **Local** : `http://localhost:3000/api`
- **Production** : `https://accounting-ai-automation.vercel.app/api`

## Endpoints

### Documents

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/documents/upload` | Upload manuel d'un document |
| `POST` | `/documents/[id]/extract` | Extraction IA |
| `POST` | `/documents/[id]/summarize` | Résumé IA |
| `POST` | `/documents/[id]/process` | Pipeline complet (mode manuel) |
| `POST` | `/documents/[id]/reprocess` | Relancer l'IA |
| `POST` | `/documents/[id]/status` | Changer le statut |
| `POST` | `/documents/[id]/delete` | Supprimer |
| `POST` | `/documents/check-duplicate` | Vérifier les doublons |
| `POST` | `/documents/advanced-search` | Recherche avancée |
| `GET` | `/documents/export-csv` | Export CSV |
| `GET` | `/documents/export-pdf` | Export PDF |
| `GET` | `/documents/report/excel` | Export Excel |

### Dashboard

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/dashboard/stats` | Statistiques générales |
| `GET` | `/dashboard/confidence-stats` | Distribution des scores |
| `GET` | `/dashboard/type-stats` | Stats par type |

### Settings

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/settings` | Lire les settings |
| `POST` | `/settings` | Mettre à jour |
| `POST` | `/settings/test` | Envoyer un email de test |
| `GET` | `/settings/health` | État des variables |

### Cron

| Méthode | Endpoint | Fréquence |
|---------|----------|-----------|
| `GET` | `/cron/send-report` | Journalier (7h UTC) |
| `GET` | `/cron/send-reminders` | Journalier (8h UTC) |

### Autres

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/audit` | Journal d'audit (admin) |
| `GET` | `/reports/stats` | Stats pour rapports |
| `GET` | `/search` | Recherche simple |
| `POST` | `/inbound-email` | Webhook Resend |