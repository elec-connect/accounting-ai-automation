# 💾 Backup & Restore

Procédure de sauvegarde et restauration.

---

## 📊 Fréquence des backups

| Type | Fréquence | Rétention |
|------|-----------|-----------|
| Automatique (Supabase) | Quotidien | 7 jours |
| Manuel | Hebdomadaire | 30 jours |
| Avant migration | Ad-hoc | Illimité |

---

## 💾 Backup manuel

### Supabase CLI

```bash
# 1. Installer
npm install -g supabase

# 2. Se connecter
supabase login

# 3. Backup
supabase db dump -f backup-$(Get-Date -Format "yyyy-MM-dd").sql
```

### pg_dump

```bash
pg_dump "postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres" \
  > backup.sql
```

### Backup de Storage

```bash
# List files
supabase storage ls documents

# Download
supabase storage download documents/[path] > file.pdf
```

---

## 🔄 Restore

### ⚠️ ATTENTION

**Le restore va écraser les données actuelles.**

**Étapes** :

1. **Créer un backup de sécurité** avant :

```bash
supabase db dump -f backup-before-restore.sql
```

2. **Restore** :

```bash
# Reset complet
supabase db reset

# Restaurer
psql -h db.xxx.supabase.co -U postgres -f backup.sql
```

3. **Vérifier** :

```sql
SELECT COUNT(*) FROM documents;
SELECT COUNT(*) FROM extractions;
SELECT COUNT(*) FROM exceptions;
```

---

## 🎯 Restore sélectif

### Restaurer une seule table

```bash
# Extraire la table
pg_dump -t documents "postgresql://..." > documents-backup.sql

# Restaurer
psql -h db.xxx.supabase.co -U postgres -f documents-backup.sql
```

### Restaurer une ligne

```sql
INSERT INTO documents (
  id, type, status, storage_path, ...
)
VALUES (
  'xxx', 'invoice', 'approved', 'xxx', ...
);
```

---

## 🔐 Chiffrement

### Backup chiffré

```bash
pg_dump "postgresql://..." | gpg -c > backup.sql.gpg
```

### Déchiffrer

```bash
gpg -d backup.sql.gpg | psql -h db.xxx.supabase.co -U postgres
```

---

## ☁️ Backup vers cloud

### AWS S3

```bash
pg_dump "postgresql://..." | aws s3 cp - s3://my-bucket/backup.sql
```

### Google Drive

```bash
pg_dump "postgresql://..." > backup.sql
rclone copy backup.sql gdrive:backups/
```

---

## 🧪 Test de restore

**Important** : tester régulièrement le restore.

### Procédure

1. **Créer une DB de test** sur Supabase
2. **Restaurer** le backup
3. **Vérifier** les données
4. **Supprimer** la DB de test

---

## 📅 Calendrier

| Jour | Action |
|------|--------|
| Lundi | Backup automatique |
| Mercredi | Backup manuel |
| Vendredi | Vérifier backup |
| 1er du mois | Test de restore |
| Avant migration | Backup ad-hoc |

---

## 🚨 En cas de perte de données

1. **Arrêter** les écritures (maintenance)
2. **Identifier** la dernière version saine
3. **Restaurer** le backup
4. **Vérifier** les données
5. **Redémarrer** l'app
6. **Post-mortem**

---

## 🔗 Liens

- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [pg_dump docs](https://www.postgresql.org/docs/current/app-pgdump.html)