-- Widen the sms_fleet_gateways.provider CHECK constraint to allow
-- 'sms-gateway' (iOS SMS Gateway app). The previous "sms-gateway-ios"
-- provider id was renamed to "sms-gateway" and the `appId` discriminator
-- was removed in favour of dispatching directly on `gateway.provider`.
--
-- This migration only widens the allowed values; existing rows are not
-- touched. After this migration, gateways can be created with provider =
-- "sms-gateway" via the standard fleet POST endpoint.

ALTER TABLE private.sms_fleet_gateways
  DROP CONSTRAINT IF EXISTS sms_fleet_gateways_provider_check;

ALTER TABLE private.sms_fleet_gateways
  ADD CONSTRAINT sms_fleet_gateways_provider_check
  CHECK (provider IN ('smsgate', 'simple-sms-gateway', 'sms-gateway', 'twilio', 'openwa'));
