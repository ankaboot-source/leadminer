-- Add WhatsApp delivery tracking columns to sms_campaign_recipients
ALTER TABLE private.sms_campaign_recipients
  ADD COLUMN IF NOT EXISTS ack_status TEXT,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Index for webhook lookups by provider_message_id
CREATE INDEX IF NOT EXISTS idx_sms_campaign_recipients_provider_msg_id
  ON private.sms_campaign_recipients(provider_message_id)
  WHERE provider_message_id IS NOT NULL;
