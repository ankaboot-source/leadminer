-- SMS Fleet Mode: Add fleet gateway management tables

-- Fleet gateways table for storing multiple SMS gateway configurations
CREATE TABLE private.sms_fleet_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('smsgate', 'simple-sms-gateway', 'twilio')),
  config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  daily_limit INTEGER DEFAULT 0,
  monthly_limit INTEGER DEFAULT 0,
  sent_today INTEGER DEFAULT 0,
  sent_this_month INTEGER DEFAULT 0,
  last_reset_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fleet gateways
CREATE INDEX idx_sms_fleet_gateways_user_id ON private.sms_fleet_gateways(user_id);
CREATE INDEX idx_sms_fleet_gateways_user_active ON private.sms_fleet_gateways(user_id, is_active);

-- Enable RLS on fleet gateways
ALTER TABLE private.sms_fleet_gateways ENABLE ROW LEVEL SECURITY;

-- RLS Policies for fleet gateways
CREATE POLICY "Users can view own fleet gateways"
  ON private.sms_fleet_gateways FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own fleet gateways"
  ON private.sms_fleet_gateways FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own fleet gateways"
  ON private.sms_fleet_gateways FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own fleet gateways"
  ON private.sms_fleet_gateways FOR DELETE
  USING (auth.uid() = user_id);

-- Track which gateway is assigned to which recipient
CREATE TABLE private.sms_campaign_recipient_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES private.sms_campaigns(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES private.sms_campaign_recipients(id) ON DELETE CASCADE,
  gateway_id UUID REFERENCES private.sms_fleet_gateways(id) ON DELETE SET NULL,
  gateway_name TEXT,
  gateway_provider TEXT,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  
  UNIQUE(campaign_id, recipient_id)
);

-- Indexes for recipient gateways
CREATE INDEX idx_sms_campaign_recipient_gateways_campaign ON private.sms_campaign_recipient_gateways(campaign_id);
CREATE INDEX idx_sms_campaign_recipient_gateways_gateway ON private.sms_campaign_recipient_gateways(gateway_id);

-- Enable RLS on recipient gateways
ALTER TABLE private.sms_campaign_recipient_gateways ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recipient gateways
CREATE POLICY "Users can view own recipient gateways"
  ON private.sms_campaign_recipient_gateways FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private.sms_campaigns
      WHERE id = campaign_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own recipient gateways"
  ON private.sms_campaign_recipient_gateways FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM private.sms_campaigns
      WHERE id = campaign_id AND user_id = auth.uid()
    )
  );

-- Add fleet mode columns to sms_campaigns
ALTER TABLE private.sms_campaigns 
  ADD COLUMN fleet_mode_enabled BOOLEAN DEFAULT false,
  ADD COLUMN selected_gateway_ids UUID[] DEFAULT '{}';

-- Update the unified campaign overview to include fleet mode info
CREATE OR REPLACE FUNCTION public.get_unified_campaigns_overview()
RETURNS TABLE (
  id UUID,
  channel TEXT,
  sender_name TEXT,
  sender_email TEXT,
  provider TEXT,
  subject TEXT,
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
  selected_gateway_ids UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    NULL::UUID[] AS selected_gateway_ids
  FROM private.email_campaigns ec
  WHERE ec.user_id = auth.uid()
  
  UNION ALL
  
  -- SMS campaigns
  SELECT 
    sc.id,
    'sms'::TEXT AS channel,
    sc.sender_name,
    NULL::TEXT AS sender_email,
    sc.provider,
    NULL::TEXT AS subject,
    sc.status::TEXT,
    NULL::BIGINT AS total_recipients,
    sc.recipient_count,
    NULL::BIGINT AS attempted,
    sc.sent_count AS delivered,
    sc.sent_count,
    NULL::BIGINT AS hard_bounced,
    NULL::BIGINT AS soft_bounced,
    sc.failed_count AS failed_other,
    sc.failed_count,
    NULL::BIGINT AS opened,
    sc.click_count AS open_count,
    sc.click_count AS clicked,
    sc.click_count,
    sc.unsubscribe_count AS unsubscribed,
    sc.unsubscribe_count,
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
    sc.selected_gateway_ids
  FROM private.sms_campaigns sc
  WHERE sc.user_id = auth.uid()
  
  ORDER BY created_at DESC;
END;
$$;

-- Function to get SMS campaigns overview with fleet mode
CREATE OR REPLACE FUNCTION public.get_sms_campaigns_overview()
RETURNS TABLE (
  id UUID,
  sender_name TEXT,
  provider TEXT,
  recipient_count BIGINT,
  sent_count BIGINT,
  failed_count BIGINT,
  click_count BIGINT,
  unsubscribe_count BIGINT,
  status TEXT,
  created_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  use_short_links BOOLEAN,
  fleet_mode_enabled BOOLEAN,
  selected_gateway_ids UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sc.id,
    sc.sender_name,
    sc.provider,
    sc.recipient_count,
    sc.sent_count,
    sc.failed_count,
    sc.click_count,
    sc.unsubscribe_count,
    sc.status::TEXT,
    sc.created_at,
    sc.started_at,
    sc.completed_at,
    sc.use_short_links,
    sc.fleet_mode_enabled,
    sc.selected_gateway_ids
  FROM private.sms_campaigns sc
  WHERE sc.user_id = auth.uid()
  ORDER BY sc.created_at DESC;
END;
$$;

-- Function to reset gateway counters daily
CREATE OR REPLACE FUNCTION private.reset_daily_gateway_counters()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE private.sms_fleet_gateways
  SET 
    sent_today = 0,
    last_reset_at = NOW()
  WHERE last_reset_at < CURRENT_DATE;
END;
$$;

-- Function to reset gateway counters monthly  
CREATE OR REPLACE FUNCTION private.reset_monthly_gateway_counters()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE private.sms_fleet_gateways
  SET 
    sent_this_month = 0,
    sent_today = 0,
    last_reset_at = NOW()
  WHERE last_reset_at < DATE_TRUNC('month', NOW());
END;
$$;

-- Grant necessary permissions
GRANT ALL ON private.sms_fleet_gateways TO authenticated;
GRANT ALL ON private.sms_campaign_recipient_gateways TO authenticated;
