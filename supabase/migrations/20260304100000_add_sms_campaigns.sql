-- SMS Campaign status enum
CREATE TYPE private.sms_campaign_status AS ENUM (
  'queued',
  'processing',
  'completed',
  'failed',
  'cancelled'
);

-- SMS Campaign recipient status enum
CREATE TYPE private.sms_campaign_recipient_status AS ENUM (
  'pending',
  'sent',
  'failed',
  'skipped'
);

-- SMS Campaigns table
CREATE TABLE private.sms_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_phone TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('twilio', 'smsgate')),
  message_template TEXT NOT NULL,
  use_short_links BOOLEAN DEFAULT false,
  recipient_count INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  unsubscribe_count INTEGER DEFAULT 0,
  status private.sms_campaign_status DEFAULT 'queued',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- SMS Campaign recipients table
CREATE TABLE private.sms_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES private.sms_campaigns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES private.persons(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  send_status private.sms_campaign_recipient_status DEFAULT 'pending',
  provider_message_id TEXT,
  provider_error TEXT,
  attempt_count INTEGER DEFAULT 0,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SMS Campaign link clicks table
CREATE TABLE private.sms_campaign_link_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES private.sms_campaigns(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES private.sms_campaign_recipients(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  url TEXT NOT NULL,
  clicked_at TIMESTAMPTZ DEFAULT NOW()
);

-- SMS Campaign unsubscribes table
CREATE TABLE private.sms_campaign_unsubscribes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  campaign_id UUID REFERENCES private.sms_campaigns(id) ON DELETE SET NULL,
  unsubscribed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, phone)
);

-- Indexes for performance
CREATE INDEX idx_sms_campaigns_user_id ON private.sms_campaigns(user_id);
CREATE INDEX idx_sms_campaigns_status ON private.sms_campaigns(status);
CREATE INDEX idx_sms_campaign_recipients_campaign_id ON private.sms_campaign_recipients(campaign_id);
CREATE INDEX idx_sms_campaign_recipients_send_status ON private.sms_campaign_recipients(send_status);
CREATE INDEX idx_sms_campaign_link_clicks_token ON private.sms_campaign_link_clicks(token);
CREATE INDEX idx_sms_campaign_unsubscribes_user_phone ON private.sms_campaign_unsubscribes(user_id, phone);

-- Enable RLS
ALTER TABLE private.sms_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.sms_campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.sms_campaign_link_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.sms_campaign_unsubscribes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sms_campaigns
CREATE POLICY "Users can view own sms campaigns"
  ON private.sms_campaigns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sms campaigns"
  ON private.sms_campaigns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sms campaigns"
  ON private.sms_campaigns FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sms campaigns"
  ON private.sms_campaigns FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for sms_campaign_recipients
CREATE POLICY "Users can view own sms recipients"
  ON private.sms_campaign_recipients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private.sms_campaigns
      WHERE id = campaign_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own sms recipients"
  ON private.sms_campaign_recipients FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM private.sms_campaigns
      WHERE id = campaign_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own sms recipients"
  ON private.sms_campaign_recipients FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM private.sms_campaigns
      WHERE id = campaign_id AND user_id = auth.uid()
    )
  );

-- RLS Policies for sms_campaign_link_clicks
CREATE POLICY "Anyone can track sms clicks"
  ON private.sms_campaign_link_clicks FOR SELECT
  USING (true);

CREATE POLICY "Users can insert sms link clicks"
  ON private.sms_campaign_link_clicks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM private.sms_campaigns
      WHERE id = campaign_id AND user_id = auth.uid()
    )
  );

-- RLS Policies for sms_campaign_unsubscribes
CREATE POLICY "Users can view own unsubscribes"
  ON private.sms_campaign_unsubscribes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own unsubscribes"
  ON private.sms_campaign_unsubscribes FOR INSERT
  WITH CHECK (auth.uid() = user_id);