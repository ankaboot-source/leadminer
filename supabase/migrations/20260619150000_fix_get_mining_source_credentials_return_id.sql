-- Fix: get_mining_source_credentials_for_user must return id column
--
-- The original function was created in 20260214130000_add_email_campaigns.sql,
-- before the `id` column existed on private.mining_sources. When
-- 20260529130000_add_id_to_mining_sources.sql added the column, the RPC was
-- never re-created to include ms.id in its SELECT.
--
-- Without the id column in the result, fetch-mining-source edge function's
-- filterById(sources, idFilter) compares `undefined === idFilter` for every
-- source, always filtering out all results. This causes the backend to return
-- "This mining source isn't registered for this user" when looking up a
-- source by UUID.
--
-- Since CREATE OR REPLACE cannot change the RETURNS TABLE signature, we must
-- DROP and recreate.

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
