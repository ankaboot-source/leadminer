-- Backfill missing short tokens for email campaign recipients
-- This ensures all existing recipients have unsubscribe and open short tokens

UPDATE private.email_campaign_recipients
SET 
  open_short_token = COALESCE(open_short_token, encode(gen_random_bytes(6), 'base64')),
  unsubscribe_short_token = COALESCE(unsubscribe_short_token, encode(gen_random_bytes(6), 'base64'))
WHERE 
  open_short_token IS NULL 
  OR unsubscribe_short_token IS NULL;

-- Add NOT NULL constraints after backfill
ALTER TABLE private.email_campaign_recipients
  ALTER COLUMN open_short_token SET NOT NULL;

ALTER TABLE private.email_campaign_recipients
  ALTER COLUMN unsubscribe_short_token SET NOT NULL;
