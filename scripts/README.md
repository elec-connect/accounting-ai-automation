# 🔧 Scripts

Scripts utilitaires pour le développement, le test et la maintenance.

---

## 📋 Liste des scripts

| Script | Description | Commande |
|--------|-------------|----------|
| `seed-db.ts` | Remplir la DB avec des données de test | `pnpm tsx scripts/seed-db.ts` |
| `reset-db.ts` | Réinitialiser complètement la DB | `pnpm tsx scripts/reset-db.ts` |
| `export-data.ts` | Exporter les données en JSON | `pnpm tsx scripts/export-data.ts` |
| `import-data.ts` | Importer des données depuis JSON | `pnpm tsx scripts/import-data.ts` |
| `generate-embeddings.ts` | Générer les embeddings RAG | `pnpm tsx scripts/generate-embeddings.ts` |
| `cleanup-logs.ts` | Nettoyer les vieux logs d'audit | `pnpm tsx scripts/cleanup-logs.ts` |

---

## 🚀 Utilisation

### Prérequis

```bash
# À la racine du projet
cd C:\Projects\accounting-ai-automation

# Installer les dépendances
pnpm install

# Configurer .env.local
cp .env.example .env.local
```

### Lancer un script

```bash
# Depuis la racine
pnpm tsx scripts/seed-db.ts

# Ou depuis apps/web
cd apps/web
pnpm tsx ../../scripts/seed-db.ts
```

---

## 📝 Description des scripts

### `seed-db.ts`

Remplit la base de données avec des **données de test** :

- 5 utilisateurs (admin, accountants, viewers)
- 20 documents variés (factures, devis, bons de livraison)
- 15 extractions
- 5 exceptions
- Settings par défaut

**Utile pour** : tester l'app en développement.

---

### `reset-db.ts`

⚠️ **ATTENTION** — Supprime **TOUTES** les données :

- `documents`
- `extractions`
- `exceptions`
- `audit_log`
- `settings` (sauf les clés de base)

**Utile pour** : repartir de zéro.

---

### `export-data.ts`

Exporte toutes les données dans un fichier `backup-YYYY-MM-DD.json`.

```json
{
  "exported_at": "2026-10-10T...",
  "documents": [...],
  "extractions": [...],
  "exceptions": [...],
  "settings": [...]
}
```

**Utile pour** : sauvegarde avant modification.

---

### `import-data.ts`

Importe les données depuis un fichier JSON.

```bash
pnpm tsx scripts/import-data.ts backup-2026-10-10.json
```

**Utile pour** : restaurer une sauvegarde.

---

### `generate-embeddings.ts`

Génère les embeddings vectoriels pour la recherche sémantique (RAG).

- Lit tous les documents avec `raw_text`
- Utilise OpenAI ou un modèle local
- Insère dans `document_embeddings`

**Utile pour** : activer la recherche par similarité.

---

### `cleanup-logs.ts`

Nettoie les logs d'audit plus vieux que **90 jours**.

```sql
DELETE FROM audit_log
WHERE created_at < NOW() - INTERVAL '90 days';
```

**Utile pour** : maintenir la DB légère.

---

## 🔐 Variables d'environnement

Les scripts utilisent les mêmes variables que l'app :

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé admin (bypass RLS) |
| `GROQ_API_KEY` | Clé Groq (pour les embeddings) |

⚠️ Ces scripts utilisent le **client admin** → bypass RLS.

---

## 🧪 Tests

Les scripts peuvent être testés :

```bash
# Créer une DB de test
pnpm tsx scripts/reset-db.ts
pnpm tsx scripts/seed-db.ts

# Vérifier les données
pnpm tsx scripts/export-data.ts
cat backup-*.json | head -50
```

---

## 🚨 Bonnes pratiques

1. **Toujours faire un backup** avant `reset-db` :
   ```bash
   pnpm tsx scripts/export-data.ts
   ```

2. **Ne jamais lancer en production** sans vérifier :
   - `SUPABASE_SERVICE_ROLE_KEY` pointe vers la bonne DB
   - Les scripts sont en mode "dry-run" si possible

3. **Utiliser `--dry-run`** quand disponible :
   ```bash
   pnpm tsx scripts/cleanup-logs.ts --dry-run
   ```

---

## 📁 Structure

```
scripts/
├── README.md             # Ce fichier
├── seed-db.ts            # Données de test
├── reset-db.ts           # Réinitialisation
├── export-data.ts        # Export JSON
├── import-data.ts        # Import JSON
├── generate-embeddings.ts # Embeddings RAG
├── cleanup-logs.ts       # Nettoyage logs
└── lib/                  # Utilitaires partagés
    ├── supabase-admin.ts
    └── logger.ts
```