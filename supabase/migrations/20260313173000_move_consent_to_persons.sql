-- Move consent from refinedpersons to persons (forward-only migration for QA/prod convergence)
-- This migration handles the case where earlier migrations may have partially applied consent to refinedpersons
-- and ensures all consent data lives in persons going forward.

-- Ensure persons has consent columns (idempotent - will be NOOP if already exists from earlier migrations)
ALTER TABLE private.persons
  ADD COLUMN IF NOT EXISTS consent_status private.contact_consent_status NOT NULL DEFAULT 'legitimate_interest';

ALTER TABLE private.persons
  ADD COLUMN IF NOT EXISTS consent_changed_at timestamptz;

-- Ensure index exists for consent queries (idempotent)
CREATE INDEX IF NOT EXISTS persons_user_consent_idx
  ON private.persons (user_id, consent_status);

-- Cleanup: drop consent from refinedpersons if they exist
DROP INDEX IF EXISTS private.refinedpersons_user_consent_idx;

ALTER TABLE private.refinedpersons
  DROP COLUMN IF EXISTS consent_status,
  DROP COLUMN IF EXISTS consent_changed_at;
