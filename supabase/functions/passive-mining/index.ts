import { Context, Hono } from "npm:hono@4.7.4";
import { createSupabaseAdmin } from "../_shared/supabase.ts";
import { getFolders } from "./boxes.ts";
import { isPermanentOAuthError } from "../fetch-mining-source/oauth-handler/index.ts";
import {
  parseConfig,
  type MiningSourceConfigV1,
} from "../_shared/mining-source-config.ts";
import {
  MiningRunMode,
  SourceHealthState,
  TaskStatus,
} from "../_shared/enums.ts";
const supabase = createSupabaseAdmin();

const SERVER_ENDPOINT = Deno.env.get("SERVER_ENDPOINT");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); // Edge Functions have access to this secret by default

const functionName = "passive-mining";
const app = new Hono().basePath(`/${functionName}`);

type MiningSource = {
  id: string;
  email: string;
  user_id: string;
  type?: string;
  config?: Record<string, unknown>;
  parsedConfig?: MiningSourceConfigV1;
};

/**
 * Centralized config writer: invoke the mining-sources edge function so ALL
 * mining_sources.config mutations flow through one atomic, row-locked merge.
 * Uses the Supabase client (service-role) rather than a hand-rolled fetch.
 */
async function patchSourceConfig(
  sourceId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.functions.invoke(
    `mining-sources/${encodeURIComponent(sourceId)}/config`,
    { method: "PATCH", body: patch },
  );

  if (error) {
    console.error(`Failed to persist config for ${sourceId}: ${error.message}`);
  }
}

async function recordRunStart(sourceId: string): Promise<void> {
  await patchSourceConfig(sourceId, {
    health: {
      state: SourceHealthState.Active,
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
      state: permanent
        ? SourceHealthState.NeedsReauth
        : SourceHealthState.Error,
      last_run_at: new Date().toISOString(),
      last_error: [message],
    },
  });
}

function isOAuthType(type?: string): boolean {
  return type === "google" || type === "azure";
}

async function backendError(
  res: Response,
  message: (status: number, detail: string) => string,
): Promise<Error & { status: number }> {
  const errText = await res.text();
  const payload = (() => {
    try {
      return JSON.parse(errText);
    } catch {
      return {};
    }
  })() as Record<string, unknown>;
  const detail =
    (payload?.data as Record<string, unknown> | undefined)?.message ??
    payload?.message ??
    payload?.error ??
    errText ??
    res.statusText;
  const error = new Error(message(res.status, String(detail))) as Error & {
    status: number;
  };
  error.status = res.status;
  return error;
}

app.post("/", async (c: Context) => {
  try {
    const miningSources = await getMiningSources();
    console.log(`Found ${miningSources.length} mining sources`);
    for (const miningSource of miningSources) {
      try {
        await recordRunStart(miningSource.id);
        await startMiningEmail(miningSource);
        console.log(
          `Started mining task for source ${miningSource.id} (${miningSource.type})`,
        );
      } catch (error) {
        console.error(
          `Error starting mining for source ${miningSource.id}:`,
          error instanceof Error ? error.message : error,
        );
        // OAuth sources 401 on these endpoints when the grant is dead (either
        // invalid_grant on refresh or the access token rejected at the IMAP
        // layer). Treat as permanent so the user is asked to reconnect instead
        // of retrying every cycle. Plain IMAP 401s (bad password) stay retrying.
        // (#2880 classification, ported onto the V1 config-write path.)
        const status = (error as { status?: number } | undefined)?.status;
        const permanent =
          isPermanentOAuthError(error) ||
          (status === 401 && isOAuthType(miningSource.type));
        await recordRunFailure(
          miningSource.id,
          error instanceof Error ? error.message : String(error),
          permanent,
        );
      }
    }

    return c.json({ msg: "Started passive-mining" });
  } catch (error) {
    console.error(
      "Error in passive-mining:",
      error instanceof Error ? error.message : error,
    );
    return c.json({ error: "Failed to start passive-mining" }, 500);
  }
});

Deno.serve((req) => app.fetch(req));

async function getMiningSources() {
  // Sources enabled for continuous mining that aren't awaiting re-auth.
  //
  // We fetch broadly (any passive source) and do the re-auth filter in code:
  // PostgREST jsonb filters are fragile here while config migrates from the
  // legacy `needs_reauth` shape to `health.state` (a `not.eq` on an absent
  // key evaluates to NULL and drops valid rows). The in-code filter below
  // covers both shapes. `type` is needed for the OAuth-401 classification
  // (#2880) in the error path.
  const { data, error } = await supabase
    .schema("private")
    .from("mining_sources")
    .select("id, email, user_id, type, config")
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
      return (
        healthState !== SourceHealthState.NeedsReauth && !legacyNeedsReauth
      );
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
    .eq("status", TaskStatus.Done)
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
    `Fetching IMAP boxes for source ${miningSource.id} (${miningSource.type})`,
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
  console.log(`Received response for boxes of source ${miningSource.id}`);

  if (!res.ok) {
    throw await backendError(
      res,
      (status, detail) => `Failed to fetch IMAP boxes (${status}): ${detail}`,
    );
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
    console.log(`Fetched boxes for source ${miningSource.id}:`, boxes);
    folders = getFolders(boxes);
    console.log(`Extracted folders for source ${miningSource.id}:`, folders);
  }

  // The backend builds `resumeFrom` from the persisted watermark. The edge only
  // decides the date fallback, used when no watermark exists yet.
  const hasWatermark = Boolean(
    sourceConfig.mining?.last?.folders &&
      Object.keys(sourceConfig.mining.last.folders).length > 0,
  );
  const since = hasWatermark
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
    miningMode: MiningRunMode.Incremental,
  };
  if (since) {
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
    throw await backendError(
      res,
      (_status, detail) => `Failed to start mining email: ${detail}`,
    );
  }

  const json = await res.json();
  return json?.data ?? json;
}
