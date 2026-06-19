ALTER TABLE private.mining_sources
  ADD COLUMN config JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN private.mining_sources.config IS
  'Per-source configuration flags stored as JSONB, e.g. {"google_contacts_sync": true, "cleaning_enabled": true, "extract_signatures": false}';
