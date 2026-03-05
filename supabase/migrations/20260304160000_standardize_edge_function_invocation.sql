-- Standardize edge function invocation using vault.decrypted_secrets
-- Fixes missing service_role_key in auth headers

-- ============================================================================
-- 1. Fix private.invoke_edge_function to retrieve from vault and include auth headers
-- ============================================================================
CREATE OR REPLACE FUNCTION private.invoke_edge_function(
    edge_function_name TEXT,
    body JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    project_url TEXT;
    service_role_key TEXT;
    response JSONB;
BEGIN
    -- Get credentials from vault
    SELECT decrypted_secret INTO project_url
    FROM vault.decrypted_secrets
    WHERE name = 'project_url';

    SELECT decrypted_secret INTO service_role_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key';

    IF project_url IS NULL OR service_role_key IS NULL THEN
        RAISE EXCEPTION 'Missing vault secrets: project_url or service_role_key';
    END IF;

    response := net.http_post(
        url := project_url || '/functions/v1/' || edge_function_name,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || service_role_key,
            'apikey', service_role_key
        ),
        body := body
    );

    RETURN response;
END;
$$;

-- ============================================================================
-- 2. Refactor trigger_email_campaign_processor to use private.invoke_edge_function
-- ============================================================================

CREATE OR REPLACE FUNCTION private.trigger_email_campaign_processor()
RETURNS VOID
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    PERFORM private.invoke_edge_function('email-campaigns/campaigns/process');
END;
$$;

-- ============================================================================
-- 3. Refactor weekly passive report to use private.invoke_edge_function
-- ============================================================================

-- Unschedule the old cron job
DO $do$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM cron.job
        WHERE jobname = 'weekly-passive-mining-reports'
    ) THEN
        PERFORM cron.unschedule('weekly-passive-mining-reports');
    END IF;
END
$do$;

-- Reschedule with new implementation using private.invoke_edge_function
SELECT cron.schedule(
    'weekly-passive-mining-reports',
    '0 9 * * 1', -- Monday at 9:00 AM
    $$
    SELECT private.invoke_edge_function(
        'mail/send-weekly-passive-mining-reports',
        jsonb_build_object('weekStart', (CURRENT_DATE - INTERVAL '7 days')::TEXT)
    );
    $$
);

-- ============================================================================
-- 4. Update passive mining cron job to use private.invoke_edge_function correctly
-- ============================================================================

DO $do$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM cron.job
        WHERE jobname = 'passive-cron-job'
          AND schedule = '0 2 * * *'
          AND regexp_replace(command, '\s+', ' ', 'g')
            LIKE '%SELECT private.invoke_edge_function(''passive-mining'');%'
    ) THEN
        RAISE NOTICE 'passive-cron-job already configured, skipping';
        RETURN;
    END IF;

    BEGIN
        PERFORM cron.unschedule(jobid)
        FROM cron.job
        WHERE jobname = 'passive-cron-job';
    EXCEPTION WHEN OTHERS THEN
        DELETE FROM cron.job WHERE jobname = 'passive-cron-job';
    END;

    PERFORM cron.schedule(
        'passive-cron-job',
        '0 2 * * *', -- At 02:00 AM
        $cron$
        SELECT private.invoke_edge_function('passive-mining');
        $cron$
    );
END
$do$;
