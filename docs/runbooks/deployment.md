# 🚀 DeploymentProcédure de déploiement.

---

## 📋 Prérequis

- Node.js 20+
- pnpm 9+
- Vercel CLI (`npm i -g vercel`)
- Compte Vercel configuré

---

## 🚀 Déploiement en production

### 1. Vérifier les changements

```bash
cd C:\Projects\accounting-ai-automation
git status
git log --oneline -5
```

### 2. Build local

```bash
cd apps/web
Remove-Item ".next" -Recurse -Force
$env:NODE_OPTIONS = "--max-old-space-size=8192"
pnpm build
```

**Résultat attendu** : `✓ Compiled successfully`.

### 3. Commit + Push

```bash
cd C:\Projects\accounting-ai-automation
git add .
git commit -m "feat: Description"
git push origin main
```

### 4. Attendre Vercel

Vercel détecte le push et déploie automatiquement (1-2 min).

**Vérifier** :
- Vercel → Deployments → Statut `Ready`

### 5. En cas de problème

**Force un redéploiement** :

```bash
vercel --prod
```

**Ou via CLI** :

```bash
vercel --prod --force
```

---

## 🔧 Variables d'environnement

### Sur Vercel

1. Va sur Vercel → **Settings → Environment Variables**
2. Vérifie que ces variables existent **en Production** :

| Variable | Critique |
|----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | 🔴 |
| `GROQ_API_KEY` | ✅ |
| `RESEND_API_KEY` | ✅ |
| `CRON_SECRET` | ✅ |
| `NEXT_PUBLIC_APP_URL` | ✅ |

### En local

```bash
cp .env.example .env.local
# Éditer .env.local
```

---

## 🗄️ Base de données

### Appliquer les migrations

```bash
# Local
cd infra/supabase
supabase db reset

# Production
supabase db push
```

### Vérifier le schéma

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

**Attendu** : `audit_log`, `documents`, `exceptions`, `extractions`, `profiles`, `settings`, `document_embeddings`.

---

## ⏰ Crons Vercel

### Configuration

**Fichier** : `vercel.json`

```json
{
  "crons": [
    { "path": "/api/cron/send-report", "schedule": "0 7 * * *" },
    { "path": "/api/cron/send-reminders", "schedule": "0 8 * * *" }
  ]
}
```

### ⚠️ Limites Hobby

- **1× par jour maximum**
- Précision : ±59 min
- Voir [Pricing Vercel](https://vercel.com/pricing)

### Vérifier

Vercel → **Settings → Cron Jobs**.

---

## 🔍 Vérifications post-déploiement

### 1. Page d'accueil

```
https://accounting-ai-automation.vercel.app/
```

**Attendu** : page s'affiche.

### 2. Login

**Attendu** : formulaire s'affiche.

### 3. Dashboard

```
https://accounting-ai-automation.vercel.app/dashboard
```

**Attendu** : KPI, graphiques, top fournisseurs.

### 4. Upload

**Attendu** : fichier uploadé + extraction.

### 5. Cron manuel

```bash
curl -H "Authorization: Bearer TON_CRON_SECRET" \
  https://accounting-ai-automation.vercel.app/api/cron/send-report
```

**Attendu** : `{ "skipped": true, "reason": "wrong_hour" }` ou `{ "success": true }`.

---

## 🔄 Rollback

### Vercel

1. Vercel → **Deployments**
2. Trouve le déploiement précédent
3. Clique sur **`...`** → **Promote to Production**

### Git

```bash
git revert HEAD
git push origin main
```

---

## 📞 Support

- Vercel Status : [vercel-status.com](https://vercel-status.com)
- Supabase Status : [status.supabase.com](https://status.supabase.com)
- Groq Status : [groqstatus.com](https://groqstatus.com)