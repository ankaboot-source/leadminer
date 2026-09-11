-- Single writer for private.mining_sources.config.
--
-- The mining-sources edge function now owns every config write: it reads the
-- current config, merges the caller's params in JS (preserving unknown keys,
-- monotonic per-folder cursors), and persists with an optimistic
-- compare-and-swap on `config_revision`. The bespoke SQL merge functions are
-- removed so there is exactly one merge implementation.

ALTER TABLE private.mining_sources
  ADD COLUMN IF NOT EXISTS config_revision integer NOT NULL DEFAULT 0;

-- Drop in dependency order (update_mining_source_config calls jsonb_deep_merge).
DROP FUNCTION IF EXISTS private.update_mining_source_config(uuid, jsonb);
DROP FUNCTION IF EXISTS private.jsonb_deep_merge(jsonb, jsonb);

COMMENT ON COLUMN private.mining_sources.config_revision IS
  'Optimistic concurrency token. Incremented by the mining-sources edge function on every config write.';
