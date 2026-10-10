# 🔄 Data Flow

Flux de données dans le système.

---

## 📥 Arrivée d'un document

### Cas 1 : Upload manuel

```
Utilisateur
    │  POST /api/documents/upload (multipart)
    ▼
Next.js API Route
    │
    ├─► Calcul hash SHA256
    │
    ├─► Vérification doublon (documents.content_hash)
    │   └─► Si doublon  →  409
    │
    ├─► Upload Storage
    │   └─► Supabase Storage (bucket "documents")
    │
    └─► Insert DB
        └─► documents (status = 'received')
        │
        └─► Si mode = 'auto'  →  Trigger extract
```

### Cas 2 : Email entrant

```
Client envoie email
    │  invoice@xxx.resend.app
    ▼
Resend (webhook)
    │  POST /api/inbound-email
    ▼
Next.js API Route
    │
    ├─► Vérification signature (whsec_...)
    │
    ├─► Extraction des pièces jointes
    │
    └─► Insert DB (status = 'received')
        │
        └─► Trigger extract
```

---

## 🤖 Pipeline d'extraction IA

```
Document (status = 'received')
    │
    ▼
┌──────────────────────────────────────┐
│  1. TÉLÉCHARGEMENT                   │
│     Supabase Storage → Buffer        │
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│  2. EXTRACTION TEXTE                 │
│     • PDF      →  unpdf              │
│     • Image    →  tesseract.js       │
│     • Excel    →  xlsx               │
│     • CSV      →  csv-parse          │
│     • Word     →  mammoth            │
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│  3. ANALYSE IA (Groq)                │
│     Prompt structuré demandant :     │
│     • type (invoice, quote, ...)     │
│     • extracted_fields               │
│     • confidence (0-100)             │
│     • warnings                       │
│     • suggestions                    │
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│  4. PARSING + VALIDATION             │
│     • Vérifier structure JSON        │
│     • Extraire score                 │
│     • Détecter champs manquants      │
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│  5. DÉTECTION DOUBLONS               │
│     • invoice_number match           │
│     • OU supplier + amount + date    │
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│  6. DÉCISION                         │
│     • Score >= seuil  → auto_approved│
│     • Score < seuil   → exception    │
│     • Doublon         → exception    │
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│  7. SAUVEGARDE                       │
│     • INSERT extractions             │
│     • UPDATE documents.status        │
│     • INSERT exceptions (si besoin)  │
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│  8. RÉSUMÉ IA                        │
│     POST /api/documents/[id]/summarize│
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│  9. NOTIFICATION                     │
│     Email si exception créée         │
└──────────────────────────────────────┘
```

---

## 👤 Workflow humain (exceptions)

```
Exception créée
    │
    ▼
Utilisateur va sur /dashboard/exceptions
    │
    ├─► Voir le document + score + raison
    │
    ├─► Approuver      →  status = 'approved'
    ├─► Rejeter        →  status = 'rejected'
    ├─► Éditer champs  →  UPDATE extractions
    └─► Reprocesser    →  DELETE + re-extract
    │
    ▼
Livraison
    │
    └─► "Marquer comme livré"  →  status = 'delivered'
```

---

## ⏰ Cron jobs

### Rapport automatique

```
Vercel Cron (7h UTC)
    │  GET /api/cron/send-report
    ▼
Vérifications :
    • Authorization: Bearer CRON_SECRET
    • cron_enabled === 'true'
    • Heure UTC ±1h
    • Bon jour (weekly/monthly)
    • Pas déjà envoyé (12h)
    │
    ▼
Génération PDF :
    • 50 derniers documents
    • Total général
    • Mise en page PDF (pdf-lib)
    │
    ▼
Envoi email (Resend)
    │
    ▼
UPDATE settings.cron_last_run
```

### Relances automatiques

```
Vercel Cron (8h UTC)
    │  GET /api/cron/send-reminders
    ▼
Vérifications :
    • reminder_enabled === 'true'
    • Heure UTC ±1h
    │
    ▼
Sélection exceptions :
    • status = 'open'
    • created_at < NOW() - reminder_days
    • reminder_count < max_count
    │
    ▼
Pour chaque exception :
    • Envoyer email de relance
    • UPDATE exceptions.reminder_count++
    │
    ▼
UPDATE settings.reminder_last_run
```

---

## 📊 Lecture des données (Dashboard)

```
Utilisateur ouvre /dashboard
    │
    ▼
Server Component
    │
    ├─► GET /api/dashboard/stats
    ├─► GET /api/dashboard/confidence-stats
    │
    ▼
Client Component (DashboardStats)
    │
    ├─► Fetch les APIs
    ├─► Agrégation locale
    └─► Rendu avec Recharts
```

---

## 🔐 Authentification

```
Utilisateur → /login
    │
    ▼
Supabase Auth (email + password)
    │
    ▼
Cookie de session (httpOnly)
    │
    ▼
Middleware vérifie à chaque requête
    │
    ├─► Si non connecté + route protégée  →  /login
    ├─► Si connecté + /login              →  /dashboard
    └─► Si admin requis + rôle !== admin  →  /dashboard?error=forbidden
```

---

## 🗂️ Storage

```
Supabase Storage (bucket "documents")
    │
    ├─► Path : {timestamp}_{filename}
    │
    └─► Accès : URL signée (1h)
        └─► Générée à la demande via createSignedUrl
```

---

## 🔗 Liens

- [Overview](./overview.md)
- [Security](./security.md)