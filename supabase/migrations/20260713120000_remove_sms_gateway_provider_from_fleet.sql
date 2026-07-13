-- Remove "sms-gateway" (iOS SMS Gateway app) from the sms_fleet_gateways
-- provider enum. The iOS provider has been fully retired; new gateways
-- must be created with one of the remaining providers
-- ('smsgate', 'simple-sms-gateway', 'twilio', 'openwa').
--
-- WARNING: This migration NARROWS the allowed values. Any existing rows
-- in private.sms_fleet_gateways with provider = 'sms-gateway' will
-- cause the new CHECK constraint to fail when it is added, which will
-- abort the migration. The deployer MUST clean up (delete or migrate)
-- those rows BEFORE applying this migration.
--
-- Quick check to run before deploying:
--   SELECT id, name, provider, created_at
--     FROM private.sms_fleet_gateways
--    WHERE provider = 'sms-gateway';

ALTER TABLE private.sms_fleet_gateways
  DROP CONSTRAINT IF EXISTS sms_fleet_gateways_provider_check;

ALTER TABLE private.sms_fleet_gateways
  ADD CONSTRAINT sms_fleet_gateways_provider_check
  CHECK (provider IN ('smsgate', 'simple-sms-gateway', 'twilio', 'openwa'));
