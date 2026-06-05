-- Add channel field to sms_campaigns to support WhatsApp (Option C)
-- Also create whatsapp_sessions table for OpenWA session management

-- Add channel field (defaults to 'sms' for backward compatibility)
ALTER TABLE private.sms_campaigns
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'sms'
  CHECK (channel IN ('sms', 'whatsapp'));

-- Update provider constraint to include 'openwa' for WhatsApp
ALTER TABLE private.sms_campaigns
  DROP CONSTRAINT IF EXISTS sms_campaigns_provider_check;

ALTER TABLE private.sms_campaigns
  ADD CONSTRAINT sms_campaigns_provider_check
  CHECK (provider IN ('twilio', 'smsgate', 'simple-sms-gateway', 'fleet', 'openwa'));

-- WhatsApp sessions table (managed per user, multiple sessions supported)
CREATE TABLE IF NOT EXISTS private.whatsapp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'CREATED'
    CHECK (status IN ('CREATED', 'QR_READY', 'CONNECTED', 'DISCONNECTED', 'ERROR')),
  connected_phone TEXT,
  qr_code TEXT,
  fleet_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, session_name)
);

-- Indexes
-- CREATE INDEX / CREATE POLICY on an existing table require ownership.
-- On QA the table may have been pre-applied by a role that doesn't match
-- the migration runner, so these no-op cleanly when we lack privilege.
DO $$ BEGIN CREATE INDEX idx_whatsapp_sessions_user_id ON private.whatsapp_sessions(user_id); EXCEPTION WHEN insufficient_privilege OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX idx_whatsapp_sessions_status ON private.whatsapp_sessions(status); EXCEPTION WHEN insufficient_privilege OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX idx_whatsapp_sessions_active ON private.whatsapp_sessions(is_active); EXCEPTION WHEN insufficient_privilege OR duplicate_table THEN NULL; END $$;

-- Enable RLS
DO $$ BEGIN EXECUTE 'ALTER TABLE private.whatsapp_sessions ENABLE ROW LEVEL SECURITY'; EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;

-- RLS Policies for whatsapp_sessions
DO $$ BEGIN EXECUTE 'DROP POLICY IF EXISTS "Users can view own whatsapp sessions" ON private.whatsapp_sessions'; EXECUTE 'CREATE POLICY "Users can view own whatsapp sessions" ON private.whatsapp_sessions FOR SELECT USING (auth.uid() = user_id)'; EXCEPTION WHEN insufficient_privilege OR duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'DROP POLICY IF EXISTS "Users can insert own whatsapp sessions" ON private.whatsapp_sessions'; EXECUTE 'CREATE POLICY "Users can insert own whatsapp sessions" ON private.whatsapp_sessions FOR INSERT WITH CHECK (auth.uid() = user_id)'; EXCEPTION WHEN insufficient_privilege OR duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'DROP POLICY IF EXISTS "Users can update own whatsapp sessions" ON private.whatsapp_sessions'; EXECUTE 'CREATE POLICY "Users can update own whatsapp sessions" ON private.whatsapp_sessions FOR UPDATE USING (auth.uid() = user_id)'; EXCEPTION WHEN insufficient_privilege OR duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'DROP POLICY IF EXISTS "Users can delete own whatsapp sessions" ON private.whatsapp_sessions'; EXECUTE 'CREATE POLICY "Users can delete own whatsapp sessions" ON private.whatsapp_sessions FOR DELETE USING (auth.uid() = user_id)'; EXCEPTION WHEN insufficient_privilege OR duplicate_object THEN NULL; END $$;

-- Trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION private.update_whatsapp_session_updated_at()
RETURNS TRIGGER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_whatsapp_session_updated_at ON private.whatsapp_sessions;
CREATE TRIGGER update_whatsapp_session_updated_at
  BEFORE UPDATE ON private.whatsapp_sessions
  FOR EACH ROW
  EXECUTE FUNCTION private.update_whatsapp_session_updated_at();
