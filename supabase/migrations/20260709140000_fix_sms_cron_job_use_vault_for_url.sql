-- Fix SMS campaign processor trigger to read project_url from vault
--
-- The previous version read project_url from
--   current_setting('app.settings.supabase_url', true)
-- which returns NULL when the function runs inside the pg_cron context
-- (app.settings is not configured there). When URL was NULL the function
-- silently RETURNed with no log and no error, so the trigger appeared to
-- succeed in cron.job but never actually invoked the edge function — that
-- is why no SMS campaigns ever fired.
--
-- This migration reads BOTH project_url and service_role_key from
-- vault.decrypted_secrets and RAISEs on missing secrets (fail-fast) so any
-- future vault misconfiguration is visible in the postgres log.

CREATE OR REPLACE FUNCTION private.trigger_sms_campaign_processor()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    supabase_url TEXT;
    service_role_key TEXT;
    request_id BIGINT;
BEGIN
    SELECT decrypted_secret
    INTO supabase_url
    FROM vault.decrypted_secrets
    WHERE name = 'project_url'
    LIMIT 1;

    SELECT decrypted_secret
    INTO service_role_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;

    IF supabase_url IS NULL THEN
        RAISE EXCEPTION 'supabase_url secret not found';
    END IF;

    IF service_role_key IS NULL THEN
        RAISE EXCEPTION 'service_role_key secret not found';
    END IF;

    SELECT net.http_post(
        url := supabase_url || '/functions/v1/sms-campaigns-process/process',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || service_role_key,
            'apikey', service_role_key
        ),
        body := '{}'::jsonb
    )
    INTO request_id;

    RAISE NOTICE 'Queued request: %', request_id;
END;
$$;
