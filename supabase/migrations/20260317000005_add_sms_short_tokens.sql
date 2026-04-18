ALTER TABLE private.sms_campaign_recipients
  ADD COLUMN IF NOT EXISTS unsubscribe_short_token TEXT;

UPDATE private.sms_campaign_recipients
SET unsubscribe_short_token = SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 10)
WHERE unsubscribe_short_token IS NULL;

ALTER TABLE private.sms_campaign_recipients
  ALTER COLUMN unsubscribe_short_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sms_campaign_recipients_unsubscribe_short_token_unique_idx
  ON private.sms_campaign_recipients (unsubscribe_short_token);
