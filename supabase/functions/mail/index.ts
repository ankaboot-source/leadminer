import { Context, Hono } from "hono";
import IMAPSettingsDetector from "npm:@ankaboot.io/imap-autoconfig";
import corsHeaders from "../_shared/cors.ts";
import { verifyServiceRole } from "../_shared/middlewares.ts";
import { createSupabaseAdmin, createSupabaseClient } from "../_shared/supabase.ts";
import mailMiningComplete from "./mining-complete/index.ts";
import { sendEmail, verifyTransport } from "./utils/email.ts";

const functionName = "mail";
const app = new Hono().basePath(`/${functionName}`);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") as string;
const LEADMINER_HASH_SECRET = Deno.env.get("LEADMINER_HASH_SECRET") as string;
const FALLBACK_SENDER_EMAIL = Deno.env.get("TRY_SENDER_EMAIL") || "try@leadminer.io";
const DEFAULT_SENDER_DAILY_LIMIT = 1000;
const MAX_SENDER_DAILY_LIMIT = 2000;
const PROCESSING_BATCH_SIZE = 300;
const AZURE_DOMAINS = ["outlook", "hotmail", "live", "windowslive", "dbmail", "msn"];
const GOOGLE_DOMAINS = ["gmail", "googlemail", "google"];

type CampaignStatus = "queued" | "processing" | "completed" | "failed";
type RecipientStatus = "pending" | "sent" | "failed" | "skipped";

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
};

type ContactSnapshot = {
  email: string;
  status: string | null;
  name: string | null;
  given_name: string | null;
  family_name: string | null;
  location: string | null;
  works_for: string | null;
  job_title: string | null;
};

type SenderOption = {
  email: string;
  available: boolean;
  reason?: string;
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

function parseErrorCode(error: unknown): string {
  if (typeof error === "object" && error && "responseCode" in error) {
    return String(error.responseCode);
  }
  if (typeof error === "object" && error && "code" in error) {
    return String(error.code);
  }
  return "UNKNOWN";
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

function toTextFromHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeBodyText(bodyText: string, bodyHtml: string, plainTextOnly: boolean): string {
  if (plainTextOnly) {
    return bodyText.trim().length ? bodyText : toTextFromHtml(bodyHtml);
  }
  return bodyText;
}

function renderTemplate(template: string, contact: ContactSnapshot): string {
  const replacements: Record<string, string> = {
    name: contact.name ?? "",
    given_name: contact.given_name ?? "",
    family_name: contact.family_name ?? "",
    email: contact.email,
    location: contact.location ?? "",
    works_for: contact.works_for ?? "",
    job_title: contact.job_title ?? "",
  };

  return template.replace(/{{\s*([a-z_]+)\s*}}/g, (_, key: string) => replacements[key] ?? "");
}

function getCurrentUtcDayStart(): string {
  const date = new Date();
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString();
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
  const options: SenderOption[] = [];
  const transportBySender: Record<string, Transport | null> = {
    [FALLBACK_SENDER_EMAIL]: null,
  };
  const sources = await getUserMiningSources(authorization);
  const matchingSource = sources.find((source) => source.email === userEmail);

  if (!matchingSource) {
    options.push({
      email: userEmail,
      available: false,
      reason: "No matching mining source credentials",
    });
  } else {
    try {
      const transport = await buildUserTransport(userEmail, matchingSource.credentials);
      await verifyTransport(transport);
      options.push({ email: userEmail, available: true });
      transportBySender[userEmail] = transport;
    } catch (error) {
      options.push({
        email: userEmail,
        available: false,
        reason: extractErrorMessage(error),
      });
    }
  }

  options.push({ email: FALLBACK_SENDER_EMAIL, available: true });

  return {
    options,
    transportBySender,
  };
}

function ensureAllowedSender(
  senderEmail: string,
  options: SenderOption[],
) {
  return options.some((option) => option.email === senderEmail && option.available);
}

async function getSelectedContacts(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  userId: string,
  selectedEmails?: string[],
) {
  const baseQuery = supabaseAdmin
    .schema("private")
    .from("persons")
    .select("email, status, name, given_name, family_name, location, works_for, job_title")
    .eq("user_id", userId);

  const { data, error } = selectedEmails?.length
    ? await baseQuery.in("email", selectedEmails)
    : await baseQuery;

  if (error) {
    throw new Error(`Unable to fetch contacts for campaign: ${error.message}`);
  }

  const unique = new Map<string, ContactSnapshot>();
  (data ?? []).forEach((contact) => {
    if (!unique.has(contact.email)) {
      unique.set(contact.email, contact as ContactSnapshot);
    }
  });

  return Array.from(unique.values());
}

function filterEligibleContacts(
  contacts: ContactSnapshot[],
  onlyValidContacts: boolean,
) {
  return contacts.filter((contact) => {
    const status = contact.status;
    if (status === "RISKY" || status === "INVALID") {
      return false;
    }
    if (onlyValidContacts) {
      return status === "VALID";
    }
    return true;
  });
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
    throw new Error(`Unable to save click tracker link: ${error?.message || "unknown"}`);
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

      const token = await recordClickLink(supabaseAdmin, campaignId, recipientId, originalUrl);
      const trackedUrl = `${SUPABASE_URL}/functions/v1/mail/track/click/${token}`;
      updatedHtml = updatedHtml.replace(`href="${originalUrl}"`, `href="${trackedUrl}"`);
    }
  }

  if (trackOpen) {
    const pixelUrl = `${SUPABASE_URL}/functions/v1/mail/track/open/${openToken}`;
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
  if (status === "completed" || status === "failed") {
    payload.completed_at = new Date().toISOString();
  }

  await supabaseAdmin
    .schema("private")
    .from("email_campaigns")
    .update(payload)
    .eq("id", campaignId);
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

app.post("/mining-complete", verifyServiceRole, async (c: Context) => {
  const { miningId } = await c.req.json();

  if (!miningId) {
    return c.json({ error: "Missing miningId" }, 400);
  }

  try {
    await mailMiningComplete(miningId);
    return c.json({ msg: "Email sent successfully" });
  } catch (error) {
    console.error("Error in mining-complete:", error);
    return c.json({ error: "Failed to send email" }, 500);
  }
});

app.post("/campaigns/sender-options", async (c: Context) => {
  const auth = await getAuthenticatedUser(c);
  if ("error" in auth) return auth.error;

  try {
    const authorization = c.req.header("authorization") as string;
    const { options } = await resolveSenderOptions(authorization, auth.user.email as string);
    return c.json({
      options,
      fallbackSenderEmail: FALLBACK_SENDER_EMAIL,
      defaultDailyLimit: DEFAULT_SENDER_DAILY_LIMIT,
      maxDailyLimit: MAX_SENDER_DAILY_LIMIT,
    });
  } catch (error) {
    return c.json({ error: extractErrorMessage(error) }, 500);
  }
});

app.post("/campaigns/preview", async (c: Context) => {
  const auth = await getAuthenticatedUser(c);
  if ("error" in auth) return auth.error;

  const payload = (await c.req.json().catch(() => ({}))) as CampaignCreatePayload;
  const senderName = String(payload.senderName || "").trim();
  const senderEmail = String(payload.senderEmail || "").trim().toLowerCase();
  const subject = String(payload.subject || "").trim();
  const selectedEmails = payload.selectedEmails;
  const plainTextOnly = Boolean(payload.plainTextOnly);
  const bodyHtmlTemplate = String(payload.bodyHtmlTemplate || "");
  const bodyTextTemplate = String(payload.bodyTextTemplate || "");

  if (!senderName || !senderEmail || !subject || (!bodyHtmlTemplate && !bodyTextTemplate)) {
    return c.json({ error: "Missing required campaign fields" }, 400);
  }

  const authorization = c.req.header("authorization") as string;
  const { options, transportBySender } = await resolveSenderOptions(
    authorization,
    auth.user.email as string,
  );

  if (!ensureAllowedSender(senderEmail, options)) {
    return c.json(
      {
        error: "Selected sender is not available",
        code: "SENDER_NOT_ALLOWED",
        fallbackSenderEmail: FALLBACK_SENDER_EMAIL,
      },
      400,
    );
  }

  const supabaseAdmin = createSupabaseAdmin();
  const contacts = await getSelectedContacts(supabaseAdmin, auth.user.id, selectedEmails);
  const eligibleContacts = filterEligibleContacts(contacts, Boolean(payload.onlyValidContacts));

  if (!eligibleContacts.length) {
    return c.json({ error: "No eligible contacts available for preview" }, 400);
  }

  const randomContact = eligibleContacts[Math.floor(Math.random() * eligibleContacts.length)];
  const renderedHtml = renderTemplate(bodyHtmlTemplate, randomContact);
  const renderedText = renderTemplate(
    normalizeBodyText(bodyTextTemplate, bodyHtmlTemplate, plainTextOnly),
    randomContact,
  );

  try {
    const from = `"${escapeHtml(senderName)}" <${senderEmail}>`;
    await sendEmail(
      auth.user.email as string,
      `[Preview] ${subject}`,
      plainTextOnly ? "" : renderedHtml,
      {
        from,
        replyTo: auth.user.email as string,
        text: renderedText,
        transport: transportBySender[senderEmail] ?? undefined,
      },
    );
    return c.json({ msg: "Preview sent successfully" });
  } catch (error) {
    return c.json(
      {
        error: extractErrorMessage(error),
        code: "SENDER_SMTP_FAILED",
        fallbackSenderEmail: FALLBACK_SENDER_EMAIL,
      },
      422,
    );
  }
});

app.post("/campaigns/create", async (c: Context) => {
  const auth = await getAuthenticatedUser(c);
  if ("error" in auth) return auth.error;

  const payload = (await c.req.json().catch(() => ({}))) as CampaignCreatePayload;
  const senderName = String(payload.senderName || "").trim();
  const senderEmail = String(payload.senderEmail || "").trim().toLowerCase();
  const replyTo = String(payload.replyTo || auth.user.email || "").trim();
  const subject = String(payload.subject || "").trim();
  const bodyHtmlTemplate = String(payload.bodyHtmlTemplate || "");
  const bodyTextTemplate = String(payload.bodyTextTemplate || "");
  const plainTextOnly = Boolean(payload.plainTextOnly);
  const onlyValidContacts = Boolean(payload.onlyValidContacts);
  const trackOpen = payload.trackOpen !== false;
  const trackClick = payload.trackClick !== false;

  if (!senderName || !senderEmail || !subject || (!bodyHtmlTemplate && !bodyTextTemplate)) {
    return c.json({ error: "Missing required campaign fields" }, 400);
  }

  const senderDailyLimit = Math.min(
    Math.max(Number(payload.senderDailyLimit || DEFAULT_SENDER_DAILY_LIMIT), 1),
    MAX_SENDER_DAILY_LIMIT,
  );

  const authorization = c.req.header("authorization") as string;
  const { options, transportBySender } = await resolveSenderOptions(
    authorization,
    auth.user.email as string,
  );

  if (!ensureAllowedSender(senderEmail, options)) {
    return c.json(
      {
        error: "Selected sender is not available",
        code: "SENDER_NOT_ALLOWED",
        fallbackSenderEmail: FALLBACK_SENDER_EMAIL,
      },
      400,
    );
  }

  if (senderEmail !== FALLBACK_SENDER_EMAIL) {
    try {
      await verifyTransport(transportBySender[senderEmail] ?? undefined);
    } catch (error) {
      return c.json(
        {
          error: extractErrorMessage(error),
          code: "SENDER_SMTP_FAILED",
          fallbackSenderEmail: FALLBACK_SENDER_EMAIL,
        },
        422,
      );
    }
  }

  const supabaseAdmin = createSupabaseAdmin();
  const contacts = await getSelectedContacts(supabaseAdmin, auth.user.id, payload.selectedEmails);
  const eligibleContacts = filterEligibleContacts(contacts, onlyValidContacts);

  if (!eligibleContacts.length) {
    return c.json({ error: "No eligible contacts to send" }, 400);
  }

  const { data: campaignData, error: campaignError } = await supabaseAdmin
    .schema("private")
    .from("email_campaigns")
    .insert({
      user_id: auth.user.id,
      sender_name: senderName,
      sender_email: senderEmail,
      reply_to: replyTo,
      subject,
      body_html_template: bodyHtmlTemplate,
      body_text_template: normalizeBodyText(bodyTextTemplate, bodyHtmlTemplate, plainTextOnly),
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
    return c.json({ error: campaignError?.message || "Unable to create campaign" }, 500);
  }

  const campaignId = campaignData.id as string;
  const recipientRows = eligibleContacts.map((contact) => ({
    campaign_id: campaignId,
    user_id: auth.user.id,
    sender_email: senderEmail,
    contact_email: contact.email,
    status: contact.status,
    name: contact.name,
    given_name: contact.given_name,
    family_name: contact.family_name,
    location: contact.location,
    works_for: contact.works_for,
    job_title: contact.job_title,
    send_status: "pending" as RecipientStatus,
  }));

  const { error: recipientsError } = await supabaseAdmin
    .schema("private")
    .from("email_campaign_recipients")
    .insert(recipientRows);

  if (recipientsError) {
    return c.json({ error: recipientsError.message }, 500);
  }

  return c.json({
    msg: "Campaign queued",
    campaignId,
    queuedCount: recipientRows.length,
  });
});

app.get("/campaigns/:id/status", async (c: Context) => {
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

app.post("/campaigns/process", verifyServiceRole, async (c: Context) => {
  const supabaseAdmin = createSupabaseAdmin();
  const dayStart = getCurrentUtcDayStart();
  const { data: campaigns, error: campaignsError } = await supabaseAdmin
    .schema("private")
    .from("email_campaigns")
    .select("id, user_id, sender_name, sender_email, reply_to, subject, body_html_template, body_text_template, sender_daily_limit, track_open, track_click, plain_text_only")
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
      Math.max(Number(campaign.sender_daily_limit || DEFAULT_SENDER_DAILY_LIMIT), 1),
      MAX_SENDER_DAILY_LIMIT,
    );

    const { count: sentToday } = await supabaseAdmin
      .schema("private")
      .from("email_campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("sender_email", campaign.sender_email)
      .eq("send_status", "sent")
      .gte("sent_at", dayStart);

    const remainingForSender = Math.max(0, enforcedLimit - Number(sentToday || 0));
    if (remainingForSender <= 0) {
      continue;
    }

    const { data: recipients, error: recipientsError } = await supabaseAdmin
      .schema("private")
      .from("email_campaign_recipients")
      .select("id, user_id, contact_email, open_token, name, given_name, family_name, location, works_for, job_title, attempt_count")
      .eq("campaign_id", campaign.id)
      .eq("send_status", "pending")
      .order("created_at", { ascending: true })
      .limit(Math.min(remainingForSender, PROCESSING_BATCH_SIZE));

    if (recipientsError) {
      await setCampaignStatus(supabaseAdmin, campaign.id, "failed");
      continue;
    }

    if (!recipients?.length) {
      const { count: pendingCount } = await supabaseAdmin
        .schema("private")
        .from("email_campaign_recipients")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaign.id)
        .eq("send_status", "pending");

      if (!pendingCount) {
        await setCampaignStatus(supabaseAdmin, campaign.id, "completed");
      }
      continue;
    }

    let senderTransport: Transport | undefined;
    if (campaign.sender_email !== FALLBACK_SENDER_EMAIL) {
      const { data: userInfo } = await supabaseAdmin.auth.admin.getUserById(campaign.user_id);
      const senderEmail = userInfo.user?.email;

      if (!senderEmail || senderEmail !== campaign.sender_email) {
        await setCampaignStatus(supabaseAdmin, campaign.id, "failed");
        continue;
      }

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

      const matchingSource = (rows ?? []).find((row: { email: string }) => row.email === senderEmail);
      if (!matchingSource) {
        await setCampaignStatus(supabaseAdmin, campaign.id, "failed");
        continue;
      }

      try {
        senderTransport = await buildUserTransport(senderEmail, matchingSource.credentials as Record<string, unknown>);
      } catch {
        await setCampaignStatus(supabaseAdmin, campaign.id, "failed");
        continue;
      }
    }

    for (const recipient of recipients) {
      const snapshot: ContactSnapshot = {
        email: recipient.contact_email,
        status: null,
        name: recipient.name,
        given_name: recipient.given_name,
        family_name: recipient.family_name,
        location: recipient.location,
        works_for: recipient.works_for,
        job_title: recipient.job_title,
      };

      const renderedHtml = renderTemplate(campaign.body_html_template || "", snapshot);
      const renderedText = renderTemplate(campaign.body_text_template || "", snapshot);

      try {
        const htmlWithTracking = campaign.plain_text_only
          ? ""
          : await injectTrackers(
            supabaseAdmin,
            campaign.id,
            recipient.id,
            recipient.open_token,
            renderedHtml,
            campaign.track_click,
            campaign.track_open,
          );

        await sendEmail(
          recipient.contact_email,
          campaign.subject,
          campaign.plain_text_only ? "" : htmlWithTracking,
          {
            from: `"${escapeHtml(campaign.sender_name)}" <${campaign.sender_email}>`,
            replyTo: campaign.reply_to,
            text: renderedText,
            transport: senderTransport,
          },
        );

        await supabaseAdmin
          .schema("private")
          .from("email_campaign_recipients")
          .update({
            send_status: "sent",
            sent_at: new Date().toISOString(),
            attempt_count: recipient.attempt_count ? recipient.attempt_count + 1 : 1,
            smtp_code: null,
            last_error: null,
          })
          .eq("id", recipient.id);

        await updateContactDeliverability(supabaseAdmin, recipient.user_id, recipient.contact_email, "VALID");
        processedRecipients += 1;
      } catch (error) {
        const message = extractErrorMessage(error);
        const smtpCode = parseErrorCode(error);
        const isInvalidMailbox = /5\.1\.1|550|invalid mailbox|user unknown/i.test(message);

        await supabaseAdmin
          .schema("private")
          .from("email_campaign_recipients")
          .update({
            send_status: "failed",
            attempt_count: recipient.attempt_count ? recipient.attempt_count + 1 : 1,
            smtp_code: smtpCode,
            last_error: message,
          })
          .eq("id", recipient.id);

        await updateContactDeliverability(
          supabaseAdmin,
          recipient.user_id,
          recipient.contact_email,
          isInvalidMailbox ? "INVALID" : "RISKY",
        );
      }
    }

    const { count: pendingCount } = await supabaseAdmin
      .schema("private")
      .from("email_campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaign.id)
      .eq("send_status", "pending");

    if (!pendingCount) {
      await setCampaignStatus(supabaseAdmin, campaign.id, "completed");
    }
  }

  return c.json({ processedRecipients });
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
    await supabaseAdmin
      .schema("private")
      .from("email_campaign_events")
      .insert({
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

  await supabaseAdmin
    .schema("private")
    .from("email_campaign_events")
    .insert({
      campaign_id: link.campaign_id,
      recipient_id: link.recipient_id,
      event_type: "click",
      url: link.url,
    });

  return c.redirect(link.url, 302);
});

app.post("/email-sending-request", async (c: Context) => {
  const auth = await getAuthenticatedUser(c);
  if ("error" in auth) return auth.error;

  const { contactsCount } = await c.req.json().catch(() => ({}));
  if (!Number.isInteger(contactsCount) || contactsCount < 1) {
    return c.json({ error: "Invalid contactsCount" }, 400);
  }

  const subject = "Email sending request";
  const safeUserEmail = escapeHtml(auth.user.email as string);
  const html = `<p>The user ${safeUserEmail} wants to send an email campaign to ${contactsCount} contacts</p>`;

  try {
    await sendEmail("contact@leadminer.io", subject, html, {
      from: "contact@leadminer.io",
      replyTo: auth.user.email as string,
    });

    return c.json({ msg: "Email sent successfully" });
  } catch (error) {
    console.error("Error in email-sending-request:", error);
    return c.json({ error: "Failed to send email" }, 500);
  }
});

Deno.serve((req) => app.fetch(req));
