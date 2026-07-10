-- Re-apply ALTER TABLE statements that were recorded as applied but didn't actually run on some environments
ALTER TABLE private.sms_campaigns
  ADD COLUMN IF NOT EXISTS footer_text_template TEXT,
  ADD COLUMN IF NOT EXISTS twilio_fallback_enabled BOOLEAN NOT NULL DEFAULT false;
