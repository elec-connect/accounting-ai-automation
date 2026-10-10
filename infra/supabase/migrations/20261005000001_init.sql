-- ═══════════════════════════════════════════════════════════════
--  INITIALISATION — Extensions
-- ═══════════════════════════════════════════════════════════════

-- Extension pour les UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Extension pour les vecteurs (embeddings)
CREATE EXTENSION IF NOT EXISTS "vector";