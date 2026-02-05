ALTER TABLE private.mining_sources
ADD COLUMN passive_mining BOOLEAN DEFAULT FALSE;

CREATE POLICY "User can update own mining source"
ON private.mining_sources
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "User can select own mining source"
ON private.mining_sources
FOR SELECT
TO public
USING (auth.uid() = user_id);

-- prequisite: Add project_url to the vault --
select vault.create_secret(
  'http://host.docker.internal:54321',
  'project_url',
  'URL to be used for calling edge functions. This is set here to support development with database-triggered webhooks across environments.'
);

-- prequisite: Add anon_key to the vault --
-- select vault.create_secret(
--   'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
--   'anon_key',
--   'URL to be used for calling edge functions. This is set here to support development with database-triggered webhooks across environments.'
-- );


CREATE FUNCTION invoke_edge_function(edge_function_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    project_url TEXT;
    response JSONB;
    payload JSONB;
BEGIN
    -- Fetch the base URL from Vault
    SELECT decrypted_secret INTO project_url
    FROM vault.decrypted_secrets
    WHERE name = 'project_url';

    -- Validate secrets
    IF project_url IS NULL THEN
        RAISE EXCEPTION 'project_url is missing';
    END IF;

    -- Perform HTTP POST to Edge Function
    response := net.http_post(
        url:= project_url || '/functions/v1/' || edge_function_name,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
			-- 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')
        )
    );

    RETURN response;
END;
$$;



-- SELECT cron.schedule(
--   'passive-cron-job',
--   '0 * * * *',   -- every hour
--   $$ SELECT execute_edge_function('passive-mining'); $$
-- );
