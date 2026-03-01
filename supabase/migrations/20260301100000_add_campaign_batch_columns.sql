-- Add batch-related columns to get_campaigns_overview
-- This adds sender_daily_limit and total_batches for better lot visibility

DROP FUNCTION IF EXISTS private.get_campaigns_overview();

CREATE FUNCTION private.get_campaigns_overview()
RETURNS TABLE(
  id UUID,
  sender_name TEXT,
  sender_email TEXT,
  subject TEXT,
  status private.email_campaign_status,
  total_recipients INTEGER,
  attempted INTEGER,
  delivered INTEGER,
  hard_bounced INTEGER,
  soft_bounced INTEGER,
  failed_other INTEGER,
  opened INTEGER,
  clicked INTEGER,
  unsubscribed INTEGER,
  delivery_rate NUMERIC,
  opening_rate NUMERIC,
  clicking_rate NUMERIC,
  unsubscribe_rate NUMERIC,
  track_open BOOLEAN,
  track_click BOOLEAN,
  link_clicks JSONB,
  created_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  sender_daily_limit INTEGER,
  total_batches INTEGER
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
      COUNT(*) FILTER (WHERE r.send_status = 'sent')::INTEGER AS delivered,
      COUNT(*) FILTER (WHERE r.send_status = 'failed' AND r.bounce_type = 'hard')::INTEGER AS hard_bounced,
      COUNT(*) FILTER (WHERE r.send_status = 'failed' AND r.bounce_type = 'soft')::INTEGER AS soft_bounced,
      COUNT(*) FILTER (
        WHERE r.send_status = 'failed'
          AND COALESCE(r.bounce_type, 'technical') = 'technical'
      )::INTEGER AS failed_other
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
  ),
  unsubscribes AS (
    SELECT
      e.campaign_id,
      COUNT(DISTINCT e.recipient_id)::INTEGER AS unsubscribed
    FROM private.email_campaign_events e
    JOIN private.email_campaign_recipients r ON r.id = e.recipient_id
    WHERE e.event_type = 'unsubscribe'
      AND r.user_id = auth.uid()
    GROUP BY e.campaign_id
  ),
  link_click_rows AS (
    SELECT
      e.campaign_id,
      e.url,
      COUNT(*)::INTEGER AS total_clicks,
      COUNT(DISTINCT e.recipient_id)::INTEGER AS unique_clicks,
      ROW_NUMBER() OVER (
        PARTITION BY e.campaign_id
        ORDER BY COUNT(DISTINCT e.recipient_id) DESC, COUNT(*) DESC, e.url
      ) AS rn
    FROM private.email_campaign_events e
    JOIN private.email_campaign_recipients r ON r.id = e.recipient_id
    WHERE e.event_type = 'click'
      AND e.url IS NOT NULL
      AND r.user_id = auth.uid()
    GROUP BY e.campaign_id, e.url
  ),
  link_clicks AS (
    SELECT
      campaign_id,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'url', url,
            'unique_clicks', unique_clicks,
            'total_clicks', total_clicks
          )
          ORDER BY unique_clicks DESC, total_clicks DESC, url
        ) FILTER (WHERE rn <= 5),
        '[]'::jsonb
      ) AS link_clicks
    FROM link_click_rows
    GROUP BY campaign_id
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
    COALESCE(a.hard_bounced, 0) AS hard_bounced,
    COALESCE(a.soft_bounced, 0) AS soft_bounced,
    COALESCE(a.failed_other, 0) AS failed_other,
    COALESCE(o.opened, 0) AS opened,
    COALESCE(cl.clicked, 0) AS clicked,
    COALESCE(u.unsubscribed, 0) AS unsubscribed,
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
    CASE
      WHEN COALESCE(a.delivered, 0) = 0 THEN 0
      ELSE ROUND((COALESCE(u.unsubscribed, 0)::NUMERIC / a.delivered::NUMERIC) * 100, 2)
    END AS unsubscribe_rate,
    c.track_open,
    c.track_click,
    COALESCE(lc.link_clicks, '[]'::jsonb) AS link_clicks,
    c.created_at,
    c.started_at,
    c.completed_at,
    COALESCE(c.sender_daily_limit, 1000)::INTEGER AS sender_daily_limit,
    CEIL(c.total_recipients::NUMERIC / NULLIF(c.sender_daily_limit, 0)::NUMERIC)::INTEGER AS total_batches
  FROM private.email_campaigns c
  LEFT JOIN attempts a ON a.campaign_id = c.id
  LEFT JOIN opens o ON o.campaign_id = c.id
  LEFT JOIN clicks cl ON cl.campaign_id = c.id
  LEFT JOIN unsubscribes u ON u.campaign_id = c.id
  LEFT JOIN link_clicks lc ON lc.campaign_id = c.id
  WHERE c.user_id = auth.uid()
  ORDER BY c.created_at DESC;
END;
$$;
