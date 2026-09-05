import { Context, Hono } from "npm:hono@4.7.4";
import { createSupabaseAdmin } from "../_shared/supabase.ts";
import { getFolders } from "./boxes.ts";
import { isPermanentOAuthError } from "../fetch-mining-source/oauth-handler/index.ts";
import {
  buildResumeFrom,
  parseConfig,
  type MiningSourceConfigV1,
} from "../_shared/mining-source-config.ts";
const supabase = createSupabaseAdmin();

const SERVER_ENDPOINT = Deno.env.get("SERVER_ENDPOINT");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); // Edge Functions have access to this secret by default

const functionName = "passive-mining";
const app = new Hono().basePath(`/${functionName}`);

type MiningSource = {
  id: string;
  email: string;
  user_id: string;
  config?: Record<string, unknown>;
  parsedConfig?: MiningSourceConfigV1;
};

/**
 * Centralized config writer: PATCH the mining-sources edge function so ALL
 * mining_sources.config mutations flow through one atomic, row-locked merge.
 */
async function patchSourceConfig(
  sourceId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const base = Deno.env.get("SUPABASE_URL") ?? SERVER_ENDPOINT;
  if (typeof base !== "string" || base.length === 0) {
    console.error(
      `Cannot write config for ${sourceId}: SUPABASE_URL / SERVER_ENDPOINT not set`,
    );
    return;
  }
  const baseUrl = base.replace(/\/+$/, "");
  const url = `${baseUrl}/functions/v1/mining-sources/${encodeURIComponent(sourceId)}/config`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(patch),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(
      `Failed to persist config for ${sourceId}: ${res.status} ${body}`,
    );
  }
}

async function recordRunStart(sourceId: string): Promise<void> {
  await patchSourceConfig(sourceId, {
    health: {
      state: "active",
      last_run_at: new Date().toISOString(),
    },
  });
}

async function recordRunFailure(
  sourceId: string,
  message: string,
  permanent: boolean,
): Promise<void> {
  await patchSourceConfig(sourceId, {
    health: {
      state: permanent ? "needs_reauth" : "error",
      last_run_at: new Date().toISOString(),
      last_error: [message],
    },
  });
}

app.post("/", async (c: Context) => {
  try {
    const miningSources = await getMiningSources();
    console.log(`Found ${miningSources.length} mining sources:`, miningSources);
    for (const miningSource of miningSources) {
      try {
        await recordRunStart(miningSource.id);
        await startMiningEmail(miningSource);
        console.log(`Started mining task for source ${miningSource.email}:`);
      } catch (error) {
        console.error(
          `Error starting mining for source ${miningSource.email}:`,
          error,
        );
        const permanent = isPermanentOAuthError(error);
        await recordRunFailure(
          miningSource.id,
          error instanceof Error ? error.message : String(error),
          permanent,
        );

        // For a permanent OAuth rejection (invalid_grant / revoked grant), mark the
        // source as needing re-auth but PRESERVE the user's passive_mining intent.
        // Do NOT set passive_mining=false here: the source stays listed, the UI shows
        // the "Connection lost - please reconnect" state, and once the token is
        // refreshed / re-authorized the scheduler resumes continuous extraction.
        // (recordRunFailure already set health.state='needs_reauth')
      }
    }

    return c.json({ msg: "Started passive-mining" });
  } catch (error) {
    console.error("Error in passive-mining:", error);
    return c.json({ error: "Failed to start passive-mining" }, 500);
  }
});

Deno.serve((req) => app.fetch(req));

async function getMiningSources() {
  // Only pick sources that are (a) enabled for continuous mining and (b) not
  // currently awaiting re-auth. A source flagged needs_reauth keeps its
  // passive_mining=true (so it isn't silently dropped from the UI), but we
  // don't hammer the mining API until fetch-mining-source clears the flag on
  // a successful token refresh / re-authorization.
  //
  // We fetch broadly (any passive source) and do the re-auth filter in code:
  // PostgREST `not.eq` on a jsonb key that is absent evaluates to NULL and
  // incorrectly drops the row, so chasing jsonb filters here is fragile when
  // config is being migrated from the old `needs_reauth` shape to `health.state`.
  const { data, error } = await supabase
    .schema("private")
    .from("mining_sources")
    .select("id, email, user_id, config")
    .match({ passive_mining: true });

  if (error) {
    console.error("Error fetching mining sources:", error.message);
    throw error;
  }

  return (data ?? [])
    .filter((source) => {
      const config = parseConfig(source.config);
      const healthState = config.health?.state;
      // Legacy fallback: an explicit needs_reauth:true (old shape) also skips.
      const legacyNeedsReauth =
        (source.config as Record<string, unknown> | undefined)?.needs_reauth ===
        true;
      return healthState !== "needs_reauth" && !legacyNeedsReauth;
    })
    .map((source) => ({
      ...source,
      parsedConfig: parseConfig(source.config),
    }));
}

async function getLatestPassiveMiningDate(
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .schema("private")
    .from("tasks")
    .select("started_at")
    .eq("user_id", userId)
    .eq("type", "fetch")
    .eq("status", "done")
    .contains("details", { passive_mining: true })
    .order("started_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Error fetching latest passive mining date:", error.message);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  return data[0].started_at;
}

async function getBoxes(miningSource: MiningSource) {
  console.log(
    `Fetching IMAP boxes for ${miningSource.email}at ${SERVER_ENDPOINT}/api/imap/boxes?userId=${miningSource.user_id}`,
  );
  const res = await fetch(
    `${SERVER_ENDPOINT}/api/imap/boxes?userId=${miningSource.user_id}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        // originally its x-sb-jwt
      },
      body: JSON.stringify({ email: miningSource.email }),
    },
  );
  console.log(`Received response for boxes of ${miningSource.email}:`, res);

  if (!res.ok) {
    throw new Error(res.statusText);
  }
  const { folders } = (await res.json()).data || {};
  return [...folders];
}

async function startMiningEmail(miningSource: MiningSource) {
  // Get default folders (saved checked boxes come from config.folders going
  // forward; getBoxes falls back to the server default set).
  const sourceConfig =
    miningSource.parsedConfig ?? parseConfig(miningSource.config);
  const savedFolders = sourceConfig.folders;

  let folders: string[];
  if (savedFolders && savedFolders.length > 0) {
    folders = savedFolders;
  } else {
    const boxes = await getBoxes(miningSource);
    console.log(`Fetched boxes for ${miningSource.email}:`, boxes);
    folders = getFolders(boxes);
    console.log(`Extracted folders for ${miningSource.email}:`, folders);
  }

  // Resume point: per-folder UID watermark persisted by the backend on the
  // previous successful run. Only fall back to a date when no watermark exists.
  const resumeFrom = buildResumeFrom(sourceConfig);
  const since = resumeFrom
    ? undefined
    : await getLatestPassiveMiningDate(miningSource.user_id);

  const flags = sourceConfig.flags ?? {};
  const googleContactsSync = sourceConfig.flags?.google_contacts_sync ?? false;

  const body: Record<string, unknown> = {
    miningSource: { id: miningSource.id },
    boxes: folders,
    cleaningEnabled: flags.cleaning_enabled ?? true,
    extractSignatures: flags.extract_signatures ?? false,
    passive_mining: true,
    googleContactsSync,
  };
  if (resumeFrom) {
    body.resumeFrom = resumeFrom;
  } else if (since) {
    body.since = since;
  }

  const res = await fetch(
    `${SERVER_ENDPOINT}/api/imap/mine/email/${miningSource.user_id}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const errText = await res.text();
    console.error("Mining API error:", errText);
    // Propagate the error payload so the caller can classify it via
    // isPermanentOAuthError (invalid_grant / revoked grant) instead of
    // swallowing it into a generic message.
    const payload = (() => {
      try {
        return JSON.parse(errText);
      } catch {
        return {};
      }
    })() as Record<string, unknown>;
    throw new Error(
      `Failed to start mining email: ${
        (payload?.error as string) || errText || res.statusText
      }`,
    );
  }

  const json = await res.json();
  return json?.data ?? json;
}
