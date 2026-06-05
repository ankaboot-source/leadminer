-- WhatsApp Gateway: extend SMS infrastructure for WhatsApp campaigns via OpenWA
-- Reuses sms_campaigns, sms_campaign_recipients, sms_fleet_gateways with channel discrimination

-- 1. Add channel column to sms_campaigns
ALTER TABLE private.sms_campaigns
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'sms'
  CHECK (channel IN ('sms', 'whatsapp'));

CREATE INDEX IF NOT EXISTS idx_sms_campaigns_channel ON private.sms_campaigns(channel);

-- 2. WhatsApp metrics on sms_campaigns (fed by webhook)
ALTER TABLE private.sms_campaigns
  ADD COLUMN IF NOT EXISTS delivered_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS read_count INTEGER NOT NULL DEFAULT 0;

-- 3. Add 'openwa' to sms_campaigns provider CHECK
ALTER TABLE private.sms_campaigns
  DROP CONSTRAINT IF EXISTS sms_campaigns_provider_check;

ALTER TABLE private.sms_campaigns
  ADD CONSTRAINT sms_campaigns_provider_check
  CHECK (provider IN ('twilio', 'smsgate', 'simple-sms-gateway', 'fleet', 'openwa'));

-- 4. Add 'openwa' to sms_fleet_gateways provider CHECK
ALTER TABLE private.sms_fleet_gateways
  DROP CONSTRAINT IF EXISTS sms_fleet_gateways_provider_check;

ALTER TABLE private.sms_fleet_gateways
  ADD CONSTRAINT sms_fleet_gateways_provider_check
  CHECK (provider IN ('smsgate', 'simple-sms-gateway', 'twilio', 'openwa'));

-- 5. Add 'delivered' and 'read' to recipient status enum
ALTER TYPE private.sms_campaign_recipient_status ADD VALUE IF NOT EXISTS 'delivered';
ALTER TYPE private.sms_campaign_recipient_status ADD VALUE IF NOT EXISTS 'read';

-- 6. Lifecycle timestamps on recipients
ALTER TABLE private.sms_campaign_recipients
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- 7. Index for webhook lookups by provider_message_id
CREATE INDEX IF NOT EXISTS idx_sms_campaign_recipients_provider_msg_id
  ON private.sms_campaign_recipients(provider_message_id)
  WHERE provider_message_id IS NOT NULL;

-- 8. Update get_sms_campaigns_overview to include channel + whatsapp metrics
DROP FUNCTION IF EXISTS public.get_sms_campaigns_overview();
DROP FUNCTION IF EXISTS public.get_unified_campaigns_overview();
CREATE FUNCTION public.get_sms_campaigns_overview()
RETURNS TABLE (
  id UUID,
  sender_name TEXT,
  provider TEXT,
  channel TEXT,
  message_template TEXT,
  recipient_count BIGINT,
  sent_count BIGINT,
  delivered_count BIGINT,
  read_count BIGINT,
  failed_count BIGINT,
  click_count BIGINT,
  unsubscribe_count BIGINT,
  status TEXT,
  created_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  use_short_links BOOLEAN,
  fleet_mode_enabled BOOLEAN,
  selected_gateway_ids UUID[],
  gateway_names TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sc.id,
    sc.sender_name,
    sc.provider,
    sc.channel,
    sc.message_template,
    sc.recipient_count::BIGINT,
    sc.sent_count::BIGINT,
    sc.delivered_count::BIGINT,
    sc.read_count::BIGINT,
    sc.failed_count::BIGINT,
    sc.click_count::BIGINT,
    sc.unsubscribe_count::BIGINT,
    sc.status::TEXT,
    sc.created_at,
    sc.started_at,
    sc.completed_at,
    sc.use_short_links,
    sc.fleet_mode_enabled,
    sc.selected_gateway_ids,
    COALESCE(
      ARRAY(
        SELECT g.name
        FROM unnest(sc.selected_gateway_ids) AS gid(id)
        JOIN private.sms_fleet_gateways g ON g.id = gid.id
        ORDER BY g.name
      ),
      ARRAY[]::TEXT[]
    ) AS gateway_names
  FROM private.sms_campaigns sc
  WHERE sc.user_id = auth.uid()
  ORDER BY sc.created_at DESC;
END;
$$;

-- 9. Update get_unified_campaigns_overview to use sms_campaigns.channel + whatsapp metrics
CREATE FUNCTION public.get_unified_campaigns_overview()
RETURNS TABLE (
  id UUID,
  channel TEXT,
  sender_name TEXT,
  sender_email TEXT,
  provider TEXT,
  subject TEXT,
  message_template TEXT,
  status TEXT,
  total_recipients BIGINT,
  recipient_count BIGINT,
  attempted BIGINT,
  delivered BIGINT,
  sent_count BIGINT,
  hard_bounced BIGINT,
  soft_bounced BIGINT,
  failed_other BIGINT,
  failed_count BIGINT,
  opened BIGINT,
  open_count BIGINT,
  clicked BIGINT,
  click_count BIGINT,
  unsubscribed BIGINT,
  unsubscribe_count BIGINT,
  delivery_rate NUMERIC,
  opening_rate NUMERIC,
  clicking_rate NUMERIC,
  unsubscribe_rate NUMERIC,
  created_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  sender_daily_limit BIGINT,
  total_batches BIGINT,
  use_short_links BOOLEAN,
  fleet_mode_enabled BOOLEAN,
  selected_gateway_ids UUID[],
  gateway_names TEXT[],
  wa_delivered_count BIGINT,
  wa_read_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  -- Email campaigns
  SELECT
    ec.id,
    'email'::TEXT AS channel,
    ec.sender_name,
    ec.sender_email,
    NULL::TEXT AS provider,
    ec.subject,
    NULL::TEXT AS message_template,
    ec.status::TEXT,
    ec.total_recipients,
    ec.recipient_count,
    ec.attempted,
    ec.delivered,
    NULL::BIGINT AS sent_count,
    ec.hard_bounced,
    ec.soft_bounced,
    ec.failed_other,
    NULL::BIGINT AS failed_count,
    ec.opened,
    ec.open_count,
    ec.clicked,
    ec.click_count,
    ec.unsubscribed,
    ec.unsubscribe_count,
    ec.delivery_rate,
    ec.opening_rate,
    ec.clicking_rate,
    ec.unsubscribe_rate,
    ec.created_at,
    ec.started_at,
    ec.completed_at,
    ec.sender_daily_limit,
    ec.total_batches,
    NULL::BOOLEAN AS use_short_links,
    NULL::BOOLEAN AS fleet_mode_enabled,
    NULL::UUID[] AS selected_gateway_ids,
    NULL::TEXT[] AS gateway_names,
    NULL::BIGINT AS wa_delivered_count,
    NULL::BIGINT AS wa_read_count
  FROM private.email_campaigns ec
  WHERE ec.user_id = auth.uid()

  UNION ALL

  -- SMS + WhatsApp campaigns (channel discriminates)
  SELECT
    sc.id,
    sc.channel,
    sc.sender_name,
    NULL::TEXT AS sender_email,
    sc.provider,
    NULL::TEXT AS subject,
    sc.message_template,
    sc.status::TEXT,
    NULL::BIGINT AS total_recipients,
    sc.recipient_count::BIGINT,
    NULL::BIGINT AS attempted,
    sc.sent_count::BIGINT AS delivered,
    sc.sent_count::BIGINT,
    NULL::BIGINT AS hard_bounced,
    NULL::BIGINT AS soft_bounced,
    sc.failed_count::BIGINT AS failed_other,
    sc.failed_count::BIGINT,
    NULL::BIGINT AS opened,
    sc.click_count::BIGINT AS open_count,
    sc.click_count::BIGINT AS clicked,
    sc.click_count::BIGINT,
    sc.unsubscribe_count::BIGINT AS unsubscribed,
    sc.unsubscribe_count::BIGINT,
    CASE
      WHEN sc.recipient_count > 0
      THEN ROUND((sc.sent_count::NUMERIC / sc.recipient_count) * 100, 2)
      ELSE 0
    END AS delivery_rate,
    0::NUMERIC AS opening_rate,
    0::NUMERIC AS clicking_rate,
    CASE
      WHEN sc.recipient_count > 0
      THEN ROUND((sc.unsubscribe_count::NUMERIC / sc.recipient_count) * 100, 2)
      ELSE 0
    END AS unsubscribe_rate,
    sc.created_at,
    sc.started_at,
    sc.completed_at,
    NULL::BIGINT AS sender_daily_limit,
    NULL::BIGINT AS total_batches,
    sc.use_short_links,
    sc.fleet_mode_enabled,
    sc.selected_gateway_ids,
    COALESCE(
      ARRAY(
        SELECT g.name
        FROM unnest(sc.selected_gateway_ids) AS gid(id)
        JOIN private.sms_fleet_gateways g ON g.id = gid.id
        ORDER BY g.name
      ),
      ARRAY[]::TEXT[]
    ) AS gateway_names,
    sc.delivered_count::BIGINT AS wa_delivered_count,
    sc.read_count::BIGINT AS wa_read_count
  FROM private.sms_campaigns sc
  WHERE sc.user_id = auth.uid()

  ORDER BY created_at DESC;
END;
$$;
