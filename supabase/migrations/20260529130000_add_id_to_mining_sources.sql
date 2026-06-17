-- Add surrogate id to private.mining_sources BEFORE the smtp_senders FK.
--
-- Migration 20260605155137 also does this, but 20260530120000_add_smtp_senders
-- REFERENCES private.mining_sources(id) — the column must exist BEFORE that
-- migration runs. This prereq migration ensures the column is present in time.
-- The later migration (20260605155137) is idempotent (IF NOT EXISTS guards)
-- and becomes a harmless no-op on fresh environments.

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
