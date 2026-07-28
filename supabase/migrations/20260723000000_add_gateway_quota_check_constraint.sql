-- Add CHECK constraint to enforce sent_today <= daily_limit
-- Defense-in-depth: application code enforces quota via increment_gateway_sent_count_atomic,
-- but a bug in the code could allow sent_today to exceed daily_limit. This constraint
-- prevents invalid data from being stored in the database.

-- Check for existing constraint first (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_sms_fleet_gateways_sent_today_within_limit'
  ) THEN
    ALTER TABLE private.sms_fleet_gateways
      ADD CONSTRAINT chk_sms_fleet_gateways_sent_today_within_limit
      CHECK (sent_today <= daily_limit);
  END IF;
END
$$;

COMMENT ON CONSTRAINT chk_sms_fleet_gateways_sent_today_within_limit
  ON private.sms_fleet_gateways IS
  'Ensures sent_today never exceeds daily_limit as a defense-in-depth safety net';