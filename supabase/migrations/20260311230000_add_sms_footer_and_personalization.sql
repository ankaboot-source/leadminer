ALTER TABLE private.sms_campaigns
  ADD COLUMN IF NOT EXISTS footer_text_template TEXT;

ALTER TABLE private.sms_campaign_recipients
  ADD COLUMN IF NOT EXISTS personalization_data JSONB;
