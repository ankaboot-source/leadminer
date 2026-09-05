-- Incremental passive mining: typed mining_sources.config + atomic config writer
--
-- 1. get_mining_source_credentials_for_user now ALSO returns `config` so
--    writers (fetch-mining-source, passive-mining, mining-sources) can merge
--    against the persisted row instead of an empty object (which previously
--    wiped every config key on each write).
-- 2. Adds an atomic, row-locked deep-merge writer: private.update_mining_source_config.
--    All mining_sources.config mutations should flow through this single RPC so
--    concurrent writers (reauth vs. passive completion vs. user config patch)
--    never lose keys.

ALTER TABLE private.mining_sources
  ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb;

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

COMMENT ON COLUMN private.mining_sources.config IS
  'Typed per-source configuration (V1). Shape: { version:1, flags?:{cleaning_enabled,extract_signatures,google_contacts_sync}, folders?:string[], health?:{state,last_error,last_run_at}, mining?:{last:{mining_id,mined_count,folders_mined,updated_at,folders:{<folder>:{uidvalidity,last_uid,updated_at}}}} }. Use private.update_mining_source_config() to mutate atomically.';

CREATE OR REPLACE FUNCTION private.jsonb_deep_merge(target JSONB, patch JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  result JSONB := COALESCE(target, '{}'::jsonb);
  key TEXT;
  target_value JSONB;
  patch_value JSONB;
BEGIN
  IF patch IS NULL THEN
    RETURN result;
  END IF;

  IF jsonb_typeof(patch) <> 'object' THEN
    RETURN patch;
  END IF;

  FOR key IN SELECT jsonb_object_keys(patch) LOOP
    patch_value := patch -> key;

    IF jsonb_typeof(patch_value) = 'null' THEN
      -- explicit JSON null clears the key
      result := result - key;
    ELSIF jsonb_typeof(patch_value) = 'object' THEN
      target_value := result -> key;
      result := jsonb_set(
        result,
        ARRAY[key],
        private.jsonb_deep_merge(target_value, patch_value),
        true
      );
    ELSE
      result := jsonb_set(result, ARRAY[key], patch_value, true);
    END IF;
  END LOOP;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION private.update_mining_source_config(
  p_id UUID,
  p_patch JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_config JSONB;
  new_config JSONB;
BEGIN
  SELECT config INTO current_config
  FROM private.mining_sources
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'mining source % not found', p_id;
  END IF;

  new_config := private.jsonb_deep_merge(current_config, p_patch);

  UPDATE private.mining_sources SET config = new_config WHERE id = p_id;

  RETURN new_config;
END;
$$;

REVOKE ALL ON FUNCTION private.update_mining_source_config(UUID, JSONB) FROM public;
REVOKE ALL ON FUNCTION private.jsonb_deep_merge(JSONB, JSONB) FROM public;
GRANT EXECUTE ON FUNCTION private.update_mining_source_config(UUID, JSONB) TO service_role;