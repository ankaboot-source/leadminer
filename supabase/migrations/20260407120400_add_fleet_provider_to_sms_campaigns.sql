-- Add 'fleet' to the sms_campaigns provider CHECK constraint
-- Fleet mode uses multiple gateways per campaign, so the provider value is 'fleet'

ALTER TABLE private.sms_campaigns
  DROP CONSTRAINT IF EXISTS sms_campaigns_provider_check;

ALTER TABLE private.sms_campaigns
  ADD CONSTRAINT sms_campaigns_provider_check
  CHECK (provider IN ('twilio', 'smsgate', 'simple-sms-gateway', 'fleet'));