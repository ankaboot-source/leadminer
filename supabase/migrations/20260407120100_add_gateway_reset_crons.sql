-- Schedule daily reset at midnight UTC
SELECT cron.schedule(
  'reset-daily-gateway-counters',
  '0 0 * * *',
  $$SELECT private.reset_daily_gateway_counters();$$
);

-- Schedule monthly reset on 1st of each month at midnight UTC
SELECT cron.schedule(
  'reset-monthly-gateway-counters',
  '0 0 1 * *',
  $$SELECT private.reset_monthly_gateway_counters();$$
);

-- Add comments for documentation
COMMENT ON FUNCTION private.reset_daily_gateway_counters() IS 
  'Resets sent_today counter to 0 for all gateways. Scheduled to run daily at midnight UTC via pg_cron.';

COMMENT ON FUNCTION private.reset_monthly_gateway_counters() IS
  'Resets sent_this_month and sent_today counters to 0. Scheduled to run on 1st of each month at midnight UTC via pg_cron.';