-- Passive mining incremental config.
--
-- Single source of truth for the mining_sources config store:
--   1. `config` holds the typed V1 shape
--      { version, flags, folders, health, mining.last.folders[].{uidvalidity,last_uid,updated_at} }.
--   2. `config_revision` is the optimistic concurrency token used by the
--      mining-sources edge function (read-merge compare-and-swap write). The
--      edge function is the ONLY writer.
--   3. `get_mining_source_credentials_for_user` also returns `config` so callers
--      that need the persisted watermark (IMAP boxes, resume resolution) can
--      read it.
--   4. The intermediate SQL merge helpers are removed (superseded by the edge
--      function's JS merge).

ALTER TABLE private.mining_sources
  ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb;

ALTER TABLE private.mining_sources
  ADD COLUMN IF NOT EXISTS config_revision integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN private.mining_sources.config IS
  'Typed per-source configuration (V1). Shape: { version:1, flags?:{cleaning_enabled,extract_signatures,google_contacts_sync}, folders?:string[], health?:{state,last_error,last_run_at}, mining?:{last:{mining_id,mined_count,folders_mined,updated_at,folders:{<folder>:{uidvalidity,last_uid,updated_at}}}} }. Written only by the mining-sources edge function.';

COMMENT ON COLUMN private.mining_sources.config_revision IS
  'Optimistic concurrency token. Incremented by the mining-sources edge function on every config write.';

DROP FUNCTION IF EXISTS private.get_mining_source_credentials_for_user(uuid, text);

CREATE FUNCTION private.get_mining_source_credentials_for_user(
  _user_id UUID,
  _encryption_key TEXT
)
RETURNS TABLE(
  id UUID,
  email TEXT,
  type TEXT,
  credentials JSONB,
  config JSONB
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
    extensions.pgp_sym_decrypt(ms.credentials, _encryption_key)::JSONB AS credentials,
    ms.config
  FROM private.mining_sources ms
  WHERE ms.user_id = _user_id;
END;
$$;

REVOKE ALL ON FUNCTION private.get_mining_source_credentials_for_user(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION private.get_mining_source_credentials_for_user(uuid, text) TO service_role;

-- Superseded by the mining-sources edge function (supabase-js read-merge-CAS).
DROP FUNCTION IF EXISTS private.update_mining_source_config(uuid, jsonb);
DROP FUNCTION IF EXISTS private.jsonb_deep_merge(jsonb, jsonb);