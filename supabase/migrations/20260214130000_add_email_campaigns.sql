-- ENABLE PG_CRYPTO
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TYPE private.email_campaign_status AS ENUM (
  'queued',
  'processing',
  'completed',
  'failed'
);

CREATE TYPE private.email_campaign_recipient_status AS ENUM (
  'pending',
  'sent',
  'failed',
  'skipped'
);

CREATE TYPE private.email_campaign_event_type AS ENUM (
  'open',
  'click'
);

CREATE TABLE private.email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  reply_to TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html_template TEXT,
  body_text_template TEXT,
  sender_daily_limit INTEGER NOT NULL DEFAULT 1000,
  track_open BOOLEAN NOT NULL DEFAULT TRUE,
  track_click BOOLEAN NOT NULL DEFAULT TRUE,
  plain_text_only BOOLEAN NOT NULL DEFAULT FALSE,
  only_valid_contacts BOOLEAN NOT NULL DEFAULT FALSE,
  total_recipients INTEGER NOT NULL DEFAULT 0,
  status private.email_campaign_status NOT NULL DEFAULT 'queued',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now()),
  CONSTRAINT email_campaign_sender_daily_limit_check CHECK (sender_daily_limit >= 1 AND sender_daily_limit <= 2000)
);

CREATE TABLE private.email_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES private.email_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_email TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  status TEXT,
  name TEXT,
  given_name TEXT,
  family_name TEXT,
  location TEXT,
  works_for TEXT,
  job_title TEXT,
  open_token UUID NOT NULL DEFAULT gen_random_uuid(),
  send_status private.email_campaign_recipient_status NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  smtp_code TEXT,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now()),
  CONSTRAINT email_campaign_recipient_unique UNIQUE (campaign_id, contact_email),
  CONSTRAINT email_campaign_recipient_open_token_unique UNIQUE (open_token)
);

CREATE TABLE private.email_campaign_links (
  token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES private.email_campaigns(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES private.email_campaign_recipients(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now())
);

CREATE TABLE private.email_campaign_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES private.email_campaigns(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES private.email_campaign_recipients(id) ON DELETE CASCADE,
  event_type private.email_campaign_event_type NOT NULL,
  url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now())
);

CREATE INDEX email_campaigns_user_created_idx
  ON private.email_campaigns (user_id, created_at DESC);

CREATE INDEX email_campaign_recipients_queue_idx
  ON private.email_campaign_recipients (campaign_id, send_status, created_at);

CREATE INDEX email_campaign_recipients_sender_sent_idx
  ON private.email_campaign_recipients (sender_email, sent_at)
  WHERE send_status = 'sent';

CREATE INDEX email_campaign_events_campaign_type_idx
  ON private.email_campaign_events (campaign_id, event_type, created_at DESC);

ALTER TABLE private.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.email_campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.email_campaign_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.email_campaign_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own campaigns"
  ON private.email_campaigns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can read own campaign recipients"
  ON private.email_campaign_recipients FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can read own campaign links"
  ON private.email_campaign_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM private.email_campaign_recipients r
      WHERE r.id = recipient_id
        AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can read own campaign events"
  ON private.email_campaign_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM private.email_campaigns c
      WHERE c.id = campaign_id
        AND c.user_id = auth.uid()
    )
  );

CREATE TRIGGER handle_updated_at_email_campaigns
  BEFORE UPDATE ON private.email_campaigns
  FOR EACH ROW
  EXECUTE PROCEDURE extensions.moddatetime(updated_at);

CREATE TRIGGER handle_updated_at_email_campaign_recipients
  BEFORE UPDATE ON private.email_campaign_recipients
  FOR EACH ROW
  EXECUTE PROCEDURE extensions.moddatetime(updated_at);

CREATE OR REPLACE FUNCTION private.get_campaigns_overview()
RETURNS TABLE(
  id UUID,
  sender_name TEXT,
  sender_email TEXT,
  subject TEXT,
  status private.email_campaign_status,
  total_recipients INTEGER,
  attempted INTEGER,
  delivered INTEGER,
  opened INTEGER,
  clicked INTEGER,
  delivery_rate NUMERIC,
  opening_rate NUMERIC,
  clicking_rate NUMERIC,
  created_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH attempts AS (
    SELECT
      r.campaign_id,
      COUNT(*) FILTER (WHERE r.send_status IN ('sent', 'failed'))::INTEGER AS attempted,
      COUNT(*) FILTER (WHERE r.send_status = 'sent')::INTEGER AS delivered
    FROM private.email_campaign_recipients r
    WHERE r.user_id = auth.uid()
    GROUP BY r.campaign_id
  ),
  opens AS (
    SELECT
      e.campaign_id,
      COUNT(DISTINCT e.recipient_id)::INTEGER AS opened
    FROM private.email_campaign_events e
    JOIN private.email_campaign_recipients r ON r.id = e.recipient_id
    WHERE e.event_type = 'open'
      AND r.user_id = auth.uid()
    GROUP BY e.campaign_id
  ),
  clicks AS (
    SELECT
      e.campaign_id,
      COUNT(DISTINCT e.recipient_id)::INTEGER AS clicked
    FROM private.email_campaign_events e
    JOIN private.email_campaign_recipients r ON r.id = e.recipient_id
    WHERE e.event_type = 'click'
      AND r.user_id = auth.uid()
    GROUP BY e.campaign_id
  )
  SELECT
    c.id,
    c.sender_name,
    c.sender_email,
    c.subject,
    c.status,
    c.total_recipients,
    COALESCE(a.attempted, 0) AS attempted,
    COALESCE(a.delivered, 0) AS delivered,
    COALESCE(o.opened, 0) AS opened,
    COALESCE(cl.clicked, 0) AS clicked,
    CASE
      WHEN COALESCE(a.attempted, 0) = 0 THEN 0
      ELSE ROUND((COALESCE(a.delivered, 0)::NUMERIC / a.attempted::NUMERIC) * 100, 2)
    END AS delivery_rate,
    CASE
      WHEN COALESCE(a.delivered, 0) = 0 THEN 0
      ELSE ROUND((COALESCE(o.opened, 0)::NUMERIC / a.delivered::NUMERIC) * 100, 2)
    END AS opening_rate,
    CASE
      WHEN COALESCE(a.delivered, 0) = 0 THEN 0
      ELSE ROUND((COALESCE(cl.clicked, 0)::NUMERIC / a.delivered::NUMERIC) * 100, 2)
    END AS clicking_rate,
    c.created_at,
    c.started_at,
    c.completed_at
  FROM private.email_campaigns c
  LEFT JOIN attempts a ON a.campaign_id = c.id
  LEFT JOIN opens o ON o.campaign_id = c.id
  LEFT JOIN clicks cl ON cl.campaign_id = c.id
  WHERE c.user_id = auth.uid()
  ORDER BY c.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION private.get_user_mining_source_credentials(_encryption_key TEXT)
RETURNS TABLE(
  email TEXT,
  type TEXT,
  credentials JSONB
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ms.email,
    ms.type::TEXT,
    extensions.pgp_sym_decrypt(ms.credentials, _encryption_key)::JSONB AS credentials
  FROM private.mining_sources ms
  WHERE ms.user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION private.get_mining_source_credentials_for_user(_user_id UUID, _encryption_key TEXT)
RETURNS TABLE(
  email TEXT,
  type TEXT,
  credentials JSONB
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ms.email,
    ms.type::TEXT,
    extensions.pgp_sym_decrypt(ms.credentials, _encryption_key)::JSONB AS credentials
  FROM private.mining_sources ms
  WHERE ms.user_id = _user_id;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION private.trigger_email_campaign_processor()
RETURNS VOID
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  supabase_url TEXT := current_setting('app.settings.supabase_url', true);
  service_role_key TEXT := current_setting('app.settings.service_role_key', true);
BEGIN
  IF supabase_url IS NULL OR service_role_key IS NULL THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/email-campaigns/campaigns/process',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key,
      'apikey', service_role_key
    ),
    body := '{}'::jsonb
  );
END;
$$;

SELECT cron.schedule(
  'process-email-campaigns',
  '*/10 * * * *',
  $$SELECT private.trigger_email_campaign_processor();$$
);
