CREATE TABLE IF NOT EXISTS private.smtp_senders (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
   name TEXT NOT NULL,
   email TEXT NOT NULL,
   smtp_host TEXT NOT NULL,
   smtp_port INT NOT NULL DEFAULT 587,
   smtp_encryption TEXT NOT NULL DEFAULT 'starttls' CHECK (smtp_encryption IN ('starttls', 'ssl', 'none')),
   smtp_user TEXT NOT NULL,
   smtp_password BYTEA,
   auth_type TEXT NOT NULL DEFAULT 'password' CHECK (auth_type IN ('password', 'oauth')),
   oauth_provider TEXT CHECK (oauth_provider IN ('google', 'azure')),
   oauth_refresh_token BYTEA,
   active BOOLEAN NOT NULL DEFAULT true,
   mining_source_id UUID REFERENCES private.mining_sources(id),
   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
   updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
   UNIQUE(user_id, email)
 );

CREATE INDEX idx_smtp_senders_user_id ON private.smtp_senders(user_id);

ALTER TABLE private.smtp_senders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own smtp_senders"
  ON private.smtp_senders
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Backfill smtp_senders for existing OAuth mining sources (Google / Azure).
-- The oauth_refresh_token is left NULL; the backend resolves the token from
-- the linked mining_sources row (via mining_source_email) at send time.
INSERT INTO private.smtp_senders (
  user_id,
  name,
  email,
  smtp_host,
  smtp_port,
  smtp_encryption,
  smtp_user,
  auth_type,
  oauth_provider,
  active,
  mining_source_email
)
SELECT
  ms.user_id,
  CASE
    WHEN ms.type = 'google' THEN 'Gmail (' || ms.email || ')'
    WHEN ms.type = 'azure'  THEN 'Outlook (' || ms.email || ')'
  END,
  ms.email,
  CASE
    WHEN ms.type = 'google' THEN 'smtp.gmail.com'
    WHEN ms.type = 'azure'  THEN 'smtp-mail.outlook.com'
  END,
  587,
  'starttls',
  ms.email,
  'oauth',
  ms.type,
  TRUE,
  ms.email
FROM private.mining_sources ms
WHERE ms.type IN ('google', 'azure')
ON CONFLICT (user_id, email) DO NOTHING;
