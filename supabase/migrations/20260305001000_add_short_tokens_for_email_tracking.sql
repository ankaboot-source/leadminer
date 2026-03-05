ALTER TABLE private.email_campaign_recipients
  ADD COLUMN IF NOT EXISTS open_short_token TEXT,
  ADD COLUMN IF NOT EXISTS unsubscribe_short_token TEXT;

ALTER TABLE private.email_campaign_links
  ADD COLUMN IF NOT EXISTS short_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS email_campaign_recipients_open_short_token_unique_idx
  ON private.email_campaign_recipients (open_short_token)
  WHERE open_short_token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS email_campaign_recipients_unsubscribe_short_token_unique_idx
  ON private.email_campaign_recipients (unsubscribe_short_token)
  WHERE unsubscribe_short_token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS email_campaign_links_short_token_unique_idx
  ON private.email_campaign_links (short_token)
  WHERE short_token IS NOT NULL;
