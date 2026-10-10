# 🔐 Sécurité

Mesures de sécurité du projet.

---

## 🛡️ Row Level Security (RLS)

### Statut par table

| Table | RLS | Policies |
|-------|-----|----------|
| `documents` | ✅ | 4 (SELECT, INSERT, UPDATE, DELETE) |
| `extractions` | ✅ | 3 (SELECT, INSERT, UPDATE) |
| `exceptions` | ✅ | 4 (SELECT, INSERT, UPDATE, DELETE) |
| `audit_log` | ✅ | 2 (SELECT admin, INSERT auth) |
| `settings` | ✅ | 2 (SELECT auth, ALL admin/accountant) |
| `profiles` | ✅ | 3 (SELECT, UPDATE own, ALL admin) |
| `document_embeddings` | ✅ | 2 (SELECT, INSERT) |

### Exemple — `documents`

```sql
-- Lecture : tous les authentifiés
CREATE POLICY "auth_read_documents"
  ON documents FOR SELECT
  TO authenticated
  USING (true);

-- Écriture : admin / accountant
CREATE POLICY "auth_update_documents"
  ON documents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_active = true
        AND profiles.role IN ('admin', 'accountant')
    )
  );
```

---

## 👤 Rôles utilisateurs

| Rôle | Permissions |
|------|-------------|
| `admin` | Accès total (settings, users, audit) |
| `accountant` | Documents, exceptions, rapports |
| `viewer` | Lecture seule |

### Vérification dans le middleware

```typescript
if (user && ADMIN_ROUTES.some(route => path.startsWith(route))) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin" || !profile.is_active) {
    return NextResponse.redirect("/dashboard?error=forbidden");
  }
}
```

---

## 🔑 Authentification à deux facteurs (2FA)

### TOTP

- **Bibliothèque** : `otplib`
- **Algorithme** : TOTP (RFC 6238)
- **Durée** : 30 secondes
- **Longueur** : 6 chiffres

### Setup

```
1. POST /api/auth/2fa/setup
   → Génère secret + QR code

2. Utilisateur scanne avec Google Authenticator

3. POST /api/auth/2fa/verify (code)
   → Active 2FA + génère 8 codes de secours
```

### Stockage

- `profiles.totp_secret` : secret TOTP
- `profiles.totp_enabled` : booléen
- `profiles.totp_backup_codes` : array de codes

---

## 🔒 Client Supabase

### 3 clients distincts

| Client | Usage | Clé |
|--------|-------|-----|
| `createClient` (browser) | Composants client | `ANON_KEY` |
| `createClient` (server) | Server Components | `ANON_KEY` + cookies |
| `createAdminClient` | Pipelines serveur | `SERVICE_ROLE_KEY` |

### ⚠️ Règles d'utilisation

- ❌ **Ne JAMAIS** utiliser `createAdminClient` dans un composant client
- ❌ **Ne JAMAIS** logger la `SERVICE_ROLE_KEY`
- ✅ **Uniquement** dans : `/api/cron/*`, `/api/inbound-email`, scripts serveur

---

## 🚨 Audit log

### Triggers automatiques

| Table | Trigger | Actions loggées |
|-------|---------|-----------------|
| `documents` | `audit_documents_trigger` | INSERT, UPDATE (status/confidence), DELETE |
| `exceptions` | `audit_exceptions_trigger` | INSERT, UPDATE (status), DELETE |
| `settings` | `audit_settings_trigger` | INSERT, UPDATE, DELETE |
| `profiles` | `audit_profiles_trigger` | INSERT, UPDATE (role/is_active) |

### Masking des secrets

Les clés sensibles sont **masquées** dans le journal :

```sql
-- Dans le trigger settings :
CASE
  WHEN key IN ('resend_api_key', 'resend_webhook_secret', 'groq_api_key')
  THEN '***MASKED***'
  ELSE value
END
```

### Nettoyage

Les logs > 90 jours sont supprimés automatiquement.

```sql
SELECT cleanup_old_audit_logs();
```

---

## 🔐 Variables d'environnement

### Où elles sont stockées

- **Local** : `.env.local` (jamais commité)
- **Production** : Vercel Environment Variables

### Catégories

| Type | Préfixe | Exposé au client |
|------|---------|------------------|
| Public | `NEXT_PUBLIC_*` | ✅ Oui |
| Secret | (aucun) | ❌ Non |

### Variables critiques

```
NEXT_PUBLIC_SUPABASE_URL       → public
NEXT_PUBLIC_SUPABASE_ANON_KEY  → public
SUPABASE_SERVICE_ROLE_KEY      → SECRET (admin)
GROQ_API_KEY                   → SECRET
RESEND_API_KEY                 → SECRET
CRON_SECRET                    → SECRET
```

---

## 🛡️ Protection des routes API

### Crons

```typescript
const authHeader = request.headers.get('authorization');
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### Webhooks (Resend)

Vérification de la signature `svix-signature` avec `whsec_...`.

### Upload

- Vérification taille max
- Vérification MIME type
- Hash anti-doublon

---

## 🔍 Détection d'activité suspecte

### Fonction `detect_suspicious_activity`

Détecte les tentatives de connexion multiples :

```sql
SELECT * FROM detect_suspicious_activity(
  p_hours => 1,
  p_threshold => 5
);
```

**Résultat** : IP, email, action, nombre de tentatives.

### Alertes email

Configuré dans `lib/audit/alerts.ts`.

---

## 🚫 Bonnes pratiques

1. **Toujours vérifier** `auth.getUser()` dans les routes sensibles
2. **Utiliser RLS** plutôt que de filtrer côté application
3. **Isoler** le client admin dans des fichiers dédiés
4. **Masquer** les secrets dans les logs
5. **Rotation** des clés API tous les 6 mois
6. **Activer 2FA** pour tous les admins
7. **Audit log** sur toutes les actions critiques
8. **HTTPS** uniquement (géré par Vercel)
9. **CSP headers** recommandés (à ajouter dans `next.config.js`)
10. **Rate limiting** recommandé sur les routes publiques (à ajouter)

---

## 🔗 Liens

- [Overview](./overview.md)
- [Data Flow](./data-flow.md)
- [Runbooks](../runbooks/README.md)