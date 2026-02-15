CREATE OR REPLACE FUNCTION private.get_user_mining_source_credentials(_encryption_key TEXT)
RETURNS TABLE(
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
    ms.email,
    ms.type::TEXT,
    extensions.pgp_sym_decrypt(ms.credentials, _encryption_key)::JSONB AS credentials
  FROM private.mining_sources ms
  WHERE ms.user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION private.get_mining_source_credentials_for_user(_user_id UUID, _encryption_key TEXT)
RETURNS TABLE(
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
    ms.email,
    ms.type::TEXT,
    extensions.pgp_sym_decrypt(ms.credentials, _encryption_key)::JSONB AS credentials
  FROM private.mining_sources ms
  WHERE ms.user_id = _user_id;
END;
$$;
