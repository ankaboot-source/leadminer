-- Remove sender_phone from sms_campaigns (keep sender_name)
ALTER TABLE private.sms_campaigns
  DROP COLUMN IF EXISTS sender_phone;

-- Remove username/password for simple_sms_gateway from profiles
ALTER TABLE private.profiles
  DROP COLUMN IF EXISTS simple_sms_gateway_username,
  DROP COLUMN IF EXISTS simple_sms_gateway_password;

-- Change use_short_links default to true
ALTER TABLE private.sms_campaigns
  ALTER COLUMN use_short_links SET DEFAULT true;

-- Make use_short_links not nullable if needed
ALTER TABLE private.sms_campaigns
  ALTER COLUMN use_short_links SET NOT NULL;
