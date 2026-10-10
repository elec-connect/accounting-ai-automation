# 📕 Runbooks

Procédures pour incidents et maintenance.

---

## 🚨 Incidents courants

### 1. Extraction IA en échec

**Symptômes** : Les documents restent en `received` et ne passent pas à `extracted`.

**Diagnostic** :

```sql
SELECT id, original_filename, status, created_at
FROM documents
WHERE status = 'received'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

**Vérifications** :

1. La clé `GROQ_API_KEY` est présente sur Vercel
2. Les logs Vercel montrent `=== EXTRACT START ===`
3. Le texte extrait n'est pas vide

**Solution** :

```bash
# Relancer manuellement le pipeline
curl -X POST https://accounting-ai-automation.vercel.app/api/documents/[ID]/process
```

---

### 2. Emails non envoyés

**Symptômes** : Pas d'email de notification reçu.

**Diagnostic** :

```sql
SELECT key, value FROM settings
WHERE key IN ('resend_api_key', 'email_from', 'email_to');
```

**Vérifications** :

1. `resend_api_key` est défini
2. Le domaine est vérifié sur Resend
3. `email_to` est une adresse valide

**Solution** :

1. Va dans **Settings → Configuration Email**
2. Clique sur **📧 Tester l'envoi**
3. Vérifie les logs Vercel

---

### 3. Crons non exécutés

**Symptômes** : Pas de rapport hebdomadaire reçu.

**Diagnostic** :

1. Va sur **Vercel → Deployments → Logs**
2. Cherche `cron` dans les logs
3. Vérifie les résultats :
   - `{ "skipped": true, "reason": "wrong_hour" }` → normal
   - `{ "success": true, "sent": N }` → OK
   - `{ "error": "..." }` → problème

**Vérifications** :

1. `vercel.json` contient bien les crons
2. `CRON_SECRET` est défini sur Vercel
3. Le plan Vercel permet les crons journaliers

**Note Hobby** :
- Cron **1× par jour maximum**
- Précision **±59 min**
- Pas possible de faire `0 * * * *`

---

### 4. Erreur mémoire Next.js

**Symptômes** :

```
RangeError: Array buffer allocation failed
```

**Solution** :

```powershell
# 1. Arrêter tous les processus Node
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# 2. Nettoyer le cache
cd C:\Projects\accounting-ai-automation\apps\web
Remove-Item ".next" -Recurse -Force
Remove-Item "node_modules\.cache" -Recurse -Force

# 3. Augmenter la mémoire
$env:NODE_OPTIONS = "--max-old-space-size=8192"

# 4. Relancer
pnpm dev
```

---

### 5. Doublons non détectés

**Symptômes** : Les mêmes factures sont importées plusieurs fois.

**Diagnostic** :

```sql
SELECT invoice_number, COUNT(*) as count
FROM (
  SELECT extracted_fields->>'invoice_number' AS invoice_number
  FROM extractions
) t
WHERE invoice_number IS NOT NULL
GROUP BY invoice_number
HAVING COUNT(*) > 1;
```

**Solution** :

1. Va dans **Settings → Seuil de confiance**
2. Vérifie que `confidence_high_severity` n'est pas trop élevé
3. Le seuil de détection est dans `extract/route.ts`

---

### 6. RLS bloque les opérations

**Symptômes** :

```
new row violates row-level security policy for table "..."
```

**Diagnostic** :

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = true;

SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
```

**Solution** :

1. Vérifie que les policies existent pour la table
2. Vérifie que l'utilisateur a le bon rôle (`admin`, `accountant`)
3. Pour les pipelines serveur, utilise `createAdminClient()`

---

### 7. Build Vercel échoue

**Symptômes** :

```
Error: Command "pnpm build" exited with 1
```

**Diagnostic** :

1. Va sur **Vercel → Deployments → [dernier] → Logs**
2. Cherche l'erreur exacte

**Erreurs courantes** :

| Erreur | Cause | Solution |
|--------|-------|----------|
| `Unused '@ts-expect-error'` | Commentaire inutile | Retirer la ligne |
| `Module not found` | Import cassé | Vérifier le chemin |
| `Type error` | Typage | Corriger le type |
| `Out of memory` | RAM insuffisante | Augmenter `NODE_OPTIONS` |

---

## 🔧 Maintenance

### Rotation des logs d'audit

Les logs sont nettoyés automatiquement après **90 jours**.

**Manuel** :

```sql
SELECT public.cleanup_old_audit_logs();
```

**Vérifier le nombre de logs** :

```sql
SELECT COUNT(*), MIN(created_at), MAX(created_at)
FROM audit_log;
```

---

### Backup de la base de données

**Via Supabase CLI** :

```bash
# Installer Supabase CLI
npm install -g supabase

# Se connecter
supabase login

# Backup
supabase db dump -f backup-$(date +%Y-%m-%d).sql
```

**Via pg_dump** :

```bash
pg_dump "postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres" \
  > backup.sql
```

---

### Restauration

```bash
# Reset complet
supabase db reset

# Restaurer depuis un backup
psql -h db.xxx.supabase.co -U postgres -f backup.sql
```

---

### Rotation des clés API

**Recommandé tous les 6 mois** :

1. **Groq** : Génère une nouvelle clé sur [console.groq.com](https://console.groq.com)
2. **Resend** : Génère une nouvelle clé sur [resend.com/api-keys](https://resend.com/api-keys)
3. **Supabase service_role** : Régénère dans **Settings → API**
4. Met à jour les variables sur Vercel
5. Redéploie

---

### Monitoring

**Vérifications quotidiennes** :

```sql
-- Documents en attente
SELECT COUNT(*) FROM documents WHERE status = 'received';

-- Exceptions ouvertes
SELECT COUNT(*) FROM exceptions WHERE status = 'open';

-- Dernier rapport envoyé
SELECT value FROM settings WHERE key = 'cron_last_run';

-- Dernière relance
SELECT value FROM settings WHERE key = 'reminder_last_run';
```

**Alertes à configurer** :

- Plus de 10 documents en `received` depuis > 1h
- Plus de 5 exceptions ouvertes depuis > 7 jours
- Aucun rapport envoyé depuis > 8 jours

---

## 📞 Escalade

| Niveau | Contact | Délai |
|--------|---------|-------|
| 🟢 Info | Slack `#accounting-ai` | 24h |
| 🟡 Warning | Email admin | 4h |
| 🔴 Critique | Téléphone + Email | 1h |

---

## 🔗 Liens utiles

- [Supabase Dashboard](https://supabase.com/dashboard)
- [Vercel Dashboard](https://vercel.com/dashboard)
- [Groq Console](https://console.groq.com)
- [Resend Dashboard](https://resend.com)
- [GitHub Repo](https://github.com/elec-connect/accounting-ai-automation)