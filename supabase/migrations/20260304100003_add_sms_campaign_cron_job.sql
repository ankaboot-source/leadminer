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
  campaign_record RECORD;
  supabase_url TEXT := current_setting('app.settings.supabase_url', true);
  service_role_key TEXT := current_setting('app.settings.service_role_key', true);
  response TEXT;
BEGIN
  FOR campaign_record IN
    SELECT id
    FROM private.sms_campaigns
    WHERE status = 'queued'
    ORDER BY created_at ASC
    LIMIT 10
  LOOP
    BEGIN
      response := supabase_http.request(
        supabase_url || '/functions/v1/sms-campaigns/process',
        'POST',
        ARRAY[
          ('Content-Type', 'application/json'),
          ('Authorization', 'Bearer ' || service_role_key)
        ],
        ('{"campaignId": "' || campaign_record.id::TEXT || '"}')::jsonb
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to process SMS campaign %: %', campaign_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

-- Schedule the cron job to run every 10 minutes
SELECT cron.schedule(
  'process-sms-campaigns',
  '*/10 * * * *',
  $$SELECT private.trigger_sms_campaign_processor();$$
);