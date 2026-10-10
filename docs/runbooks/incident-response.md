# 🚨 Incident Response

Procédure en cas d'incident.

---

## 📊 Niveaux de sévérité

| Niveau | Description | Délai | Contact |
|--------|-------------|-------|---------|
| 🟢 Info | Question, suggestion | 24h | Slack |
| 🟡 Warning | Fonctionnalité dégradée | 4h | Email |
| 🔴 Critique | App inaccessible | 1h | Téléphone |

---

## 🚨 Incident 1 — App inaccessible

### Symptômes

- Page blanche
- Erreur 500
- Timeout

### Diagnostic

1. **Vérifier Vercel Status** : [vercel-status.com](https://vercel-status.com)
2. **Vérifier Supabase Status** : [status.supabase.com](https://status.supabase.com)
3. **Vérifier les logs Vercel** :

Vercel → Deployments → Logs.

### Solutions

**Si erreur build** :

```bash
# Fix local
cd apps/web
pnpm build
# Si erreur, corriger puis push
```

**Si erreur runtime** :

```bash
# Rollback
vercel rollback
```

---

## 🚨 Incident 2 — Extraction IA en échec

### Symptômes

- Documents restent en `received`
- Pas d'extraction

### Diagnostic

```sql
SELECT id, original_filename, status, created_at
FROM documents
WHERE status = 'received'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

### Vérifications

1. **`GROQ_API_KEY`** présente sur Vercel
2. **Logs** : `=== EXTRACT START ===`
3. **Rate limit Groq** atteint ?

### Solutions

**Relancer manuellement** :

```bash
curl -X POST https://accounting-ai-automation.vercel.app/api/documents/[ID]/process
```

**Retry automatique** : le code a un retry.

**Vérifier Groq Status** : [groqstatus.com](https://groqstatus.com).

---

## 🚨 Incident 3 — Emails non envoyés

### Diagnostic

**Tester** : Settings → Configuration Email → 📧 Tester l'envoi.

### Vérifications

1. **`RESEND_API_KEY`** valide
2. **Domaine vérifié** sur Resend
3. **Quota** Resend non dépassé

### Solutions

1. Regénère la clé sur [resend.com/api-keys](https://resend.com/api-keys)
2. Met à jour dans Settings
3. Re-teste

---

## 🚨 Incident 4 — Base de données lente

### Diagnostic

```sql
-- Voir les requêtes lentes
SELECT query, calls, total_time / calls AS avg_time
FROM pg_stat_statements
ORDER BY avg_time DESC
LIMIT 10;
```

### Solutions

1. **Ajouter des index** :

```sql
CREATE INDEX idx_documents_status_created
  ON documents(status, created_at DESC);
```

2. **Vacuum** :

```sql
VACUUM ANALYZE documents;
```

3. **Upgrade Supabase** (plan payant).

---

## 🚨 Incident 5 — Fuite de sécurité

### Actions immédiates

1. **Révoquer les clés API** compromises
2. **Forcer la déconnexion** de tous les utilisateurs :

```sql
DELETE FROM auth.sessions;
```

3. **Changer les mots de passe** des admins
4. **Analyser les logs d'audit** :

```sql
SELECT * FROM audit_log
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

5. **Contacter** :
   - Supabase support
   - Vercel support

---

## 📞 Escalade

| Niveau | Action | Délai |
|--------|--------|-------|
| 1 | Slack `#accounting-ai` | 24h |
| 2 | Email admin | 4h |
| 3 | Téléphone + Email | 1h |
| 4 | Escalade direction | Immédiat |

---

## 📝 Post-mortem

Après chaque incident :

1. **Documenter** : Date, cause, impact, résolution
2. **Analyser** : Qu'est-ce qui a mal tourné ?
3. **Corriger** : Actions préventives
4. **Partager** : Slack `#post-mortem`

---

## 🔗 Liens

- [Vercel Status](https://vercel-status.com)
- [Supabase Status](https://status.supabase.com)
- [Groq Status](https://groqstatus.com)
- [Resend Status](https://resend-status.com)