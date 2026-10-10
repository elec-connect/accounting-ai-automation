# 📕 Runbooks

Procédures pour incidents et maintenance.

## Incidents courants

### 1. Extraction IA en échec

**Symptômes** : Les documents restent en `received`.

**Diagnostic** :
```sql
SELECT id, original_filename, status
FROM documents
WHERE status = 'received'
  AND created_at > NOW() - INTERVAL '1 hour';