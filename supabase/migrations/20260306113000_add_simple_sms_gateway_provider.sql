ALTER TABLE private.sms_campaigns
  DROP CONSTRAINT IF EXISTS sms_campaigns_provider_check;

ALTER TABLE private.sms_campaigns
  ADD CONSTRAINT sms_campaigns_provider_check
  CHECK (provider IN ('twilio', 'smsgate', 'simple-sms-gateway'));

ALTER TABLE private.profiles
  ADD COLUMN IF NOT EXISTS simple_sms_gateway_base_url TEXT,
  ADD COLUMN IF NOT EXISTS simple_sms_gateway_username TEXT,
  ADD COLUMN IF NOT EXISTS simple_sms_gateway_password TEXT;
