# 📈 Scaling

Stratégies de mise à l'échelle.

---

## 📊 Métriques actuelles

| Métrique | Valeur | Limite |
|----------|--------|--------|
| Documents | 56 | ~10 000 |
| Utilisateurs | ~5 | ~100 |
| Requêtes/jour | ~500 | ~100 000 |
| Taille DB | ~5 MB | ~500 MB |

---

## 🎯 Goulots d'étranglement

### 1. Base de données

**Symptômes** :
- Requêtes lentes (> 500ms)
- Timeouts

**Solutions** :

a) **Ajouter des index** :

```sql
CREATE INDEX idx_documents_status_created
  ON documents(status, created_at DESC);

CREATE INDEX idx_extractions_invoice_number
  ON extractions ((extracted_fields->>'invoice_number'));
```

b) **Pooling** : Supabase gère le pooling automatiquement.

c) **Upgrade** : passer au plan payant Supabase.

---

### 2. Groq API

**Symptômes** :
- `429 Too Many Requests`
- Rate limit atteint

**Limites Groq** :

| Plan | RPM | TPM |
|------|-----|-----|
| Free | 30 | 14 400 |
| Pro | 1 000 | 500 000 |

**Solutions** :

a) **Queue** : mettre les extractions en file d'attente.

b) **Retry** : déjà implémenté avec backoff.

c) **Upgrade** Groq Pro.

---

### 3. Vercel Functions

**Symptômes** :
- Timeout (max 60s sur Hobby)
- Cold start

**Solutions** :

a) **Streaming** : utiliser les streams.

b) **Edge Functions** : pour les opérations simples.

c) **Upgrade** Vercel Pro (300s timeout).

---

### 4. Storage

**Symptômes** :
- Fichiers volumineux
- Quota dépassé

**Limites** :

| Plan | Storage |
|------|---------|
| Free | 1 GB |
| Pro | 100 GB |

**Solutions** :

a) **Compression** : compresser les PDFs.

b) **Cleanup** : supprimer les vieux fichiers.

c) **Upgrade** Supabase Pro.

---

## 📈 Stratégies

### Horizontal (Vercel)

Vercel scale automatiquement. Aucune action nécessaire.

### Vertical (Supabase)

**Upgrade** :
- Free → Pro : 8 GB DB, 100 GB storage
- Pro → Enterprise : illimité

### Cache

**Next.js** :

```typescript
// Réutiliser les données entre requêtes
export const revalidate = 60; // 60 secondes
```

**Vercel Edge** : activer la mise en cache.

### Queue

**Upstash Redis** ou **Vercel KV** :

```typescript
import { Redis } from '@upstash/redis';
const redis = Redis.fromEnv();

await redis.lpush('extraction-queue', { documentId });
```

---

## 🔍 Monitoring

### Vercel Analytics

Vercel → **Analytics** (gratuit).

### Supabase Logs

Supabase → **Logs Explorer**.

### Logs structurés

```typescript
console.log(JSON.stringify({
  level: 'info',
  action: 'extraction',
  duration: 1523,
  documentId: id,
}));
```

---

## 🎯 Objectifs

| Métrique | Actuel | Cible 1 an |
|----------|--------|-----------|
| Documents | 56 | 5 000 |
| Utilisateurs | 5 | 50 |
| Temps réponse API | 200ms | 100ms |
| Uptime | 99.9% | 99.99% |

---

## 🚀 Plan d'action

### Phase 1 (< 1 000 documents)

- ✅ Free tier suffit
- Ajouter index
- Cache Next.js

### Phase 2 (1 000 - 10 000 documents)

- Upgrade Supabase Pro
- Upgrade Groq Pro
- Queue Redis

### Phase 3 (> 10 000 documents)

- Upgrade Vercel Pro
- Multi-région
- CDN pour les assets

---

## 🔗 Liens

- [Vercel Scaling](https://vercel.com/docs/scaling)
- [Supabase Scaling](https://supabase.com/docs/guides/platform/scaling)
- [Groq Rate Limits](https://console.groq.com/docs/rate-limits)