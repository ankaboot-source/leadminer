-- SMS Fleet Gateways persistence table
-- Stores gateway configurations for fleet mode SMS campaigns

CREATE TABLE IF NOT EXISTS sms_fleet_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL,
  base_url TEXT,
  api_key TEXT NOT NULL,
  sender_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_sms_fleet_gateways_user_id ON sms_fleet_gateways(user_id);
CREATE INDEX idx_sms_fleet_gateways_provider ON sms_fleet_gateways(provider);
CREATE INDEX idx_sms_fleet_gateways_is_active ON sms_fleet_gateways(is_active);

-- Enable Row Level Security
ALTER TABLE sms_fleet_gateways ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only access their own gateways
CREATE POLICY "Users can view their own gateways"
  ON sms_fleet_gateways FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own gateways"
  ON sms_fleet_gateways FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own gateways"
  ON sms_fleet_gateways FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own gateways"
  ON sms_fleet_gateways FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sms_fleet_gateways_updated_at
  BEFORE UPDATE ON sms_fleet_gateways
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();