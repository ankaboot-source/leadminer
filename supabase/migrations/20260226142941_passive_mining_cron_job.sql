CREATE FUNCTION invoke_edge_function(edge_function_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    project_url TEXT;
    response JSONB;
BEGIN
    SELECT decrypted_secret INTO project_url
    FROM vault.decrypted_secrets
    WHERE name = 'project_url';

    IF project_url IS NULL THEN
        RAISE EXCEPTION 'project_url is missing';
    END IF;

    response := net.http_post(
        url := project_url || '/functions/v1/' || edge_function_name,
        headers := jsonb_build_object(
            'Content-Type', 'application/json'
        )
    );

    RETURN response;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'passive-cron-job'
      AND schedule = '0 2 * * *'
      AND regexp_replace(command, '\s+', ' ', 'g')
        LIKE '%SELECT invoke_edge_function(''passive-mining'');%'
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
    $$ SELECT invoke_edge_function('passive-mining'); $$
  );
END
$$;
