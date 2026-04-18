-- ============================================================================
-- Idempotent SQL script to fix SMS campaign schema for self-hosted Supabase
-- ============================================================================
-- Run this via:
--   Option A: Supabase Studio > SQL Editor > Paste & Run
--   Option B: docker exec -i <db-container> psql -U supabase_admin -d postgres < fix_sms_schema_self_hosted.sql
--
-- This script consolidates all SMS-related schema changes that may not have
-- been applied. It is safe to run multiple times (all statements are idempotent).
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. FIX: Drop sender_phone column if it still exists (NOT NULL causes insert failures)
-- ============================================================================
ALTER TABLE private.sms_campaigns
  DROP COLUMN IF EXISTS sender_phone;

-- ============================================================================
-- 2. FIX: Update provider CHECK constraint to include 'fleet'
-- This is the MAIN root cause of the 500 CREATE_FAILED error when using fleet mode
-- ============================================================================
DO $$
DECLARE
  _constraint_name TEXT;
BEGIN
  -- Drop the named constraint if it exists
  ALTER TABLE private.sms_campaigns DROP CONSTRAINT IF EXISTS sms_campaigns_provider_check;

  -- Also drop any auto-generated constraint name pattern
  SELECT conname INTO _constraint_name
  FROM pg_constraint
  WHERE conrelid = 'private.sms_campaigns'::regclass
    AND contype = 'c'
    AND conname LIKE '%provider%check%'
  LIMIT 1;

  IF _constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE private.sms_campaigns DROP CONSTRAINT %I', _constraint_name);
  END IF;
END $$;

-- Add the updated constraint with 'fleet' included
ALTER TABLE private.sms_campaigns
  ADD CONSTRAINT sms_campaigns_provider_check
  CHECK (provider IN ('twilio', 'smsgate', 'simple-sms-gateway', 'fleet'));

-- ============================================================================
-- 3. Add footer_text_template column if missing
-- ============================================================================
ALTER TABLE private.sms_campaigns
  ADD COLUMN IF NOT EXISTS footer_text_template TEXT;

-- ============================================================================
-- 4. Add personalization_data column to recipients if missing
-- ============================================================================
ALTER TABLE private.sms_campaign_recipients
  ADD COLUMN IF NOT EXISTS personalization_data JSONB;

-- ============================================================================
-- 5. Add fleet mode columns to sms_campaigns if missing
-- ============================================================================
ALTER TABLE private.sms_campaigns
  ADD COLUMN IF NOT EXISTS fleet_mode_enabled BOOLEAN DEFAULT false;

ALTER TABLE private.sms_campaigns
  ADD COLUMN IF NOT EXISTS selected_gateway_ids UUID[] DEFAULT '{}';

-- ============================================================================
-- 6. Fix use_short_links default and NOT NULL
-- ============================================================================
ALTER TABLE private.sms_campaigns
  ALTER COLUMN use_short_links SET DEFAULT true;

ALTER TABLE private.sms_campaigns
  ALTER COLUMN use_short_links SET NOT NULL;

-- ============================================================================
-- 7. Add unsubscribe_short_token column to recipients if missing
-- ============================================================================
ALTER TABLE private.sms_campaign_recipients
  ADD COLUMN IF NOT EXISTS unsubscribe_short_token TEXT;

-- ============================================================================
-- 8. Create sms_fleet_gateways table if not exists
-- ============================================================================
CREATE TABLE IF NOT EXISTS private.sms_fleet_gateways (
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

-- Indexes for fleet gateways (safe to run multiple times)
CREATE INDEX IF NOT EXISTS idx_sms_fleet_gateways_user_id ON private.sms_fleet_gateways(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_fleet_gateways_user_active ON private.sms_fleet_gateways(user_id, is_active);

-- Enable RLS on fleet gateways
ALTER TABLE private.sms_fleet_gateways ENABLE ROW LEVEL SECURITY;

-- RLS Policies for fleet gateways (create if not exists using DO block)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view own fleet gateways' AND polrelid = 'private.sms_fleet_gateways'::regclass) THEN
    CREATE POLICY "Users can view own fleet gateways"
      ON private.sms_fleet_gateways FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can insert own fleet gateways' AND polrelid = 'private.sms_fleet_gateways'::regclass) THEN
    CREATE POLICY "Users can insert own fleet gateways"
      ON private.sms_fleet_gateways FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can update own fleet gateways' AND polrelid = 'private.sms_fleet_gateways'::regclass) THEN
    CREATE POLICY "Users can update own fleet gateways"
      ON private.sms_fleet_gateways FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can delete own fleet gateways' AND polrelid = 'private.sms_fleet_gateways'::regclass) THEN
    CREATE POLICY "Users can delete own fleet gateways"
      ON private.sms_fleet_gateways FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================================
-- 9. Create sms_campaign_recipient_gateways table if not exists
-- ============================================================================
CREATE TABLE IF NOT EXISTS private.sms_campaign_recipient_gateways (
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
CREATE INDEX IF NOT EXISTS idx_sms_campaign_recipient_gateways_campaign ON private.sms_campaign_recipient_gateways(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sms_campaign_recipient_gateways_gateway ON private.sms_campaign_recipient_gateways(gateway_id);

-- Enable RLS
ALTER TABLE private.sms_campaign_recipient_gateways ENABLE ROW LEVEL SECURITY;

-- RLS policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view own recipient gateways' AND polrelid = 'private.sms_campaign_recipient_gateways'::regclass) THEN
    CREATE POLICY "Users can view own recipient gateways"
      ON private.sms_campaign_recipient_gateways FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM private.sms_campaigns
          WHERE id = campaign_id AND user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can insert own recipient gateways' AND polrelid = 'private.sms_campaign_recipient_gateways'::regclass) THEN
    CREATE POLICY "Users can insert own recipient gateways"
      ON private.sms_campaign_recipient_gateways FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM private.sms_campaigns
          WHERE id = campaign_id AND user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================================================
-- 10. Remove simple_sms_gateway_username/password from profiles if still present
-- ============================================================================
ALTER TABLE private.profiles
  DROP COLUMN IF EXISTS simple_sms_gateway_username,
  DROP COLUMN IF EXISTS simple_sms_gateway_password;

-- ============================================================================
-- 11. Add simple_sms_gateway_base_url to profiles if missing
-- ============================================================================
ALTER TABLE private.profiles
  ADD COLUMN IF NOT EXISTS simple_sms_gateway_base_url TEXT;

-- ============================================================================
-- 12. Add service role RLS policies for sms_campaigns (edge function uses service_role key)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Service role can insert sms campaigns' AND polrelid = 'private.sms_campaigns'::regclass) THEN
    CREATE POLICY "Service role can insert sms campaigns"
      ON private.sms_campaigns FOR INSERT
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Service role can select sms campaigns' AND polrelid = 'private.sms_campaigns'::regclass) THEN
    CREATE POLICY "Service role can select sms campaigns"
      ON private.sms_campaigns FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Service role can update sms campaigns' AND polrelid = 'private.sms_campaigns'::regclass) THEN
    CREATE POLICY "Service role can update sms campaigns"
      ON private.sms_campaigns FOR UPDATE
      USING (true);
  END IF;
END $$;

-- Service role policies for sms_campaign_recipients
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Service role can insert sms recipients' AND polrelid = 'private.sms_campaign_recipients'::regclass) THEN
    CREATE POLICY "Service role can insert sms recipients"
      ON private.sms_campaign_recipients FOR INSERT
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Service role can select sms recipients' AND polrelid = 'private.sms_campaign_recipients'::regclass) THEN
    CREATE POLICY "Service role can select sms recipients"
      ON private.sms_campaign_recipients FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Service role can update sms recipients' AND polrelid = 'private.sms_campaign_recipients'::regclass) THEN
    CREATE POLICY "Service role can update sms recipients"
      ON private.sms_campaign_recipients FOR UPDATE
      USING (true);
  END IF;
END $$;

-- Service role policies for sms_campaign_link_clicks
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Service role can insert sms link clicks' AND polrelid = 'private.sms_campaign_link_clicks'::regclass) THEN
    CREATE POLICY "Service role can insert sms link clicks"
      ON private.sms_campaign_link_clicks FOR INSERT
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Service role can select sms link clicks' AND polrelid = 'private.sms_campaign_link_clicks'::regclass) THEN
    CREATE POLICY "Service role can select sms link clicks"
      ON private.sms_campaign_link_clicks FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Service role can update sms link clicks' AND polrelid = 'private.sms_campaign_link_clicks'::regclass) THEN
    CREATE POLICY "Service role can update sms link clicks"
      ON private.sms_campaign_link_clicks FOR UPDATE
      USING (true);
  END IF;
END $$;

-- Service role policies for sms_campaign_unsubscribes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Service role can insert sms unsubscribes' AND polrelid = 'private.sms_campaign_unsubscribes'::regclass) THEN
    CREATE POLICY "Service role can insert sms unsubscribes"
      ON private.sms_campaign_unsubscribes FOR INSERT
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Service role can select sms unsubscribes' AND polrelid = 'private.sms_campaign_unsubscribes'::regclass) THEN
    CREATE POLICY "Service role can select sms unsubscribes"
      ON private.sms_campaign_unsubscribes FOR SELECT
      USING (true);
  END IF;
END $$;

-- Service role policies for sms_fleet_gateways
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Service role can manage fleet gateways' AND polrelid = 'private.sms_fleet_gateways'::regclass) THEN
    CREATE POLICY "Service role can manage fleet gateways"
      ON private.sms_fleet_gateways FOR ALL
      USING (true);
  END IF;
END $$;

-- Service role policies for sms_campaign_recipient_gateways
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Service role can manage recipient gateways' AND polrelid = 'private.sms_campaign_recipient_gateways'::regclass) THEN
    CREATE POLICY "Service role can manage recipient gateways"
      ON private.sms_campaign_recipient_gateways FOR ALL
      USING (true);
  END IF;
END $$;

-- ============================================================================
-- 13. Create/update functions for campaign overview
-- ============================================================================

-- get_sms_campaigns_overview (updated with fleet mode columns)
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

-- get_unified_campaigns_overview (updated with fleet mode)
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

-- ============================================================================
-- 14. Create gateway counter reset functions
-- ============================================================================

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

-- ============================================================================
-- 15. Grant permissions
-- ============================================================================
GRANT ALL ON private.sms_fleet_gateways TO authenticated;
GRANT ALL ON private.sms_campaign_recipient_gateways TO authenticated;

COMMIT;