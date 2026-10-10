# 🔌 API Endpoints

Documentation des endpoints de l'API.

**Base URL** : `/api`

---

## 📄 Documents

### `POST /api/documents/upload`

Upload manuel d'un document.

**Body** : `multipart/form-data`
- `file` (File) : Le fichier à uploader

**Réponse** :
```json
{
  "success": true,
  "document": { "id": "...", "status": "received" },
  "message": "Document uploadé avec succès.",
  "pipelineMode": "auto",
  "extractionTriggered": true
}
```

**Erreurs** :
- `400` : Aucun fichier
- `409` : Doublon détecté
- `500` : Erreur serveur

---

### `POST /api/documents/[id]/extract`

Extraction IA du contenu (texte + score + type).

**Réponse** :
```json
{
  "success": true,
  "extraction": {...},
  "confidence": 85,
  "status": "exception",
  "type": "invoice",
  "exceptionCreated": true,
  "summary": "..."
}
```

---

### `POST /api/documents/[id]/summarize`

Génère un résumé IA du document.

**Réponse** :
```json
{
  "success": true,
  "summary": "Facture n° ... du ...",
  "model": "openai/gpt-oss-120b"
}
```

---

### `POST /api/documents/[id]/process`

Pipeline complet en mode manuel (extract + summarize).

**Réponse** : identique à `/extract`

---

### `POST /api/documents/[id]/reprocess`

Relance complète : supprime extraction + exceptions, puis refait tout.

**Réponse** :
```json
{ "success": true, "message": "Reprocessing started" }
```

---

### `POST /api/documents/[id]/status`

Change le statut d'un document.

**Body** :
```json
{
  "action": "approve" | "reject" | "deliver" | "reset",
  "reason": "...",         // requis si action = "reject"
  "delivered_to": "..."    // optionnel
}
```

**Réponse** :
```json
{ "success": true, "document": {...} }
```

---

### `POST /api/documents/[id]/delete`

Supprime un document (DB + Storage).

**Réponse** :
```json
{ "success": true }
```

---

### `POST /api/documents/check-duplicate`

Vérifie si un document existe déjà.

**Body** :
```json
{
  "invoice_number": "FAC-2026-0044",
  "supplier_name": "Elec-Connect1",
  "total_amount_ttc": 599.00,
  "invoice_date": "2026-09-19",
  "exclude_id": "..."
}
```

**Réponse** :
```json
{
  "duplicate": true,
  "matches": [{ "id": "...", "original_filename": "..." }]
}
```

---

### `POST /api/documents/advanced-search`

Recherche multi-critères.

**Body** :
```json
{
  "supplier": "Elec-Connect",
  "amountMin": 100,
  "amountMax": 1000,
  "dateFrom": "2026-01-01",
  "dateTo": "2026-12-31",
  "type": "invoice",
  "status": "approved"
}
```

**Réponse** :
```json
{ "results": [...], "count": 5 }
```

---

### `GET /api/documents/export-csv`

Export CSV de tous les documents.

**Réponse** : fichier CSV (UTF-8 BOM)

---

### `GET /api/documents/export-pdf`

Export PDF de la liste des documents.

**Réponse** : page HTML imprimable

---

### `GET /api/documents/report/excel`

Export Excel avec mise en forme.

**Réponse** : fichier XLSX

---

## 📊 Dashboard

### `GET /api/dashboard/stats`

Statistiques générales.

**Réponse** :
```json
{
  "totalDocuments": 56,
  "totalTtc": 1566576,
  "totalExtracted": 48,
  "totalPending": 6,
  "byStatus": {...},
  "topSuppliers": [...],
  "monthlyData": [...],
  "recentDocs": [...]
}
```

---

### `GET /api/dashboard/confidence-stats`

Distribution des scores de confiance.

**Réponse** :
```json
{
  "distribution": [
    { "range": "90-100", "count": 3 }
  ],
  "summary": {
    "total": 4,
    "avgScore": 76.3,
    "automationRate": 0,
    "exceptionRate": 50
  }
}
```

---

### `GET /api/dashboard/type-stats`

Statistiques par type de document.

---

## ⚙️ Settings

### `GET /api/settings`

Récupère tous les settings.

**Réponse** :
```json
{ "settings": { "email_from": "...", ... } }
```

---

### `POST /api/settings`

Met à jour les settings.

**Body** : objet `{ key: value }`

---

### `POST /api/settings/test`

Envoie un email de test.

---

### `GET /api/settings/health`

Vérifie l'état des variables d'environnement.

---

## ⏰ Cron

### `GET /api/cron/send-report`

Envoie le rapport par email (protégé par `CRON_SECRET`).

**Headers** : `Authorization: Bearer <CRON_SECRET>`

**Réponse** :
```json
{ "success": true, "recipient": "...", "documentsCount": 50 }
```

---

### `GET /api/cron/send-reminders`

Envoie les relances pour les exceptions ouvertes.

**Réponse** :
```json
{ "success": true, "sent": 3, "failed": 0, "total": 3 }
```

---

## 🛡️ Audit

### `GET /api/audit`

Récupère les logs d'audit (admin uniquement).

**Réponse** :
```json
{ "entries": [...] }
```

---

## 📈 Reports

### `GET /api/reports/stats`

Statistiques pour la page rapports.

**Réponse** :
```json
{
  "suppliers": [{ "supplier": "...", "total": 7998.1, "count": 22 }],
  "months": [{ "month": "2026-10", "total": 1566576 }]
}
```

---

## 📥 Inbound Email

### `POST /api/inbound-email`

Webhook Resend pour la réception d'emails.

**Headers** : `svix-signature` (signature Resend)

---

## 🔐 2FA

### `POST /api/auth/2fa/setup`

Initialise la 2FA (génère secret + QR code).

**Réponse** :
```json
{ "secret": "...", "qrCode": "data:image/png;base64,..." }
```

---

### `POST /api/auth/2fa/verify`

Vérifie le code 2FA et active.

**Body** : `{ "code": "123456" }`

**Réponse** :
```json
{ "success": true, "backupCodes": ["ABC123", ...] }
```

---

### `POST /api/auth/2fa/disable`

Désactive la 2FA.