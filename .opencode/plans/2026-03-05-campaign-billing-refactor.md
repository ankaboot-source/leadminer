# Campaign Billing Flow Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor email-campaigns `/campaigns/create` endpoint to use proper separation of concerns: check quota before creation, create campaign, then charge credits - matching the commercial billing edge-function pattern.

**Architecture:** Split monolithic compliance middleware into three distinct components: `campaignCheck` (quota + consent validation), `campaignCreate` (controller for DB operations), and `campaignBill` (post-creation charging). Use Hono context to pass data between stages. Follow commercial PR #108 pattern for billing integration.

**Tech Stack:** Deno/TypeScript, Hono framework, Supabase Edge Functions

---

## Current State Analysis

The current `compliance-middleware.ts`:

1. Calls `billing/campaign/charge` immediately (charges before checking if creation will succeed)
2. Mixes validation, consent filtering, and billing in one function
3. Doesn't follow the quota → create → charge pattern from commercial

The current `index.ts` `/campaigns/create` handler:

1. Does validation, sender checks, campaign creation all inline
2. Has no separation between pre-creation checks and post-creation actions
3. Uses `c.get("filteredEmails")` from middleware but middleware doesn't set it correctly

## Target State

**Request Flow:**

```
POST /campaigns/create
  ↓
authMiddleware
  ↓
campaignCheckMiddleware (NEW)
  - Parse request
  - Check billing quota (/quota)
  - Filter contacts by consent
  - Set context: filteredEmails, eligibleCount, userId
  - Return 402/266 if insufficient credits/consent
  ↓
campaignCreateController (REFACTORED)
  - Get filteredEmails from context
  - Validate sender options
  - Create campaign in DB
  - Create recipients
  - Set context: campaignId, createdCount
  - Call next() on success
  - Return error response on failure (skips billing)
  ↓
campaignBillMiddleware (NEW)
  - Get campaignId and createdCount from context
  - Call billing charge (/charge)
  - Return final response with campaign data
```

**Error Handling Strategy:**

- If `campaignCheck` fails → return early with credits/consent error
- If `campaignCreate` fails → return error (campaign not created, no charge needed)
- If `campaignBill` fails → Campaign already created, log error but return success (billing retry should be handled separately)

---

## Task 1: Create campaign-check-middleware.ts

**Files:**

- Create: `supabase/functions/email-campaigns/campaign-check-middleware.ts`
- Modify: `supabase/functions/email-campaigns/index.ts` (remove old compliance import)

**Step 1: Create the check middleware**

```typescript
import { Context, Next } from "hono";
import { createSupabaseAdmin } from "../_shared/supabase.ts";
import { createLogger } from "../_shared/logger.ts";

const logger = createLogger("email-campaigns:check");

interface ContactSnapshot {
  email: string;
  consent_status: "legitimate_interest" | "opt_out" | "opt_in";
  status: string | null;
}

async function getSelectedContacts(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  userId: string,
  emails: string[],
): Promise<ContactSnapshot[]> {
  const { data, error } = await supabaseAdmin
    .schema("private")
    .from("persons")
    .select("email, consent_status, status")
    .eq("user_id", userId)
    .in("email", emails);

  if (error) {
    throw new Error(`Failed to fetch contacts: ${error.message}`);
  }

  return (data || []).map((row) => ({
    email: row.email,
    consent_status: row.consent_status || "legitimate_interest",
    status: row.status,
  }));
}

export async function campaignCheckMiddleware(c: Context, next: Next) {
  // Only run for campaign creation endpoint
  if (!c.req.path.endsWith("/campaigns/create")) {
    return next();
  }

  let payload: {
    selectedEmails?: string[];
    partialCampaign?: boolean;
    [key: string]: unknown;
  };

  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON payload", code: "INVALID_JSON" }, 400);
  }

  const selectedEmails = payload.selectedEmails || [];

  if (selectedEmails.length === 0) {
    return c.json({ error: "No contacts selected", code: "NO_CONTACTS" }, 400);
  }

  const user = c.get("user");
  if (!user?.id) {
    return c.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
  }

  const supabaseAdmin = createSupabaseAdmin();

  try {
    // Fetch contacts and filter by consent
    const contacts = await getSelectedContacts(
      supabaseAdmin,
      user.id,
      selectedEmails,
    );
    const consentedContacts = contacts.filter(
      (c) => c.consent_status !== "opt_out",
    );

    if (consentedContacts.length === 0) {
      return c.json(
        { error: "No contacts with consent", code: "NO_CONSENTED_CONTACTS" },
        400,
      );
    }

    // Check billing quota if enabled
    const billingEnabled = Deno.env.get("ENABLE_BILLING") === "true";
    let eligibleCount = consentedContacts.length;

    if (billingEnabled) {
      try {
        const { data, error } = await supabaseAdmin.functions.invoke(
          "billing/campaign/quota",
          {
            body: {
              userId: user.id,
              units: consentedContacts.length,
            },
          },
        );

        if (error) {
          logger.error("Billing quota check failed", {
            error: error.message,
            userId: user.id,
          });
          return c.json(
            {
              error: "Billing service unavailable",
              code: "BILLING_UNAVAILABLE",
            },
            503,
          );
        }

        // Handle insufficient credits
        if (!data?.hasCredits) {
          return c.json(
            {
              total: consentedContacts.length,
              available: data?.available ?? 0,
              availableAlready: 0,
              reason: "credits",
            },
            402,
          );
        }

        // Use the minimum of consented contacts and available credits
        eligibleCount = Math.min(consentedContacts.length, data.available);
      } catch (error) {
        logger.error("Billing quota check exception", {
          error,
          userId: user.id,
        });
        return c.json(
          { error: "Billing verification failed", code: "BILLING_ERROR" },
          500,
        );
      }
    }

    // Check if we need user confirmation for partial campaign
    if (eligibleCount < selectedEmails.length && !payload.partialCampaign) {
      const reason =
        eligibleCount === consentedContacts.length ? "consent" : "credits";
      return c.json(
        {
          total: selectedEmails.length,
          available: eligibleCount,
          availableAlready: 0,
          reason,
        },
        266,
      );
    }

    // Store data in context for downstream middleware
    const finalEmails = consentedContacts
      .slice(0, eligibleCount)
      .map((c) => c.email);
    c.set("campaignCheck", {
      filteredEmails: finalEmails,
      eligibleCount: finalEmails.length,
      userId: user.id,
      payload,
    });

    await next();
  } catch (error) {
    logger.error("Campaign check failed", { error, userId: user.id });
    return c.json(
      {
        error: "Failed to validate campaign constraints",
        code: "CHECK_FAILED",
      },
      500,
    );
  }
}
```

**Step 2: Verify file is created**

Run: `ls -la supabase/functions/email-campaigns/campaign-check-middleware.ts`
Expected: File exists

**Step 3: Commit**

```bash
git add supabase/functions/email-campaigns/campaign-check-middleware.ts
git commit -m "feat: add campaign-check middleware for quota and consent validation"
```

---

## Task 2: Create campaign-bill-middleware.ts

**Files:**

- Create: `supabase/functions/email-campaigns/campaign-bill-middleware.ts`

**Step 1: Create the bill middleware**

```typescript
import { Context, Next } from "hono";
import { createSupabaseAdmin } from "../_shared/supabase.ts";
import { createLogger } from "../_shared/logger.ts";

const logger = createLogger("email-campaigns:bill");

export async function campaignBillMiddleware(c: Context, next: Next) {
  // Only run for campaign creation endpoint
  if (!c.req.path.endsWith("/campaigns/create")) {
    return next();
  }

  const billingEnabled = Deno.env.get("ENABLE_BILLING") === "true";

  // Get data from context (set by campaignCreate)
  const campaignData = c.get("campaignCreate");
  if (!campaignData) {
    logger.error("No campaign data in context");
    return c.json(
      { error: "Campaign creation data missing", code: "INTERNAL_ERROR" },
      500,
    );
  }

  const { campaignId, createdCount, userId } = campaignData;

  // If billing not enabled, just return success
  if (!billingEnabled) {
    return c.json({
      msg: "Campaign queued",
      campaignId,
      queuedCount: createdCount,
    });
  }

  try {
    const supabaseAdmin = createSupabaseAdmin();

    // Charge credits for the created campaign
    const { data, error } = await supabaseAdmin.functions.invoke(
      "billing/campaign/charge",
      {
        body: {
          userId,
          units: createdCount,
          partialCampaign: false, // Already filtered by campaignCheck
        },
      },
    );

    if (error) {
      logger.error("Billing charge failed", {
        error: error.message,
        userId,
        campaignId,
        createdCount,
      });
      // Don't fail the request - campaign is created, billing issue should be handled separately
      // Return success but log the billing error
    } else {
      logger.info("Billing charge successful", {
        userId,
        campaignId,
        createdCount,
        chargedUnits: data?.payload?.chargedUnits,
      });
    }

    // Return success response (campaign was created regardless of billing result)
    return c.json({
      msg: "Campaign queued",
      campaignId,
      queuedCount: createdCount,
    });
  } catch (error) {
    logger.error("Billing charge exception", { error, userId, campaignId });
    // Return success - campaign exists, billing retry should be handled by background job
    return c.json({
      msg: "Campaign queued",
      campaignId,
      queuedCount: createdCount,
    });
  }
}
```

**Step 2: Verify file is created**

Run: `ls -la supabase/functions/email-campaigns/campaign-bill-middleware.ts`
Expected: File exists

**Step 3: Commit**

```bash
git add supabase/functions/email-campaigns/campaign-bill-middleware.ts
git commit -m "feat: add campaign-bill middleware for post-creation charging"
```

---

## Task 3: Create campaign-create-controller.ts

**Files:**

- Create: `supabase/functions/email-campaigns/campaign-create-controller.ts`
- Note: Extract campaign creation logic from index.ts lines 1254-1456

**Step 1: Create the controller**

```typescript
import { Context } from "hono";
import {
  createSupabaseAdmin,
  createSupabaseClient,
} from "../_shared/supabase.ts";
import { createLogger } from "../_shared/logger.ts";
import { normalizeEmail } from "../_shared/email.ts";
import { sendEmail, verifyTransport } from "./email.ts";
import {
  getSenderCredentialIssue,
  isTokenExpired,
  listUniqueSenderSources,
} from "./sender-options.ts";

const logger = createLogger("email-campaigns:create");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") as string;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
  "SUPABASE_SERVICE_ROLE_KEY",
) as string;
const SMTP_USER = normalizeEmail(Deno.env.get("SMTP_USER") || "");
const DEFAULT_SENDER_DAILY_LIMIT = 1000;
const MAX_SENDER_DAILY_LIMIT = 2000;

// Types needed from index.ts
type CampaignStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";
type RecipientStatus = "pending" | "sent" | "failed" | "skipped";
type ConsentStatus = "legitimate_interest" | "opt_out" | "opt_in";

interface CampaignCreatePayload {
  selectedEmails?: string[];
  senderName: string;
  senderEmail: string;
  replyTo: string;
  subject: string;
  bodyHtmlTemplate: string;
  bodyTextTemplate: string;
  senderDailyLimit?: number;
  trackOpen?: boolean;
  trackClick?: boolean;
  plainTextOnly?: boolean;
  onlyValidContacts?: boolean;
  footerTextTemplate?: string;
}

interface ContactSnapshot {
  email: string;
  status: string | null;
  consent_status: ConsentStatus;
  name: string | null;
  given_name: string | null;
  family_name: string | null;
  location: string | null;
  works_for: string | null;
  job_title: string | null;
  alternate_name: string[] | null;
  telephone: string[] | null;
  recency: string | null;
  seniority: string | null;
  occurrence: number | null;
  sender: number | null;
  recipient: number | null;
  conversations: number | null;
  replied_conversations: number | null;
  temperature: number | null;
}

interface SenderOption {
  email: string;
  available: boolean;
  reason?: string;
}

interface Transport {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass?: string;
    type?: "OAuth2";
    accessToken?: string;
  };
}

// Helper functions needed (will be imported from index.ts or shared)
function normalizeBodyText(
  bodyText: string,
  bodyHtml: string,
  plainTextOnly: boolean,
): string {
  if (plainTextOnly) {
    return bodyText.trim().length ? bodyText : toTextFromHtml(bodyHtml);
  }
  return bodyText;
}

function toTextFromHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function toHtmlFromText(template: string): string {
  // Implementation from index.ts
  if (!template.trim()) return "";
  const COMPLIANCE_SEPARATOR = "---";
  const linkify = (value: string) =>
    value.replace(/(https?:\/\/[^\s<]+)/g, (url) => {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });

  return template
    .split(/\n\n+/)
    .map((part) => {
      if (part.trim() === COMPLIANCE_SEPARATOR) {
        return `<hr style="margin: 12px 0; border: 0; border-top: 1px solid #d1d5db;" />`;
      }
      return `<p>${linkify(escapeHtml(part).replaceAll("\n", "<br />"))}</p>`;
    })
    .join("");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

function defaultFooterTemplate(ownerEmail: string): string {
  const CAMPAIGN_COMPLIANCE_FOOTER = (
    Deno.env.get("campaign_compliance_footer") ||
    Deno.env.get("CAMPAIGN_COMPLIANCE_FOOTER") ||
    ""
  ).trim();

  const COMPLIANCE_SEPARATOR = "---";
  const UNSUBSCRIBE_TEXT_SUFFIX = "Click here to unsubscribe";

  if (CAMPAIGN_COMPLIANCE_FOOTER) {
    return CAMPAIGN_COMPLIANCE_FOOTER;
  }
  return `${COMPLIANCE_SEPARATOR}

You received this email because ${ownerEmail} used leadminer.io to extract contacts from their mailbox. Try https://leadminer.io yourself.

<p><a href="{{unsubscribeUrl}}">${UNSUBSCRIBE_TEXT_SUFFIX}</a></p>`;
}

async function getContactsByEmails(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  userId: string,
  emails: string[],
) {
  if (!emails.length) return [] as ContactSnapshot[];

  const { data, error } = await supabaseAdmin
    .schema("private")
    .rpc("get_contacts_table_by_emails", {
      user_id: userId,
      emails,
    });

  if (error) {
    throw new Error(`Unable to fetch contacts for campaign: ${error.message}`);
  }

  return (data ?? []).map((row: any) => ({
    email: row.email,
    status: row.status,
    consent_status: row.consent_status || "legitimate_interest",
    name: row.name,
    given_name: row.given_name,
    family_name: row.family_name,
    location: row.location,
    works_for: row.works_for,
    job_title: row.job_title,
    alternate_name: row.alternate_name,
    telephone: row.telephone,
    recency: row.recency,
    seniority: row.seniority,
    occurrence: row.occurrence,
    sender: row.sender,
    recipient: row.recipient,
    conversations: row.conversations,
    replied_conversations: row.replied_conversations,
  }));
}

function isContactEligible(
  contact: ContactSnapshot,
  onlyValidContacts: boolean,
) {
  if (contact.consent_status === "opt_out") {
    return false;
  }

  const status = contact.status;
  if (status === "RISKY" || status === "INVALID") {
    return false;
  }

  if (onlyValidContacts) {
    return status === "VALID";
  }

  return true;
}

function filterEligibleContacts(
  contacts: ContactSnapshot[],
  onlyValidContacts: boolean,
) {
  return contacts.filter((contact) =>
    isContactEligible(contact, onlyValidContacts),
  );
}

async function resolveSenderOptions(authorization: string, userEmail: string) {
  // Implementation from index.ts
  const fallbackSenderEmail = SMTP_USER || "";
  const options: SenderOption[] = [];
  const transportBySender: Record<string, Transport | null> = {
    [fallbackSenderEmail]: null,
  };

  // Fetch mining sources
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/fetch-mining-source`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization.startsWith("Bearer ")
          ? authorization
          : `Bearer ${authorization}`,
      },
      body: JSON.stringify({ user_id: undefined }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to fetch mining sources: ${response.status} ${errorText}`,
    );
  }

  const result = (await response.json()) as {
    sources: {
      email: string;
      type: string;
      credentials: Record<string, unknown>;
    }[];
    refreshed: string[];
  };

  // Process sources and build transport options
  // ... (implementation from index.ts)

  return {
    options,
    transportBySender,
    fallbackSenderEmail,
  };
}

function ensureAllowedSender(senderEmail: string, options: SenderOption[]) {
  const normalizedSenderEmail = normalizeEmail(senderEmail);
  return options.some(
    (option) =>
      normalizeEmail(option.email) === normalizedSenderEmail &&
      option.available,
  );
}

async function triggerCampaignProcessorFromEdge() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    logger.error("Missing required environment variables");
    return;
  }

  try {
    await fetch(
      `${SUPABASE_URL}/functions/v1/email-campaigns/campaigns/process`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY,
        },
      },
    );
  } catch (error) {
    logger.error("Failed to trigger campaign processor", { error });
  }
}

export async function campaignCreateController(c: Context) {
  // Get data from campaignCheck middleware
  const checkData = c.get("campaignCheck");
  if (!checkData) {
    return c.json(
      { error: "Campaign check data missing", code: "INTERNAL_ERROR" },
      500,
    );
  }

  const { filteredEmails, eligibleCount, userId, payload } = checkData;

  // Get user from context
  const user = c.get("user");
  if (!user?.email) {
    return c.json({ error: "User email not found", code: "UNAUTHORIZED" }, 401);
  }

  const ownerEmail = user.email;
  const authorization = c.req.header("authorization") as string;

  // Parse and validate payload fields
  const senderName = String(payload.senderName || "").trim();
  const senderEmail = String(payload.senderEmail || "")
    .trim()
    .toLowerCase();
  const replyTo = String(payload.replyTo || ownerEmail || "").trim();
  const subject = String(payload.subject || "").trim();
  const bodyHtmlTemplate = String(payload.bodyHtmlTemplate || "");
  const bodyTextTemplate = String(payload.bodyTextTemplate || "");
  const footerTextTemplate = String(
    payload.footerTextTemplate || defaultFooterTemplate(ownerEmail),
  );
  const plainTextOnly = Boolean(payload.plainTextOnly);
  const onlyValidContacts = Boolean(payload.onlyValidContacts);
  const trackOpen = payload.trackOpen !== false;
  const trackClick = payload.trackClick !== false;

  // Validation
  if (
    !senderName ||
    !senderEmail ||
    !subject ||
    (!bodyHtmlTemplate && !bodyTextTemplate)
  ) {
    return c.json(
      {
        error: "Missing required campaign fields",
        code: "MISSING_REQUIRED_FIELDS",
      },
      400,
    );
  }

  const senderDailyLimit = Math.min(
    Math.max(Number(payload.senderDailyLimit || DEFAULT_SENDER_DAILY_LIMIT), 1),
    MAX_SENDER_DAILY_LIMIT,
  );

  // Resolve sender options
  let options: SenderOption[] = [];
  let fallbackSenderEmail = "";
  let transportBySender: Record<string, Transport | null> = {};

  try {
    const senderOptions = await resolveSenderOptions(authorization, ownerEmail);
    options = senderOptions.options;
    fallbackSenderEmail = senderOptions.fallbackSenderEmail;
    transportBySender = senderOptions.transportBySender;
  } catch (error) {
    return c.json(
      {
        error: extractErrorMessage(error),
        code: "SMTP_SENDER_NOT_CONFIGURED",
      },
      500,
    );
  }

  if (!ensureAllowedSender(senderEmail, options)) {
    return c.json(
      {
        error: "Selected sender is not available",
        code: "SENDER_NOT_ALLOWED",
        fallbackSenderEmail,
      },
      400,
    );
  }

  // Get contacts and filter
  const supabaseAdmin = createSupabaseAdmin();
  let contacts: ContactSnapshot[] = [];

  try {
    contacts = await getContactsByEmails(supabaseAdmin, userId, filteredEmails);
  } catch (error) {
    return c.json(
      {
        error: extractErrorMessage(error),
        code: "CONTACTS_FETCH_FAILED",
      },
      500,
    );
  }

  const eligibleContacts = filterEligibleContacts(contacts, onlyValidContacts);

  if (!eligibleContacts.length) {
    return c.json(
      {
        error: "No eligible contacts to send",
        code: "NO_ELIGIBLE_CONTACTS",
      },
      400,
    );
  }

  // Create campaign
  const { data: campaignData, error: campaignError } = await supabaseAdmin
    .schema("private")
    .from("email_campaigns")
    .insert({
      user_id: userId,
      owner_email: ownerEmail,
      sender_name: senderName,
      sender_email: senderEmail,
      reply_to: replyTo,
      subject,
      body_html_template: bodyHtmlTemplate,
      body_text_template: normalizeBodyText(
        bodyTextTemplate,
        bodyHtmlTemplate,
        plainTextOnly,
      ),
      footer_html_template: toHtmlFromText(footerTextTemplate),
      footer_text_template: footerTextTemplate,
      sender_daily_limit: senderDailyLimit,
      track_open: trackOpen,
      track_click: trackClick,
      plain_text_only: plainTextOnly,
      only_valid_contacts: onlyValidContacts,
      total_recipients: eligibleContacts.length,
      status: "queued",
    })
    .select("id")
    .single();

  if (campaignError || !campaignData?.id) {
    return c.json(
      {
        error: campaignError?.message || "Unable to create campaign",
        code: "CAMPAIGN_CREATE_FAILED",
      },
      500,
    );
  }

  const campaignId = campaignData.id as string;

  // Create recipients
  const recipientRows = eligibleContacts.map((contact) => ({
    campaign_id: campaignId,
    user_id: userId,
    sender_email: senderEmail,
    contact_email: contact.email,
    send_status: "pending" as RecipientStatus,
    contact_temperature: contact.temperature ?? 0,
  }));

  const { error: recipientsError } = await supabaseAdmin
    .schema("private")
    .from("email_campaign_recipients")
    .insert(recipientRows);

  if (recipientsError) {
    return c.json(
      {
        error: recipientsError.message,
        code: "CAMPAIGN_RECIPIENTS_CREATE_FAILED",
      },
      500,
    );
  }

  // Trigger campaign processor
  triggerCampaignProcessorFromEdge().catch((error) => {
    logger.error("Failed to trigger campaign processor", { error });
  });

  // Store data in context for campaignBill middleware
  c.set("campaignCreate", {
    campaignId,
    createdCount: recipientRows.length,
    userId,
  });

  // Return success (campaignBill middleware will handle final response)
  return;
}
```

**Step 2: Verify file is created**

Run: `ls -la supabase/functions/email-campaigns/campaign-create-controller.ts`
Expected: File exists

**Step 3: Commit**

```bash
git add supabase/functions/email-campaigns/campaign-create-controller.ts
git commit -m "feat: add campaign-create controller for DB operations"
```

---

## Task 4: Refactor index.ts to use new middleware chain

**Files:**

- Modify: `supabase/functions/email-campaigns/index.ts`

**Step 1: Update imports**

Remove:

```typescript
import { complianceMiddleware } from "./compliance-middleware.ts";
```

Add:

```typescript
import { campaignCheckMiddleware } from "./campaign-check-middleware.ts";
import { campaignCreateController } from "./campaign-create-controller.ts";
import { campaignBillMiddleware } from "./campaign-bill-middleware.ts";
```

**Step 2: Replace route handler**

Find (around line 1254):

```typescript
app.post(
  "/campaigns/create",
  authMiddleware,
  complianceMiddleware,
  async (c: Context) => {
    // ... existing handler code (200+ lines)
  },
);
```

Replace with:

```typescript
app.post(
  "/campaigns/create",
  authMiddleware,
  campaignCheckMiddleware,
  campaignCreateController,
  campaignBillMiddleware,
);
```

**Step 3: Verify the change**

Run: `grep -n "campaigns/create" supabase/functions/email-campaigns/index.ts`
Expected: Shows new middleware chain

**Step 4: Commit**

```bash
git add supabase/functions/email-campaigns/index.ts
git commit -m "refactor: replace monolithic handler with middleware chain"
```

---

## Task 5: Update or remove old compliance-middleware.ts

**Files:**

- Modify/Delete: `supabase/functions/email-campaigns/compliance-middleware.ts`

**Step 1: Decision point**

Options:
A. Delete the file entirely (if not used elsewhere)
B. Keep but deprecate (add @deprecated comment)
C. Update to re-export from new files

Recommended: Option A - Delete since we've replaced all functionality.

**Step 2: Check if used elsewhere**

Run: `grep -r "complianceMiddleware" supabase/functions/ --include="*.ts" | grep -v ".test.ts"`
Expected: Only shows imports in index.ts (which we're replacing)

**Step 3: Delete the file**

```bash
rm supabase/functions/email-campaigns/compliance-middleware.ts
```

**Step 4: Commit**

```bash
git rm supabase/functions/email-campaigns/compliance-middleware.ts
git commit -m "refactor: remove deprecated compliance-middleware"
```

---

## Task 6: Test the refactored flow

**Files:**

- Test manually via curl or frontend

**Step 1: Start local Supabase**

Run: `npm run dev:supabase`
Wait for: Services healthy

**Step 2: Serve edge functions**

Run: `npm run dev:supabase-functions`
Wait for: Function server running

**Step 3: Test quota check (insufficient credits)**

```bash
curl -X POST http://localhost:54321/functions/v1/email-campaigns/campaigns/create \
  -H "Authorization: Bearer <test-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "selectedEmails": ["test@example.com"],
    "senderName": "Test",
    "senderEmail": "sender@example.com",
    "subject": "Test",
    "bodyHtmlTemplate": "<p>Test</p>"
  }'
```

Expected: Returns 402 with `{ total: 1, available: 0, reason: "credits" }`

**Step 4: Test consent filter**

Expected: Returns 266 with `{ total: X, available: Y, reason: "consent" }` if some contacts opted out

**Step 5: Test successful creation**

With valid credits and consented contacts:
Expected: Returns 200 with `{ msg: "Campaign queued", campaignId, queuedCount }`

**Step 6: Verify billing called**

Check Supabase logs or billing function logs for charge call.

---

## Summary

After completing all tasks:

1. **campaignCheck** validates quota via `/billing/campaign/quota` and filters by consent
2. **campaignCreate** creates campaign and recipients, stores result in context
3. **campaignBill** charges credits via `/billing/campaign/charge` after successful creation
4. Clean separation of concerns with proper error handling at each stage
5. Old monolithic compliance middleware removed

The flow now matches the commercial billing pattern: check quota → create → charge.
