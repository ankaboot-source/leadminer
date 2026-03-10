ALTER TABLE private.refinedpersons
  ADD COLUMN IF NOT EXISTS consent_changed_at timestamptz;
