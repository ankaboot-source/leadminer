import { Context, Hono } from "hono";
import IMAPSettingsDetector from "npm:@ankaboot.io/imap-autoconfig";
import corsHeaders from "../_shared/cors.ts";
import { verifyServiceRole } from "../_shared/middlewares.ts";
import {
  createSupabaseAdmin,
  createSupabaseClient,
} from "../_shared/supabase.ts";
import { normalizeEmail } from "../_shared/email.ts";
import { resolveCampaignBaseUrlFromEnv } from "../_shared/url.ts";
import { sendEmail, verifyTransport } from "./email.ts";
import {
  getSenderCredentialIssue,
  listUniqueSenderSources,
  refreshOAuthToken,
  updateMiningSourceCredentials,
} from "./sender-options.ts";

const functionName = "email-campaigns";
const app = new Hono().basePath(`/${functionName}`);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") as string;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
  "SUPABASE_SERVICE_ROLE_KEY",
) as string;
const LEADMINER_HASH_SECRET = Deno.env.get("LEADMINER_HASH_SECRET") as string;
const CAMPAIGN_COMPLIANCE_FOOTER = (
  Deno.env.get("campaign_compliance_footer") ||
  Deno.env.get("CAMPAIGN_COMPLIANCE_FOOTER") ||
  ""
).trim();
const PUBLIC_CAMPAIGN_BASE_URL = resolveCampaignBaseUrlFromEnv((key) =>
  Deno.env.get(key),
);
const SMTP_USER = normalizeEmail(Deno.env.get("SMTP_USER") || "");
const LEADMINER_FRONTEND_HOST = Deno.env.get("LEADMINER_FRONTEND_HOST") || "";
const DEFAULT_SENDER_DAILY_LIMIT = 1000;
const MAX_SENDER_DAILY_LIMIT = 2000;
const PROCESSING_BATCH_SIZE = 300;
const AZURE_DOMAINS = [
  "outlook",
  "hotmail",
  "live",
  "windowslive",
  "dbmail",
  "msn",
];
const GOOGLE_DOMAINS = ["gmail", "googlemail", "google"];
const UNSUBSCRIBE_TEXT_SUFFIX = "Click here to unsubscribe";
const COMPLIANCE_SEPARATOR = "---";

type CampaignStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";
type RecipientStatus = "pending" | "sent" | "failed" | "skipped";
type ConsentStatus = "legitimate_interest" | "opt_out" | "opt_in";
type BounceType = "hard" | "soft" | "technical";

type CampaignCreatePayload = {
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
};

type ContactSnapshot = {
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
};

type SenderOption = {
  email: string;
  available: boolean;
  reason?: string;
};

type ContactRow = {
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
};

type Transport = {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass?: string;
    type?: "OAuth2";
    accessToken?: string;
  };
};

async function authMiddleware(c: Context, next: () => Promise<void>) {
  const authHeader = c.req.header("authorization");

  if (!authHeader) {
    return c.json({ error: "Missing Authorization header" }, 401);
  }

  // Accept service role key directly (internal calls)
  if (authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
    await next();
  }

  // Validate user JWT
  const supabase = createSupabaseClient(authHeader);
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user?.id || !data.user.email) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("user", data.user);
  await next();
}

app.use("*", async (c, next) => {
  await next();
  Object.entries(corsHeaders).forEach(([key, value]) => {
    c.res.headers.set(key, value);
  });
});

app.options("*", () => new Response("ok", { headers: corsHeaders }));

function getDomainFromEmail(email: string): string | undefined {
  return email.toLowerCase().split("@")[1]?.split(".")[0];
}

function isGoogleDomain(email: string): boolean {
  const domain = getDomainFromEmail(email);
  return Boolean(domain && GOOGLE_DOMAINS.includes(domain));
}

function isAzureDomain(email: string): boolean {
  const domain = getDomainFromEmail(email);
  return Boolean(domain && AZURE_DOMAINS.includes(domain));
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function requireFallbackSenderEmail() {
  if (!SMTP_USER) {
    throw new Error("SMTP_USER is not configured");
  }
  return SMTP_USER;
}

function parseErrorCode(error: unknown): string {
  if (typeof error === "object" && error && "responseCode" in error) {
    return String(error.responseCode);
  }
  if (typeof error === "object" && error && "code" in error) {
    return String(error.code);
  }
  return "UNKNOWN";
}

function getSmtpResponseCode(error: unknown): number | null {
  if (typeof error === "object" && error && "responseCode" in error) {
    const value = Number(error.responseCode);
    return Number.isFinite(value) ? value : null;
  }
  return null;
}

function getErrorText(error: unknown): string {
  const message = extractErrorMessage(error);
  const response =
    typeof error === "object" && error && "response" in error
      ? String(error.response || "")
      : "";
  const code =
    typeof error === "object" && error && "code" in error
      ? String(error.code || "")
      : "";

  return `${message} ${response} ${code}`.trim().toLowerCase();
}

function classifyBounceType(error: unknown): BounceType {
  const smtpCode = getSmtpResponseCode(error);
  const technicalCode =
    typeof error === "object" && error && "code" in error
      ? String(error.code || "").toUpperCase()
      : "";
  const text = getErrorText(error);

  const technicalCodes = new Set([
    "ENOTFOUND",
    "ETIMEDOUT",
    "ECONNREFUSED",
    "ECONNRESET",
    "EHOSTUNREACH",
    "ESOCKET",
    "EAUTH",
  ]);

  if (technicalCodes.has(technicalCode)) {
    return "technical";
  }

  if (
    /5\.[0-9]\.[0-9]/.test(text) ||
    /user unknown|unknown user|no such user|mailbox unavailable|invalid recipient|recipient address rejected|account does not exist|doesn'?t exist/.test(
      text,
    )
  ) {
    return "hard";
  }

  if (
    /4\.[0-9]\.[0-9]/.test(text) ||
    /mailbox full|quota|temporar|greylist|try again|throttl|rate limit|too many requests|resources temporarily unavailable/.test(
      text,
    )
  ) {
    return "soft";
  }

  if (smtpCode !== null) {
    if (smtpCode >= 500) return "hard";
    if (smtpCode >= 400) return "soft";
  }

  return "technical";
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unknown error";
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

function toHtmlFromText(template: string): string {
  if (!template.trim()) return "";

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

function buildUnsubscribeUrl(token: string): string {
  return `${PUBLIC_CAMPAIGN_BASE_URL}/functions/v1/email-campaigns/unsubscribe/${token}`;
}

async function triggerCampaignProcessorFromEdge() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.log("Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
    return;
  }
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
}

function defaultFooterTemplate(ownerEmail: string): string {
  if (CAMPAIGN_COMPLIANCE_FOOTER) {
    return CAMPAIGN_COMPLIANCE_FOOTER;
  }
  return `${COMPLIANCE_SEPARATOR}\n\nYou received this email because ${ownerEmail} used leadminer.io to extract contacts from their mailbox. Try https://leadminer.io yourself.\n\n${UNSUBSCRIBE_TEXT_SUFFIX}: {{unsubscribeUrl}}`;
}

function ensureUnsubscribeText(
  footerText: string,
  unsubscribeUrl: string,
): string {
  const normalized = footerText.trim();
  const line = `${UNSUBSCRIBE_TEXT_SUFFIX}: ${unsubscribeUrl}`;

  if (!normalized) {
    return line;
  }

  if (normalized.includes(unsubscribeUrl)) {
    return normalized;
  }

  return `${normalized}\n\n${line}`;
}

function ensureUnsubscribeHtml(
  footerHtml: string,
  unsubscribeUrl: string,
): string {
  const normalized = footerHtml.trim();
  const link = `<p><a href="${unsubscribeUrl}" target="_blank" rel="noopener noreferrer">${UNSUBSCRIBE_TEXT_SUFFIX}</a></p>`;

  if (!normalized) {
    return link;
  }

  if (normalized.includes(unsubscribeUrl)) {
    return normalized;
  }

  return `${normalized}${link}`;
}

function renderTemplate(
  template: string,
  contact: ContactSnapshot,
  extraReplacements: Record<string, string> = {},
  options: { escapeValues?: boolean } = {},
): string {
  const givenName = contact.given_name ?? "";
  const familyName = contact.family_name ?? "";
  const fullName = contact.name || `${givenName} ${familyName}`.trim();
  const emailDomain = contact.email.split("@")[1] ?? "";
  const worksFor = contact.works_for ?? "";
  const jobTitle = contact.job_title ?? "";
  const alternateName = (contact.alternate_name ?? []).join(", ");
  const telephone = (contact.telephone ?? []).join(", ");

  const toValue = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return "";
    return String(value);
  };

  const replacements: Record<string, string> = {
    name: fullName,
    fullName,
    givenName,
    familyName,
    email: contact.email,
    emailDomain,
    location: contact.location ?? "",
    worksFor,
    jobTitle,
    alternateName,
    telephone,
    recency: toValue(contact.recency),
    seniority: toValue(contact.seniority),
    occurrence: toValue(contact.occurrence),
    sender: toValue(contact.sender),
    recipient: toValue(contact.recipient),
    conversations: toValue(contact.conversations),
    repliedConversations: toValue(contact.replied_conversations),
    ...extraReplacements,
  };

  return template.replace(
    /{{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*}}/g,
    (_, key: string) => {
      const value = replacements[key] ?? "";
      return options.escapeValues ? escapeHtml(value) : value;
    },
  );
}

function getCurrentUtcDayStart(): string {
  const date = new Date();
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  ).toISOString();
}

async function getAuthenticatedUser(c: Context) {
  const authorization = c.req.header("authorization");
  if (!authorization) {
    return { error: c.json({ error: "Missing authorization header" }, 401) };
  }

  const supabase = createSupabaseClient(authorization);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.id || !user.email) {
    return { error: c.json({ error: "Unauthorized" }, 401) };
  }

  return { supabase, user };
}

async function getUserMiningSources(authorization: string) {
  const supabase = createSupabaseClient(authorization);
  const { data, error } = await supabase
    .schema("private")
    .rpc("get_user_mining_source_credentials", {
      _encryption_key: LEADMINER_HASH_SECRET,
    });

  if (error) {
    throw new Error(`Unable to fetch mining credentials: ${error.message}`);
  }

  return (data ?? []) as {
    email: string;
    type: string;
    credentials: Record<string, unknown>;
  }[];
}

async function guessCustomSmtpHost(email: string) {
  const detected = await new IMAPSettingsDetector.default().detect(email);
  const host = (detected?.host || "") as string;
  if (host.startsWith("imap.")) {
    return {
      host: host.replace(/^imap\./, "smtp."),
      port: 587,
      secure: false,
    };
  }

  const domain = email.split("@")[1];
  return {
    host: `smtp.${domain}`,
    port: 587,
    secure: false,
  };
}

async function buildUserTransport(
  senderEmail: string,
  credentials: Record<string, unknown>,
): Promise<Transport> {
  if (isGoogleDomain(senderEmail)) {
    if (typeof credentials.password === "string") {
      return {
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          user: senderEmail,
          pass: credentials.password,
        },
      };
    }

    return {
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        type: "OAuth2",
        user: senderEmail,
        accessToken: String(credentials.accessToken || ""),
      },
    };
  }

  if (isAzureDomain(senderEmail)) {
    if (typeof credentials.password === "string") {
      return {
        host: "smtp-mail.outlook.com",
        port: 587,
        secure: false,
        auth: {
          user: senderEmail,
          pass: credentials.password,
        },
      };
    }

    return {
      host: "smtp-mail.outlook.com",
      port: 587,
      secure: false,
      auth: {
        type: "OAuth2",
        user: senderEmail,
        accessToken: String(credentials.accessToken || ""),
      },
    };
  }

  const smtp = await guessCustomSmtpHost(senderEmail);
  return {
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: {
      user: String(credentials.email || senderEmail),
      pass: String(credentials.password || ""),
    },
  };
}

async function resolveSenderOptions(authorization: string, userEmail: string) {
  const fallbackSenderEmail = requireFallbackSenderEmail();
  const options: SenderOption[] = [];
  const transportBySender: Record<string, Transport | null> = {
    [fallbackSenderEmail]: null,
  };
  const supabaseAdmin = createSupabaseAdmin();

  const sources = listUniqueSenderSources(
    await getUserMiningSources(authorization),
  );

  // Refresh expired OAuth tokens
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    const credentialIssue = getSenderCredentialIssue(source);

    if (credentialIssue?.includes("expired")) {
      try {
        const refreshed = await refreshOAuthToken(source);
        if (refreshed) {
          const updated = await updateMiningSourceCredentials(
            supabaseAdmin,
            source.email,
            refreshed.credentials,
          );
          if (updated) {
            sources[i] = refreshed;
          }
        } else {
          console.warn(
            `Could not refresh token for ${source.email}, source will remain unavailable`,
          );
        }
      } catch (error) {
        console.error(
          "Failed to refresh token for source:",
          source.email,
          error,
        );
      }
    }
  }

  for (const source of sources) {
    const credentialIssue = getSenderCredentialIssue(source);
    if (credentialIssue) {
      options.push({
        email: source.email,
        available: false,
        reason: credentialIssue,
      });
      continue;
    }

    try {
      const transport = await buildUserTransport(
        source.email,
        source.credentials,
      );
      await verifyTransport(transport);
      options.push({ email: source.email, available: true });
      transportBySender[source.email] = transport;
    } catch (error) {
      options.push({
        email: source.email,
        available: false,
        reason: extractErrorMessage(error),
      });
    }
  }

  const normalizedUserEmail = normalizeEmail(userEmail);
  if (
    !options.some(
      (option) => normalizeEmail(option.email) === normalizedUserEmail,
    )
  ) {
    options.push({
      email: userEmail,
      available: false,
      reason: "No matching mining source credentials",
    });
  }

  const fallbackOption = options.find(
    (option) => option.email === fallbackSenderEmail,
  );
  if (fallbackOption) {
    fallbackOption.available = true;
    delete fallbackOption.reason;
  } else {
    options.push({ email: fallbackSenderEmail, available: true });
  }

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

async function getSelectedContacts(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  userId: string,
  selectedEmails?: string[],
) {
  const { data, error } = await supabaseAdmin
    .schema("private")
    .rpc("get_contacts_table", {
      user_id: userId,
    });

  if (error) {
    throw new Error(`Unable to fetch contacts for campaign: ${error.message}`);
  }

  const selectedSet = selectedEmails?.length
    ? new Set(selectedEmails.map((email) => email.toLowerCase()))
    : null;

  const contacts = (data ?? [])
    .filter(
      (row: ContactRow) =>
        !selectedSet || selectedSet.has(row.email.toLowerCase()),
    )
    .map((row: ContactRow) => ({
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

  return contacts;
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

  return (data ?? []).map((row: ContactRow) => ({
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

function buildRenderedContent(
  contact: ContactSnapshot,
  payload: {
    subjectTemplate: string;
    bodyHtmlTemplate: string;
    bodyTextTemplate: string;
    footerTextTemplate: string;
    ownerEmail: string;
    unsubscribeUrl: string;
    senderName: string;
    plainTextOnly: boolean;
  },
) {
  const extra = {
    ownerEmail: payload.ownerEmail,
    unsubscribeUrl: payload.unsubscribeUrl,
    senderName: payload.senderName,
  };

  const renderedBodyHtml = renderTemplate(
    payload.bodyHtmlTemplate,
    contact,
    extra,
    {
      escapeValues: true,
    },
  );
  const renderedBodyText = renderTemplate(
    payload.bodyTextTemplate,
    contact,
    extra,
  );

  const rawFooterText = renderTemplate(
    payload.footerTextTemplate,
    contact,
    extra,
  );
  const footerText = ensureUnsubscribeText(
    rawFooterText,
    payload.unsubscribeUrl,
  );
  const footerHtml = ensureUnsubscribeHtml(
    toHtmlFromText(rawFooterText),
    payload.unsubscribeUrl,
  );

  const html = payload.plainTextOnly ? "" : `${renderedBodyHtml}${footerHtml}`;
  const text = `${renderedBodyText}\n\n${footerText}`.trim();
  const subject = renderTemplate(payload.subjectTemplate, contact, extra);

  return {
    subject,
    html,
    text,
  };
}

async function recordClickLink(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  campaignId: string,
  recipientId: string,
  url: string,
) {
  const { data, error } = await supabaseAdmin
    .schema("private")
    .from("email_campaign_links")
    .insert({
      campaign_id: campaignId,
      recipient_id: recipientId,
      url,
    })
    .select("token")
    .single();

  if (error || !data?.token) {
    throw new Error(
      `Unable to save click tracker link: ${error?.message || "unknown"}`,
    );
  }

  return data.token as string;
}

async function injectTrackers(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  campaignId: string,
  recipientId: string,
  openToken: string,
  html: string,
  trackClick: boolean,
  trackOpen: boolean,
) {
  let updatedHtml = html;

  if (trackClick) {
    const hrefRegex = /href\s*=\s*"([^"]+)"/g;
    const matches = [...updatedHtml.matchAll(hrefRegex)];

    for (const match of matches) {
      const originalUrl = match[1];
      if (!originalUrl || originalUrl.startsWith("mailto:")) {
        continue;
      }

      const token = await recordClickLink(
        supabaseAdmin,
        campaignId,
        recipientId,
        originalUrl,
      );
      const trackedUrl = `${PUBLIC_CAMPAIGN_BASE_URL}/functions/v1/email-campaigns/track/click/${token}`;
      updatedHtml = updatedHtml.replace(
        `href="${originalUrl}"`,
        `href="${trackedUrl}"`,
      );
    }
  }

  if (trackOpen) {
    const pixelUrl = `${PUBLIC_CAMPAIGN_BASE_URL}/functions/v1/email-campaigns/track/open/${openToken}`;
    updatedHtml += `<img src="${pixelUrl}" alt="" width="1" height="1" style="display:none" />`;
  }

  return updatedHtml;
}

async function setCampaignStatus(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  campaignId: string,
  status: CampaignStatus,
) {
  const payload: Record<string, unknown> = { status };
  if (status === "processing") payload.started_at = new Date().toISOString();
  if (status === "completed" || status === "failed" || status === "cancelled") {
    payload.completed_at = new Date().toISOString();
  }

  await supabaseAdmin
    .schema("private")
    .from("email_campaigns")
    .update(payload)
    .eq("id", campaignId);
}

async function countRecipientsByStatus(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  campaignId: string,
  status: RecipientStatus,
) {
  const { count, error } = await supabaseAdmin
    .schema("private")
    .from("email_campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("send_status", status);

  if (error) {
    throw new Error(error.message);
  }

  return Number(count || 0);
}

async function finalizeCampaignStatusIfDone(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  campaignId: string,
) {
  const [pendingCount, sentCount, failedCount] = await Promise.all([
    countRecipientsByStatus(supabaseAdmin, campaignId, "pending"),
    countRecipientsByStatus(supabaseAdmin, campaignId, "sent"),
    countRecipientsByStatus(supabaseAdmin, campaignId, "failed"),
  ]);

  if (pendingCount > 0) {
    return;
  }

  const finalStatus: CampaignStatus =
    sentCount === 0 && failedCount > 0 ? "failed" : "completed";

  await setCampaignStatus(supabaseAdmin, campaignId, finalStatus);
}

async function updateContactDeliverability(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  userId: string,
  email: string,
  status: "VALID" | "RISKY" | "INVALID",
) {
  await supabaseAdmin
    .schema("private")
    .from("persons")
    .update({ status })
    .eq("user_id", userId)
    .eq("email", email);
}

app.post("/campaigns/sender-options", authMiddleware, async (c: Context) => {
  const auth = await getAuthenticatedUser(c);
  if ("error" in auth) return auth.error;

  try {
    const authorization = c.req.header("authorization") as string;
    const { options, fallbackSenderEmail } = await resolveSenderOptions(
      authorization,
      auth.user.email as string,
    );
    return c.json({
      options,
      fallbackSenderEmail,
      defaultDailyLimit: DEFAULT_SENDER_DAILY_LIMIT,
      maxDailyLimit: MAX_SENDER_DAILY_LIMIT,
    });
  } catch (error) {
    const message = extractErrorMessage(error);
    const code = /SMTP_USER/i.test(message)
      ? "SMTP_SENDER_NOT_CONFIGURED"
      : "SENDER_OPTIONS_FAILED";
    return c.json({ error: message, code }, 500);
  }
});

app.post("/campaigns/preview", authMiddleware, async (c: Context) => {
  const auth = await getAuthenticatedUser(c);
  if ("error" in auth) return auth.error;

  const payload = (await c.req
    .json()
    .catch(() => ({}))) as CampaignCreatePayload;
  const senderName = String(payload.senderName || "").trim();
  const senderEmail = String(payload.senderEmail || "")
    .trim()
    .toLowerCase();
  const subject = String(payload.subject || "").trim();
  const selectedEmails = payload.selectedEmails;
  const plainTextOnly = Boolean(payload.plainTextOnly);
  const bodyHtmlTemplate = String(payload.bodyHtmlTemplate || "");
  const bodyTextTemplate = String(payload.bodyTextTemplate || "");
  const ownerEmail = auth.user.email as string;
  const footerTextTemplate = String(
    payload.footerTextTemplate || defaultFooterTemplate(ownerEmail),
  );

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

  const authorization = c.req.header("authorization") as string;
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

  const supabaseAdmin = createSupabaseAdmin();
  let contacts: ContactSnapshot[] = [];
  try {
    contacts = await getSelectedContacts(
      supabaseAdmin,
      auth.user.id,
      selectedEmails,
    );
  } catch (error) {
    return c.json(
      {
        error: extractErrorMessage(error),
        code: "CONTACTS_FETCH_FAILED",
      },
      500,
    );
  }
  const eligibleContacts = filterEligibleContacts(
    contacts,
    Boolean(payload.onlyValidContacts),
  );

  if (!eligibleContacts.length) {
    return c.json(
      {
        error: "No eligible contacts available for preview",
        code: "NO_ELIGIBLE_CONTACTS",
      },
      400,
    );
  }

  const randomContact =
    eligibleContacts[Math.floor(Math.random() * eligibleContacts.length)];
  const {
    subject: renderedSubject,
    html,
    text,
  } = buildRenderedContent(randomContact, {
    subjectTemplate: subject,
    bodyHtmlTemplate,
    bodyTextTemplate: normalizeBodyText(
      bodyTextTemplate,
      bodyHtmlTemplate,
      plainTextOnly,
    ),
    footerTextTemplate,
    ownerEmail,
    unsubscribeUrl: buildUnsubscribeUrl("preview-unsubscribe"),
    senderName,
    plainTextOnly,
  });

  try {
    const from = `"${escapeHtml(senderName)}" <${senderEmail}>`;
    await sendEmail(
      ownerEmail,
      `[Preview] ${renderedSubject}`,
      plainTextOnly ? "" : html,
      {
        from,
        replyTo: ownerEmail,
        text,
        transport: transportBySender[senderEmail] ?? undefined,
      },
    );
    return c.json({
      msg: "Preview sent successfully",
      selectedContactEmail: randomContact.email,
      sentToEmail: ownerEmail,
    });
  } catch (error) {
    return c.json(
      {
        error: extractErrorMessage(error),
        code: "SENDER_SMTP_FAILED",
        fallbackSenderEmail,
      },
      422,
    );
  }
});

app.post("/campaigns/create", authMiddleware, async (c: Context) => {
  const auth = await getAuthenticatedUser(c);
  if ("error" in auth) return auth.error;

  const payload = (await c.req
    .json()
    .catch(() => ({}))) as CampaignCreatePayload;
  const senderName = String(payload.senderName || "").trim();
  const senderEmail = String(payload.senderEmail || "")
    .trim()
    .toLowerCase();
  const replyTo = String(payload.replyTo || auth.user.email || "").trim();
  const subject = String(payload.subject || "").trim();
  const bodyHtmlTemplate = String(payload.bodyHtmlTemplate || "");
  const bodyTextTemplate = String(payload.bodyTextTemplate || "");
  const ownerEmail = auth.user.email as string;
  const footerTextTemplate = String(
    payload.footerTextTemplate || defaultFooterTemplate(ownerEmail),
  );
  const plainTextOnly = Boolean(payload.plainTextOnly);
  const onlyValidContacts = Boolean(payload.onlyValidContacts);
  const trackOpen = payload.trackOpen !== false;
  const trackClick = payload.trackClick !== false;

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

  const authorization = c.req.header("authorization") as string;
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

  if (senderEmail !== fallbackSenderEmail) {
    try {
      await verifyTransport(transportBySender[senderEmail] ?? undefined);
    } catch (error) {
      return c.json(
        {
          error: extractErrorMessage(error),
          code: "SENDER_SMTP_FAILED",
          fallbackSenderEmail,
        },
        422,
      );
    }
  }

  const supabaseAdmin = createSupabaseAdmin();
  let contacts: ContactSnapshot[] = [];
  try {
    contacts = await getSelectedContacts(
      supabaseAdmin,
      auth.user.id,
      payload.selectedEmails,
    );
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

  const { data: campaignData, error: campaignError } = await supabaseAdmin
    .schema("private")
    .from("email_campaigns")
    .insert({
      user_id: auth.user.id,
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
  const recipientRows = eligibleContacts.map((contact) => ({
    campaign_id: campaignId,
    user_id: auth.user.id,
    sender_email: senderEmail,
    contact_email: contact.email,
    send_status: "pending" as RecipientStatus,
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

  triggerCampaignProcessorFromEdge().catch((error) => {
    console.log("error triggered");
    console.log("error:", error);
    // Cron remains as fallback if immediate trigger fails.
  });

  return c.json({
    msg: "Campaign queued",
    campaignId,
    queuedCount: recipientRows.length,
  });
});

app.get("/campaigns/:id/status", authMiddleware, async (c: Context) => {
  const auth = await getAuthenticatedUser(c);
  if ("error" in auth) return auth.error;

  const campaignId = c.req.param("id");
  const supabaseAdmin = createSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .schema("private")
    .from("email_campaigns")
    .select("id, status, total_recipients, created_at, completed_at")
    .eq("id", campaignId)
    .eq("user_id", auth.user.id)
    .single();

  if (error || !data) {
    return c.json({ error: "Campaign not found" }, 404);
  }

  return c.json(data);
});

app.post("/campaigns/:id/stop", authMiddleware, async (c: Context) => {
  const auth = await getAuthenticatedUser(c);
  if ("error" in auth) return auth.error;

  const campaignId = c.req.param("id");
  const supabaseAdmin = createSupabaseAdmin();

  const { data: campaign, error: campaignError } = await supabaseAdmin
    .schema("private")
    .from("email_campaigns")
    .select("id, status")
    .eq("id", campaignId)
    .eq("user_id", auth.user.id)
    .single();

  if (campaignError || !campaign) {
    return c.json(
      { error: "Campaign not found", code: "CAMPAIGN_NOT_FOUND" },
      404,
    );
  }

  if (["completed", "failed", "cancelled"].includes(String(campaign.status))) {
    return c.json(
      {
        error: "Campaign is already in a terminal state",
        code: "CAMPAIGN_ALREADY_TERMINAL",
      },
      400,
    );
  }

  await setCampaignStatus(supabaseAdmin, campaignId, "cancelled");

  await supabaseAdmin
    .schema("private")
    .from("email_campaign_recipients")
    .update({
      send_status: "skipped",
      last_error: "Campaign cancelled by user",
    })
    .eq("campaign_id", campaignId)
    .eq("send_status", "pending");

  return c.json({ msg: "Campaign stopped", campaignId });
});

app.delete("/campaigns/:id", authMiddleware, async (c: Context) => {
  const auth = await getAuthenticatedUser(c);
  if ("error" in auth) return auth.error;

  const campaignId = c.req.param("id");
  const supabaseAdmin = createSupabaseAdmin();

  const { data: campaign, error: campaignError } = await supabaseAdmin
    .schema("private")
    .from("email_campaigns")
    .select("id, status")
    .eq("id", campaignId)
    .eq("user_id", auth.user.id)
    .single();

  if (campaignError || !campaign) {
    return c.json(
      { error: "Campaign not found", code: "CAMPAIGN_NOT_FOUND" },
      404,
    );
  }

  if (campaign.status === "processing") {
    return c.json(
      {
        error: "Campaign is currently processing. Stop it first.",
        code: "CAMPAIGN_PROCESSING_DELETE_FORBIDDEN",
      },
      409,
    );
  }

  const { error: deleteError } = await supabaseAdmin
    .schema("private")
    .from("email_campaigns")
    .delete()
    .eq("id", campaignId)
    .eq("user_id", auth.user.id);

  if (deleteError) {
    return c.json(
      { error: deleteError.message, code: "CAMPAIGN_DELETE_FAILED" },
      500,
    );
  }

  return c.json({ msg: "Campaign deleted", campaignId });
});

app.post(
  "/campaigns/process",
  authMiddleware,
  verifyServiceRole,
  async (c: Context) => {
    const supabaseAdmin = createSupabaseAdmin();
    let fallbackSenderEmail = "";
    try {
      fallbackSenderEmail = requireFallbackSenderEmail();
    } catch (error) {
      return c.json(
        {
          error: extractErrorMessage(error),
          code: "SMTP_SENDER_NOT_CONFIGURED",
        },
        500,
      );
    }
    const dayStart = getCurrentUtcDayStart();
    const { data: campaigns, error: campaignsError } = await supabaseAdmin
      .schema("private")
      .from("email_campaigns")
      .select(
        "id, user_id, owner_email, sender_name, sender_email, reply_to, subject, body_html_template, body_text_template, footer_html_template, footer_text_template, sender_daily_limit, track_open, track_click, plain_text_only, only_valid_contacts",
      )
      .in("status", ["queued", "processing"])
      .order("created_at", { ascending: true })
      .limit(30);

    if (campaignsError) {
      return c.json({ error: campaignsError.message }, 500);
    }

    let processedRecipients = 0;

    for (const campaign of campaigns ?? []) {
      await setCampaignStatus(supabaseAdmin, campaign.id, "processing");

      const enforcedLimit = Math.min(
        Math.max(
          Number(campaign.sender_daily_limit || DEFAULT_SENDER_DAILY_LIMIT),
          1,
        ),
        MAX_SENDER_DAILY_LIMIT,
      );

      const { count: sentToday } = await supabaseAdmin
        .schema("private")
        .from("email_campaign_recipients")
        .select("id", { count: "exact", head: true })
        .eq("sender_email", campaign.sender_email)
        .eq("send_status", "sent")
        .gte("sent_at", dayStart);

      const remainingForSender = Math.max(
        0,
        enforcedLimit - Number(sentToday || 0),
      );
      if (remainingForSender <= 0) {
        continue;
      }

      const { data: recipients, error: recipientsError } = await supabaseAdmin
        .schema("private")
        .from("email_campaign_recipients")
        .select(
          "id, user_id, contact_email, open_token, unsubscribe_token, attempt_count",
        )
        .eq("campaign_id", campaign.id)
        .eq("send_status", "pending")
        .order("created_at", { ascending: true })
        .limit(Math.min(remainingForSender, PROCESSING_BATCH_SIZE));

      if (recipientsError) {
        await setCampaignStatus(supabaseAdmin, campaign.id, "failed");
        continue;
      }

      if (!recipients?.length) {
        try {
          await finalizeCampaignStatusIfDone(supabaseAdmin, campaign.id);
        } catch {
          await setCampaignStatus(supabaseAdmin, campaign.id, "failed");
        }
        continue;
      }

      let senderTransport: Transport | undefined;
      if (campaign.sender_email !== fallbackSenderEmail) {
        const serviceClient = createSupabaseAdmin();
        const { data: rows, error } = await serviceClient
          .schema("private")
          .rpc("get_mining_source_credentials_for_user", {
            _user_id: campaign.user_id,
            _encryption_key: LEADMINER_HASH_SECRET,
          });

        if (error) {
          await setCampaignStatus(supabaseAdmin, campaign.id, "failed");
          continue;
        }

        const matchingSource = (rows ?? []).find(
          (row: { email: string }) => row.email === campaign.sender_email,
        );
        if (!matchingSource) {
          await setCampaignStatus(supabaseAdmin, campaign.id, "failed");
          continue;
        }

        try {
          senderTransport = await buildUserTransport(
            campaign.sender_email,
            matchingSource.credentials as Record<string, unknown>,
          );
        } catch {
          await setCampaignStatus(supabaseAdmin, campaign.id, "failed");
          continue;
        }
      }

      const recipientEmails = recipients.map(
        (recipient) => recipient.contact_email,
      );
      let liveContacts: ContactSnapshot[] = [];
      try {
        liveContacts = await getContactsByEmails(
          supabaseAdmin,
          campaign.user_id,
          recipientEmails,
        );
      } catch {
        await setCampaignStatus(supabaseAdmin, campaign.id, "failed");
        continue;
      }

      const liveContactByEmail = new Map<string, ContactSnapshot>();
      liveContacts.forEach((contact) => {
        liveContactByEmail.set(contact.email.toLowerCase(), contact);
      });

      for (const recipient of recipients) {
        const { data: recipientState } = await supabaseAdmin
          .schema("private")
          .from("email_campaign_recipients")
          .select("send_status")
          .eq("id", recipient.id)
          .single();

        if (recipientState?.send_status !== "pending") {
          continue;
        }

        const snapshot = liveContactByEmail.get(
          recipient.contact_email.toLowerCase(),
        );
        if (!snapshot) {
          await supabaseAdmin
            .schema("private")
            .from("email_campaign_recipients")
            .update({
              send_status: "skipped",
              last_error: "Recipient not found in live contact table",
            })
            .eq("id", recipient.id);
          continue;
        }

        if (
          !isContactEligible(snapshot, Boolean(campaign.only_valid_contacts))
        ) {
          await supabaseAdmin
            .schema("private")
            .from("email_campaign_recipients")
            .update({
              send_status: "skipped",
              last_error: "Recipient no longer eligible",
            })
            .eq("id", recipient.id);
          continue;
        }

        const {
          subject: renderedSubject,
          html,
          text,
        } = buildRenderedContent(snapshot, {
          subjectTemplate: campaign.subject,
          bodyHtmlTemplate: campaign.body_html_template || "",
          bodyTextTemplate: campaign.body_text_template || "",
          footerTextTemplate:
            campaign.footer_text_template ||
            defaultFooterTemplate(campaign.owner_email),
          ownerEmail: campaign.owner_email,
          unsubscribeUrl: buildUnsubscribeUrl(recipient.unsubscribe_token),
          senderName: campaign.sender_name,
          plainTextOnly: campaign.plain_text_only,
        });

        try {
          const htmlWithTracking = campaign.plain_text_only
            ? ""
            : await injectTrackers(
                supabaseAdmin,
                campaign.id,
                recipient.id,
                recipient.open_token,
                html,
                campaign.track_click,
                campaign.track_open,
              );

          await sendEmail(
            recipient.contact_email,
            renderedSubject,
            campaign.plain_text_only ? "" : htmlWithTracking,
            {
              from: `"${escapeHtml(campaign.sender_name)}" <${campaign.sender_email}>`,
              replyTo: campaign.reply_to,
              text,
              transport: senderTransport,
            },
          );

          await supabaseAdmin
            .schema("private")
            .from("email_campaign_recipients")
            .update({
              send_status: "sent",
              sent_at: new Date().toISOString(),
              attempt_count: recipient.attempt_count
                ? recipient.attempt_count + 1
                : 1,
              bounce_type: null,
              smtp_code: null,
              last_error: null,
            })
            .eq("id", recipient.id);

          await updateContactDeliverability(
            supabaseAdmin,
            recipient.user_id,
            recipient.contact_email,
            "VALID",
          );
          processedRecipients += 1;
        } catch (error) {
          const message = extractErrorMessage(error);
          const smtpCode = parseErrorCode(error);
          const bounceType = classifyBounceType(error);

          await supabaseAdmin
            .schema("private")
            .from("email_campaign_recipients")
            .update({
              send_status: "failed",
              attempt_count: recipient.attempt_count
                ? recipient.attempt_count + 1
                : 1,
              bounce_type: bounceType,
              smtp_code: smtpCode,
              last_error: message,
            })
            .eq("id", recipient.id);

          if (bounceType === "hard" || bounceType === "soft") {
            await updateContactDeliverability(
              supabaseAdmin,
              recipient.user_id,
              recipient.contact_email,
              bounceType === "hard" ? "INVALID" : "RISKY",
            );
          }
        }
      }

      try {
        await finalizeCampaignStatusIfDone(supabaseAdmin, campaign.id);
      } catch {
        await setCampaignStatus(supabaseAdmin, campaign.id, "failed");
      }
    }

    return c.json({ processedRecipients });
  },
);

app.get("/unsubscribe/:token", async (c: Context) => {
  const token = c.req.param("token");
  const supabaseAdmin = createSupabaseAdmin();

  if (token === "preview-unsubscribe") {
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: `${LEADMINER_FRONTEND_HOST}/unsubscribe/success?preview=true`,
      },
    });
  }

  const { data: recipient, error } = await supabaseAdmin
    .schema("private")
    .from("email_campaign_recipients")
    .select("id, campaign_id, user_id, contact_email")
    .eq("unsubscribe_token", token)
    .single();

  if (error || !recipient) {
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: `${LEADMINER_FRONTEND_HOST}/unsubscribe/failure`,
      },
    });
  }

  await supabaseAdmin
    .schema("private")
    .from("refinedpersons")
    .update({ consent_status: "opt_out" })
    .eq("user_id", recipient.user_id)
    .eq("email", recipient.contact_email);

  await supabaseAdmin
    .schema("private")
    .from("email_campaign_recipients")
    .update({
      send_status: "skipped",
      last_error: "Recipient unsubscribed",
    })
    .eq("user_id", recipient.user_id)
    .eq("contact_email", recipient.contact_email)
    .eq("send_status", "pending");

  await supabaseAdmin.schema("private").from("email_campaign_events").insert({
    campaign_id: recipient.campaign_id,
    recipient_id: recipient.id,
    event_type: "unsubscribe",
  });

  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      Location: `${LEADMINER_FRONTEND_HOST}/unsubscribe/success`,
    },
  });
});

app.get("/track/open/:token", async (c: Context) => {
  const token = c.req.param("token");
  const supabaseAdmin = createSupabaseAdmin();

  const { data: recipient } = await supabaseAdmin
    .schema("private")
    .from("email_campaign_recipients")
    .select("id, campaign_id")
    .eq("open_token", token)
    .single();

  if (recipient) {
    await supabaseAdmin.schema("private").from("email_campaign_events").insert({
      campaign_id: recipient.campaign_id,
      recipient_id: recipient.id,
      event_type: "open",
    });
  }

  const pixel = Uint8Array.from(
    atob("R0lGODlhAQABAPAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="),
    (char) => char.charCodeAt(0),
  );

  return new Response(pixel, {
    headers: {
      ...corsHeaders,
      "Content-Type": "image/gif",
      "Cache-Control": "no-store",
    },
  });
});

app.get("/track/click/:token", async (c: Context) => {
  const token = c.req.param("token");
  const supabaseAdmin = createSupabaseAdmin();

  const { data: link } = await supabaseAdmin
    .schema("private")
    .from("email_campaign_links")
    .select("url, campaign_id, recipient_id")
    .eq("token", token)
    .single();

  if (!link?.url) {
    return c.json({ error: "Invalid tracking token" }, 404);
  }

  await supabaseAdmin.schema("private").from("email_campaign_events").insert({
    campaign_id: link.campaign_id,
    recipient_id: link.recipient_id,
    event_type: "click",
    url: link.url,
  });

  return c.redirect(link.url, 302);
});

app.post("/email-sending-request", authMiddleware, async (c: Context) => {
  const auth = await getAuthenticatedUser(c);
  if ("error" in auth) return auth.error;

  const { contactsCount } = await c.req.json().catch(() => ({}));
  if (!Number.isInteger(contactsCount) || contactsCount < 1) {
    return c.json({ error: "Invalid contactsCount" }, 400);
  }

  const subject = "Email sending request";
  let fallbackSenderEmail = "";
  try {
    fallbackSenderEmail = requireFallbackSenderEmail();
  } catch (error) {
    return c.json(
      {
        error: extractErrorMessage(error),
        code: "SMTP_SENDER_NOT_CONFIGURED",
      },
      500,
    );
  }
  const safeUserEmail = escapeHtml(auth.user.email as string);
  const html = `<p>The user ${safeUserEmail} wants to send an email campaign to ${contactsCount} contacts</p>`;

  try {
    await sendEmail(fallbackSenderEmail, subject, html, {
      from: `"leadminer" <${fallbackSenderEmail}>`,
      replyTo: auth.user.email as string,
    });

    return c.json({ msg: "Email sent successfully" });
  } catch (error) {
    console.error("Error in email-sending-request:", error);
    return c.json({ error: "Failed to send email" }, 500);
  }
});

Deno.serve((req) => app.fetch(req));
