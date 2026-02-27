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

SELECT cron.schedule(
  'passive-cron-job',
  '0 2 * * *', -- At 02:00 AM
  $$ SELECT invoke_edge_function('passive-mining'); $$
);
