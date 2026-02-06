-- ============================================================================
-- REQUIRED SETUP
-- ============================================================================
-- This cron job calls a Supabase Edge Function via authenticated HTTP.
-- It WILL FAIL if the required Vault secrets are missing.
--
-- Required Vault secrets:
--
-- 1. project_url
--    Supabase project base URL (e.g. https://project-ref.supabase.co)
--    select vault.create_secret('https://project-ref.supabase.co', 'project_url');
--
-- 2. service_role_key
--    Supabase SERVICE ROLE key (NOT anon / publishable)
--    select vault.create_secret('YOUR_SUPABASE_SERVICE_ROLE_KEY', 'service_role_key');
--

-- PRE-FLIGHT CHECK (FAIL MIGRATION IF REQUIRED SECRETS ARE MISSING)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'project_url'
  ) THEN
    RAISE EXCEPTION
      'Missing Vault secret: project_url. Create it before running this migration.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
  ) THEN
    RAISE EXCEPTION
      'Missing Vault secret: service_role_key. Create it before running this migration.';
  END IF;
END
$$;

-- CRON JOB REGISTRATION
SELECT cron.schedule(
  'weekly-passive-mining-reports',
  '0 9 * * 1',
  $$
  SELECT
    net.http_post(
      url:= (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/mail/send-weekly-passive-mining-reports',
      headers:=jsonb_build_object(
        'Content-type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
      ),
      body:=jsonb_build_object(
        'weekStart', (CURRENT_DATE - INTERVAL '7 days')::TEXT
      )
    ) as request_id;
  $$
);

COMMENT ON JOB 'weekly-passive-mining-reports' IS 
'Weekly passive mining email reports. Runs every Monday at 9 AM UTC.
Invokes the edge function which handles all logic: queries mining_sources with passive_mining=true,
fetches mining IDs from tasks, aggregates stats, and sends emails.';
