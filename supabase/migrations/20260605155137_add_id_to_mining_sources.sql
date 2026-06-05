-- Add surrogate id to private.mining_sources
--
-- The mining_sources table has been operating with a composite primary key
-- (email, user_id) since init, but multiple code paths now require a stable
-- per-row UUID:
--
--   1. backend/src/db/pg/PgMiningSources.ts (UPSERT_SQL) — uses RETURNING id
--   2. supabase/functions/mining-sources/index.ts (callback) — uses select("id")
--   3. private.smtp_senders.mining_source_id — REFERENCES private.mining_sources(id)
--   4. private.create_smtp_sender_for_oauth — takes _mining_source_id UUID
--
-- Production already has this column (the backend's RETURNING id has been
-- working there), but the migration history in this repo never added it,
-- leaving local and QA environments in a broken state. The new edge
-- function logs the warning:
--   "Failed to get mining source ID for SMTP twin"
--   "column mining_sources.id does not exist"
-- and silently skips SMTP twin creation after OAuth callback.
--
-- This migration is idempotent: it adds the column only if it doesn't
-- already exist, so it's safe to run on production (no-op) and on
-- QA/local (adds the column).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'private'
      AND table_name = 'mining_sources'
      AND column_name = 'id'
  ) THEN
    ALTER TABLE private.mining_sources
      ADD COLUMN id UUID DEFAULT gen_random_uuid() NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'private.mining_sources'::regclass
      AND contype = 'u'
      AND conname = 'mining_sources_id_key'
  ) THEN
    ALTER TABLE private.mining_sources
      ADD CONSTRAINT mining_sources_id_key UNIQUE (id);
  END IF;
END $$;
