ALTER TABLE private.profiles
  ADD COLUMN IF NOT EXISTS smsgate_base_url TEXT,
  ADD COLUMN IF NOT EXISTS smsgate_username TEXT,
  ADD COLUMN IF NOT EXISTS smsgate_password TEXT;

ALTER TABLE private.sms_campaigns
  ADD COLUMN IF NOT EXISTS twilio_fallback_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE private.sms_campaign_recipients
  ADD COLUMN IF NOT EXISTS provider_used TEXT;
