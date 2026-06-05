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

-- CREATE INDEX / CREATE POLICY / ENABLE RLS on an existing table require
-- ownership. On QA the table may have been pre-applied by a role that
-- doesn't match the migration runner, so these no-op cleanly when we lack
-- privilege. Whoever pre-applied the table is responsible for the
-- index / RLS / policy.
DO $$
BEGIN
  CREATE INDEX idx_smtp_senders_user_id ON private.smtp_senders(user_id);
EXCEPTION WHEN insufficient_privilege OR duplicate_table THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'ALTER TABLE private.smtp_senders ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can manage own smtp_senders" ON private.smtp_senders';
  EXECUTE 'CREATE POLICY "Users can manage own smtp_senders" ON private.smtp_senders USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
EXCEPTION WHEN insufficient_privilege OR duplicate_object THEN NULL;
END $$;
