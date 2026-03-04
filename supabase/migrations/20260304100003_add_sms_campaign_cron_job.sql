-- SMS Campaign Cron Job
-- Processes queued SMS campaigns every 10 minutes

-- Function to trigger SMS campaign processing
CREATE OR REPLACE FUNCTION private.trigger_sms_campaign_processor()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  supabase_url TEXT := current_setting('app.settings.supabase_url', true);
  service_role_key TEXT := current_setting('app.settings.service_role_key', true);
BEGIN
  IF supabase_url IS NULL OR service_role_key IS NULL THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/sms-campaigns/process',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key,
      'apikey', service_role_key
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- Schedule the cron job to run every 10 minutes
SELECT cron.schedule(
  'process-sms-campaigns',
  '*/10 * * * *',
  $$SELECT private.trigger_sms_campaign_processor();$$
);
