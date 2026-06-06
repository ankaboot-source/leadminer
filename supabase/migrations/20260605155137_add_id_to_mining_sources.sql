-- Add surrogate id to private.mining_sources
--
-- The mining_sources table has been operating with a composite primary key
-- (email, user_id) since init, but several code paths assume a stable
-- per-row UUID column called `id`:
--
--   - supabase/functions/mining-sources/index.ts: select("id") on the
--     callback to look up the source before creating the SMTP twin
--   - private.smtp_senders.mining_source_id: REFERENCES private.mining_sources(id)
--   - private.create_smtp_sender_for_oauth: takes _mining_source_id UUID
--
-- The column was never created, so the callback flow logs:
--   "Failed to get mining source ID for SMTP twin"
--   "column mining_sources.id does not exist"
-- and silently skips SMTP twin creation.
--
-- This migration is idempotent (uses IF NOT EXISTS guards) so it is safe
-- to run on environments that already have the column.

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
