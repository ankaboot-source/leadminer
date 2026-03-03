-- Add temperature column to email_campaign_recipients for ordering
ALTER TABLE private.email_campaign_recipients
ADD COLUMN IF NOT EXISTS contact_temperature INTEGER;

CREATE INDEX IF NOT EXISTS email_campaign_recipients_contact_temperature_idx
ON private.email_campaign_recipients (campaign_id, contact_temperature DESC)
WHERE send_status = 'pending';
