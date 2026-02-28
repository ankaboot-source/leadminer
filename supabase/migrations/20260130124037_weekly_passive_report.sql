
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

-- Retrieves passive mining IDs for users who completed passive mining tasks within a specified date range.
-- Parameters:
--   week_start (date): The start date of the week for which to retrieve mining IDs.
--   week_end (date): The end date of the week for which to retrieve mining IDs.
-- Returns:
--   A table with columns:
--     user_id (uuid): The ID of the user who completed the passive mining task.
--     mining_id (text): The ID of the mining task.
-- Security:
-- Should not be accessible to public, anonymous, or authenticated users.
create or replace function private.get_passive_mining_ids(
  week_start date,
  week_end date
)
returns table (user_id uuid, mining_id text)
language sql
security definer
as $$
  select t.user_id, t.details->>'miningId' as mining_id
  from private.mining_sources ms
  join private.tasks t
    on t.user_id = ms.user_id
  where ms.passive_mining = true
    and t.type = 'fetch'
    and t.status = 'done'
    and t.details->>'passive_mining' = 'true'
    and t.stopped_at >= week_start
    and t.stopped_at < week_end;
$$;

-- Revoke execution from public, anon, authenticated
REVOKE EXECUTE ON FUNCTION private.get_passive_mining_ids(date, date) from public, anon, authenticated;