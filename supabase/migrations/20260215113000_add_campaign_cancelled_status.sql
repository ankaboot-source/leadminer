DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'private'
      AND t.typname = 'email_campaign_status'
      AND e.enumlabel = 'cancelled'
  ) THEN
    ALTER TYPE private.email_campaign_status ADD VALUE 'cancelled';
  END IF;
END;
$$;
