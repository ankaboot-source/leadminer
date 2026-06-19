ALTER TABLE private.mining_sources
  ADD COLUMN config JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN private.mining_sources.config IS
  'Per-source configuration flags stored as JSONB, e.g. {"google_contacts_sync": true, "cleaning_enabled": true, "extract_signatures": false}';

-- Fix: get_mining_source_credentials_for_user must return id column.
-- The function was originally created before `id` column existed.
-- CREATE OR REPLACE cannot change RETURNS TABLE, so we DROP and recreate.
DROP FUNCTION IF EXISTS private.get_mining_source_credentials_for_user(uuid, text);

CREATE FUNCTION private.get_mining_source_credentials_for_user(
  _user_id UUID,
  _encryption_key TEXT
)
RETURNS TABLE(
  id UUID,
  email TEXT,
  type TEXT,
  credentials JSONB
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ms.id,
    ms.email,
    ms.type::TEXT,
    extensions.pgp_sym_decrypt(ms.credentials, _encryption_key)::JSONB AS credentials
  FROM private.mining_sources ms
  WHERE ms.user_id = _user_id;
END;
$$;
