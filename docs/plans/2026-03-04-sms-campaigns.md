# SMS Campaigns Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add SMS campaign functionality with Twilio and SMSGate providers, unified composer with email/SMS split, quota enforcement, and optional short links.

**Architecture:**

- New edge function `sms-campaigns` with provider abstraction (Twilio/SMSGate adapters)
- DB migration for SMS campaign tables + extended campaign overview RPC
- Frontend: update composer dialog with channel split, SMS provider selector, char counter
- Campaigns list shows channel badge + conditional metrics

**Tech Stack:** Supabase Edge Functions (Deno), PostgreSQL, Vue/Nuxt frontend

---

## Phase 1: DB Migration + Campaign Overview RPC

### Task 1: Create SMS campaign tables

**Files:**

- Create: `supabase/migrations/20260304000000_add_sms_campaigns.sql`

**Step 1: Write the migration**

```sql
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
  daily_limit INTEGER DEFAULT 200,
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
```

**Step 2: Commit**

```bash
git add supabase/migrations/20260304000000_add_sms_campaigns.sql
git commit -m "feat: add SMS campaign tables and RLS policies"
```

---

### Task 2: Extend campaign overview RPC

**Files:**

- Modify: `supabase/migrations/20260304000000_add_sms_campaigns.sql` (add RPC function)
- Or create: `supabase/migrations/20260304000001_update_campaign_overview_rpc.sql`

**Step 1: Add RPC function for unified campaign overview**

```sql
CREATE OR REPLACE FUNCTION private.get_campaigns_overview(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  channel TEXT,
  status TEXT,
  recipient_count INTEGER,
  sent_count INTEGER,
  failed_count INTEGER,
  click_count INTEGER,
  unsubscribe_count INTEGER,
  open_count INTEGER,
  created_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.user_id,
    'email'::TEXT AS channel,
    c.status::TEXT,
    c.recipient_count,
    c.sent_count,
    c.failed_count,
    COALESCE((SELECT COUNT(*) FROM private.email_campaign_link_clicks cl
              WHERE cl.campaign_id = c.id), 0)::INTEGER AS click_count,
    COALESCE((SELECT COUNT(*) FROM private.email_campaign_unsubscribes u
              WHERE u.campaign_id = c.id), 0)::INTEGER AS unsubscribe_count,
    COALESCE((SELECT COUNT(DISTINCT recipient_id) FROM private.email_campaign_opens o
              WHERE o.campaign_id = c.id), 0)::INTEGER AS open_count,
    c.created_at,
    c.started_at,
    c.completed_at
  FROM private.email_campaigns c
  WHERE c.user_id = p_user_id

  UNION ALL

  SELECT
    s.id,
    s.user_id,
    'sms'::TEXT AS channel,
    s.status::TEXT,
    s.recipient_count,
    s.sent_count,
    s.failed_count,
    COALESCE((SELECT COUNT(*) FROM private.sms_campaign_link_clicks cl
              WHERE cl.campaign_id = s.id), 0)::INTEGER AS click_count,
    COALESCE((SELECT COUNT(*) FROM private.sms_campaign_unsubscribes u
              WHERE u.campaign_id = s.id), 0)::INTEGER AS unsubscribe_count,
    NULL::INTEGER AS open_count,
    s.created_at,
    s.started_at,
    s.completed_at
  FROM private.sms_campaigns s
  WHERE s.user_id = p_user_id
  ORDER BY created_at DESC;
END;
$$;
```

**Step 2: Commit**

```bash
git add supabase/migrations/20260304000001_update_campaign_overview_rpc.sql
git commit -m "feat: extend campaign overview RPC for unified email+sms"
```

---

## Phase 2: SMS Edge Function

### Task 3: Create SMS campaigns edge function scaffold

**Files:**

- Create: `supabase/functions/sms-campaigns/index.ts`

**Step 1: Write the edge function skeleton**

```typescript
import { Hono } from "hono";
import { createSupabaseAdmin } from "../_shared/supabase.ts";
import { corsHeaders } from "../_shared/cors.ts";

const app = new Hono();

app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  await next();
});

app.get("/health", (c) => c.json({ status: "ok", service: "sms-campaigns" }));

export default app;
```

**Step 2: Commit**

```bash
git add supabase/functions/sms-campaigns/index.ts
git commit -m "feat: scaffold sms-campaigns edge function"
```

---

### Task 4: Add SMS provider abstraction

**Files:**

- Create: `supabase/functions/sms-campaigns/providers/mod.ts`
- Create: `supabase/functions/sms-campaigns/providers/twilio-provider.ts`
- Create: `supabase/functions/sms-campaigns/providers/smsgate-provider.ts`
- Create: `supabase/functions/sms-campaigns/providers/types.ts`

**Step 1: Write provider types**

```typescript
// supabase/functions/sms-campaigns/providers/types.ts

export interface SmsProvider {
  name: string;
  send(params: SendSmsParams): Promise<SendSmsResult>;
}

export interface SendSmsParams {
  to: string;
  from: string;
  body: string;
}

export interface SendSmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
```

**Step 2: Write Twilio provider**

```typescript
// supabase/functions/sms-campaigns/providers/twilio-provider.ts
import type { SmsProvider, SendSmsParams, SendSmsResult } from "./types.ts";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;

export class TwilioProvider implements SmsProvider {
  name = "twilio";

  async send(params: SendSmsParams): Promise<SendSmsResult> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: params.to,
          From: params.from,
          Body: params.body,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || "Twilio error",
        };
      }

      return {
        success: true,
        messageId: data.sid,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
```

**Step 3: Write SMSGate provider**

```typescript
// supabase/functions/sms-campaigns/providers/smsgate-provider.ts
import type { SmsProvider, SendSmsParams, SendSmsResult } from "./types.ts";

const SMSGATE_BASE_URL =
  Deno.env.get("SMSGATE_BASE_URL") || "https://api.sms-gate.app";
const SMSGATE_USERNAME = Deno.env.get("SMSGATE_USERNAME")!;
const SMSGATE_PASSWORD = Deno.env.get("SMSGATE_PASSWORD")!;

export class SmsGateProvider implements SmsProvider {
  name = "smsgate";

  async send(params: SendSmsParams): Promise<SendSmsResult> {
    const url = `${SMSGATE_BASE_URL}/3rdparty/v1/messages`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumber: params.to,
          sender: params.from,
          message: params.body,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || "SMSGate error",
        };
      }

      return {
        success: true,
        messageId: data.id || data.messageId,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
```

**Step 4: Write provider factory**

```typescript
// supabase/functions/sms-campaigns/providers/mod.ts
import type { SmsProvider } from "./types.ts";
import { TwilioProvider } from "./twilio-provider.ts";
import { SmsGateProvider } from "./smsgate-provider.ts";

export type { SmsProvider, SendSmsParams, SendSmsResult } from "./types.ts";

export function createSmsProvider(type: "twilio" | "smsgate"): SmsProvider {
  switch (type) {
    case "twilio":
      return new TwilioProvider();
    case "smsgate":
      return new SmsGateProvider();
    default:
      throw new Error(`Unknown SMS provider: ${type}`);
  }
}
```

**Step 5: Commit**

```bash
git add supabase/functions/sms-campaigns/providers/
git commit -m "feat: add SMS provider abstraction (Twilio + SMSGate)"
```

---

### Task 5: Implement SMS campaign endpoints

**Files:**

- Modify: `supabase/functions/sms-campaigns/index.ts`

**Step 1: Add campaign endpoints (create, preview, status, stop, delete)**

```typescript
// Add imports and implementation after the scaffold
// ... (full implementation follows patterns from email-campaigns)
```

**Step 2: Commit**

```bash
git add supabase/functions/sms-campaigns/index.ts
git commit -m "feat: implement SMS campaign endpoints"
```

---

### Task 6: Add short-link utility

**Files:**

- Create: `supabase/functions/sms-campaigns/utils/short-link.ts`

**Step 1: Write short-link function**

```typescript
// supabase/functions/sms-campaigns/utils/short-link.ts

export async function shortenUrl(longUrl: string): Promise<string | null> {
  try {
    const url = new URL("https://is.gd/create.php");
    url.searchParams.set("format", "simple");
    url.searchParams.set("url", longUrl);

    const response = await fetch(url.toString());

    if (!response.ok) {
      return null;
    }

    const shortUrl = await response.text();

    if (shortUrl.startsWith("Error:")) {
      return null;
    }

    return shortUrl.trim();
  } catch {
    return null;
  }
}
```

**Step 2: Commit**

```bash
git add supabase/functions/sms-campaigns/utils/short-link.ts
git commit -m "feat: add short-link utility using is.gd"
```

---

### Task 7: Add quota enforcement

**Files:**

- Create: `supabase/functions/sms-campaigns/utils/quota.ts`
- Modify: `supabase/functions/sms-campaigns/index.ts`

**Step 1: Write quota utility**

```typescript
// supabase/functions/sms-campaigns/utils/quota.ts

interface QuotaConfig {
  dailyLimit: number;
  monthlyRecipientLimit: number;
}

function getEnvQuota(key: string, defaultValue: number): number {
  const value = Deno.env.get(key);
  if (!value || value === "") {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    console.warn(`Invalid ${key}, using default: ${defaultValue}`);
    return defaultValue;
  }
  return parsed;
}

export function getSmsQuota(): QuotaConfig {
  return {
    dailyLimit: getEnvQuota("SMS_CAMPAIGN_DAILY_LIMIT", 200),
    monthlyRecipientLimit: getEnvQuota(
      "SMS_CAMPAIGN_MONTHLY_RECIPIENT_LIMIT",
      200,
    ),
  };
}

export function getLocalTimeBounds(timezone: string): {
  dayStart: Date;
  monthStart: Date;
} {
  const now = new Date();

  const dayStart = new Date(
    now.toLocaleString("en-US", { timeZone: timezone }),
  );
  dayStart.setHours(0, 0, 0, 0);

  const monthStart = new Date(
    now.toLocaleString("en-US", { timeZone: timezone }),
  );
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  return { dayStart, monthStart };
}
```

**Step 2: Commit**

```bash
git add supabase/functions/sms-campaigns/utils/quota.ts
git commit -m "feat: add SMS quota enforcement utility"
```

---

## Phase 3: Frontend Composer Updates

### Task 8: Update campaign types

**Files:**

- Modify: `frontend/src/types/campaign.ts`

**Step 1: Add channel and SMS-specific types**

```typescript
// Add to existing campaign.ts

export type CampaignChannel = "email" | "sms";

export interface SmsCampaign extends Campaign {
  channel: "sms";
  provider: "twilio" | "smsgate";
  senderPhone: string;
  messageTemplate: string;
  useShortLinks: boolean;
}
```

**Step 2: Commit**

```bash
git add frontend/src/types/campaign.ts
git commit -m "feat: add SMS campaign types"
```

---

### Task 9: Update campaigns store

**Files:**

- Modify: `frontend/src/stores/campaigns.ts`

**Step 1: Update store to handle channel**

```typescript
// Add channel to CampaignOverview interface
export interface CampaignOverview {
  id: string;
  user_id: string;
  channel: "email" | "sms";
  status: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  click_count: number;
  unsubscribe_count: number;
  open_count: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}
```

**Step 2: Commit**

```bash
git add frontend/src/stores/campaigns.ts
git commit -m "feat: update campaigns store for channel field"
```

---

### Task 10: Update composer dialog

**Files:**

- Modify: `frontend/src/components/campaigns/CampaignComposerDialog.vue`

**Step 1: Add channel selector and SMS fields**

```vue
<template>
  <!-- Add channel selector -->
  <div class="channel-selector">
    <SelectButton
      v-model="form.channel"
      :options="channelOptions"
      optionLabel="label"
      optionValue="value"
    />
  </div>

  <!-- SMS-specific fields -->
  <div v-if="form.channel === 'sms'" class="sms-fields">
    <Select
      v-model="form.provider"
      :options="providerOptions"
      label="Provider"
    />
    <InputTextarea
      v-model="form.messageTemplate"
      :counter="smsCharCount"
      :max-chars="1600"
    />
    <div class="sms-counter">{{ smsCharCount }} / {{ smsParts }} SMS</div>
    <Checkbox v-model="form.useShortLinks" label="Use short links" />
  </div>
</template>
```

**Step 2: Add SMS char counter logic**

```typescript
const smsCharCount = computed(() => form.value.messageTemplate?.length || 0);

const smsEncoding = computed(() => {
  const text = form.value.messageTemplate || "";
  return /[^\u0000-\u007F]/.test(text) ? "Unicode" : "GSM-7";
});

const smsParts = computed(() => {
  const text = form.value.messageTemplate || "";
  const isUnicode = smsEncoding.value === "Unicode";
  const maxPerSms = isUnicode ? 70 : 160;
  return Math.ceil(text.length / maxPerSms);
});
```

**Step 3: Commit**

```bash
git add frontend/src/components/campaigns/CampaignComposerDialog.vue
git commit -m "feat: add SMS channel and provider selector to composer"
```

---

### Task 11: Update campaigns page

**Files:**

- Modify: `frontend/src/pages/campaigns.vue`

**Step 1: Add channel badge and conditional metrics**

```vue
<template>
  <!-- In campaign row -->
  <Tag
    :value="campaign.channel"
    :severity="campaign.channel === 'sms' ? 'info' : 'primary'"
  />

  <!-- Conditional metrics -->
  <template v-if="campaign.channel === 'sms'">
    <span
      >{{ t("delivery") }}: {{ campaign.sent_count }}/{{
        campaign.recipient_count
      }}</span
    >
    <span>{{ t("clicks") }}: {{ campaign.click_count }}</span>
  </template>
  <template v-else>
    <!-- existing email metrics -->
  </template>
</template>
```

**Step 2: Commit**

```bash
git add frontend/src/pages/campaigns.vue
git commit -m "feat: add channel badge and SMS metrics to campaigns list"
```

---

## Phase 4: Tests

### Task 12: Add provider tests

**Files:**

- Create: `supabase/functions/sms-campaigns/providers/twilio-provider.test.ts`
- Create: `supabase/functions/sms-campaigns/providers/smsgate-provider.test.ts`

**Step 1: Write tests**

```typescript
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { TwilioProvider } from "./twilio-provider.ts";

Deno.test("TwilioProvider sends SMS", async () => {
  const provider = new TwilioProvider();
  const result = await provider.send({
    to: "+1234567890",
    from: "+0987654321",
    body: "Test message",
  });

  // Mock test would go here
});
```

**Step 2: Commit**

```bash
git add supabase/functions/sms-campaigns/providers/*.test.ts
git commit -m "test: add SMS provider tests"
```

---

## Phase 5: Env Config

### Task 13: Document env vars

**Files:**

- Modify: `.env.example` or create env var documentation

**Step 1: Add to .env.example**

```bash
# SMS Campaign Limits (optional, defaults shown)
SMS_CAMPAIGN_DAILY_LIMIT=200
SMS_CAMPAIGN_MONTHLY_RECIPIENT_LIMIT=200

# Twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_FROM_NUMBER=+1234567890

# SMSGate
SMSGATE_BASE_URL=https://api.sms-gate.app
SMSGATE_USERNAME=your_username
SMSGATE_PASSWORD=your_password
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: add SMS campaign env vars to .env.example"
```

---

## Rollout Order

1. DB migration + RPC (Task 1-2)
2. Edge function scaffold (Task 3)
3. Provider abstraction (Task 4)
4. Campaign endpoints (Task 5)
5. Short-link utility (Task 6)
6. Quota enforcement (Task 7)
7. Frontend types + store (Task 8-9)
8. Composer dialog updates (Task 10)
9. Campaigns page updates (Task 11)
10. Tests (Task 12)
11. Env documentation (Task 13)
