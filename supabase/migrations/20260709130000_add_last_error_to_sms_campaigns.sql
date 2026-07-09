-- Add a `last_error` column so the frontend can show *why* a campaign
-- failed, instead of leaving it stuck on "processing" forever.
ALTER TABLE private.sms_campaigns
  ADD COLUMN IF NOT EXISTS last_error TEXT;
