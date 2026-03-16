-- Repair drifted environments where consent columns/index may be missing on private.persons.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'private'::regnamespace
      AND typname = 'contact_consent_status'
  ) THEN
    CREATE TYPE private.contact_consent_status AS ENUM (
      'legitimate_interest',
      'opt_out',
      'opt_in'
    );
  END IF;
END;
$$;

ALTER TABLE private.persons
  ADD COLUMN IF NOT EXISTS consent_status private.contact_consent_status NOT NULL DEFAULT 'legitimate_interest';

ALTER TABLE private.persons
  ADD COLUMN IF NOT EXISTS consent_changed_at timestamptz;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'private'
      AND table_name = 'refinedpersons'
      AND column_name = 'consent_status'
  ) THEN
    UPDATE private.persons p
    SET
      consent_status = COALESCE(rp.consent_status, p.consent_status),
      consent_changed_at = COALESCE(p.consent_changed_at, rp.consent_changed_at)
    FROM private.refinedpersons rp
    WHERE rp.user_id = p.user_id
      AND rp.email = p.email;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS persons_user_consent_idx
  ON private.persons (user_id, consent_status);
