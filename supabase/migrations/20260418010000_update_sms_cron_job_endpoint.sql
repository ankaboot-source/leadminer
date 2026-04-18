-- Update SMS campaign cron job to call the new sms-campaigns-process endpoint
CREATE OR REPLACE FUNCTION private.trigger_sms_campaign_processor()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  supabase_url TEXT := current_setting('app.settings.supabase_url', true);
  service_role_key TEXT;
BEGIN
  SELECT decrypted_secret INTO service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key';

  IF supabase_url IS NULL OR service_role_key IS NULL THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/sms-campaigns-process/process',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key,
      'apikey', service_role_key
    ),
    body := '{}'::jsonb
  );
END;
$$;
