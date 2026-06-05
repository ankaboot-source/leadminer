CREATE OR REPLACE FUNCTION private.create_smtp_sender_for_oauth(
  _user_id UUID,
  _email TEXT,
  _provider TEXT,
  _oauth_refresh_token TEXT,
  _mining_source_id UUID,
  _encryption_key TEXT
) RETURNS void
SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
  _smtp_host TEXT;
  _smtp_port INT := 587;
  _smtp_encryption TEXT := 'starttls';
  _oauth_provider TEXT;
BEGIN
  IF _provider NOT IN ('google', 'azure') THEN
    RAISE EXCEPTION 'Invalid OAuth provider: %', _provider;
  END IF;

  IF _provider = 'google' THEN
    _smtp_host := 'smtp.gmail.com';
    _oauth_provider := 'google';
  ELSE
    _smtp_host := 'smtp-mail.outlook.com';
    _oauth_provider := 'azure';
  END IF;

  INSERT INTO private.smtp_senders
    (user_id, name, email, smtp_host, smtp_port, smtp_encryption,
     smtp_user, smtp_password, auth_type, oauth_provider, oauth_refresh_token, mining_source_id)
  VALUES
    (_user_id, _email, _email, _smtp_host, _smtp_port, _smtp_encryption,
     _email, extensions.pgp_sym_encrypt('', _encryption_key), 'oauth', _oauth_provider,
     extensions.pgp_sym_encrypt(_oauth_refresh_token, _encryption_key), _mining_source_id)
  ON CONFLICT (user_id, email)
  DO UPDATE SET
    smtp_host = EXCLUDED.smtp_host,
    smtp_port = EXCLUDED.smtp_port,
    smtp_encryption = EXCLUDED.smtp_encryption,
    auth_type = EXCLUDED.auth_type,
    oauth_provider = EXCLUDED.oauth_provider,
    oauth_refresh_token = EXCLUDED.oauth_refresh_token,
    mining_source_id = EXCLUDED.mining_source_id,
    updated_at = now();
END;
$$;
