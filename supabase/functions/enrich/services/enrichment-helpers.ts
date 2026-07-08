// Enrichment helpers — Deno/Supabase port of the helpers the backend
// controllers use (getContactsToEnrich, getEnrichmentCache, enrichFromCache).
// These are pure functions that take the Supabase client and are reused by
// the single-person and bulk-person routes.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";
import type { Logger } from "../../_shared/logger.ts";
import type { EnrichedCacheRow } from "./db-types.ts";

/**
 * A contact row trimmed to the fields needed by the enrichment flow.
 */
export interface EnrichmentContactRow {
  email: string;
  name?: string;
  id?: string;
}

/**
 * Fetch every refined person for a user (joined with their `persons` row)
 * so the /person/bulk endpoint can enrich "all contacts" without the
 * client having to resend the entire list.
 */
export async function getContactsToEnrich(
  client: SupabaseClient,
  userId: string,
): Promise<EnrichmentContactRow[]> {
  const { data: refinedPersons, error: rpError } = await client
    .schema("private")
    .from("refinedpersons")
    .select("person_id")
    .eq("user_id", userId);

  if (rpError) {
    throw new Error(rpError.message);
  }

  if (!refinedPersons || refinedPersons.length === 0) {
    return [];
  }

  const personIds = refinedPersons.map(
    (rp: { person_id: string }) => rp.person_id,
  );

  const { data: persons, error: personsError } = await client
    .schema("private")
    .from("persons")
    .select("id, email, name")
    .in("id", personIds);

  if (personsError) {
    throw new Error(personsError.message);
  }

  return (persons ?? []).map(
    (p: { id: string; email: string; name?: string }) => ({
      email: p.email,
      name: p.name,
      id: p.id,
    }),
  );
}

/**
 * Look up the most recent enrichment result for each of the given emails
 * via the `enriched_most_recent` RPC. Returns the raw cache rows and a
 * Set of emails that already have a cached result (so the caller can
 * skip running the engines for them).
 *
 * Errors are logged but never thrown — a cache miss is not fatal.
 */
export async function getEnrichmentCache(
  client: SupabaseClient,
  emails: string[],
  logger: Logger,
): Promise<{ cachedResults: EnrichedCacheRow[]; cachedEmails: Set<string> }> {
  let cachedResults: EnrichedCacheRow[] = [];
  try {
    const { data: cacheData, error: cacheError } = await client
      .schema("private")
      .rpc("enriched_most_recent", { emails });

    if (cacheError) {
      logger.error("Cache check failed", { error: cacheError.message });
    }

    if (cacheData) {
      cachedResults = cacheData as EnrichedCacheRow[];
    }
  } catch (err) {
    logger.error("Cache check error", { error: (err as Error).message });
  }

  const cachedEmails = new Set(
    cachedResults
      .map((r) =>
        r.result && typeof r.result === "object"
          ? ((r.result as Record<string, unknown>).email as string)
          : undefined
      )
      .filter((e): e is string => Boolean(e)),
  );

  return { cachedResults, cachedEmails };
}

/**
 * Write previously-cached enrichment results back to the contacts table
 * via the `enrich_contacts` RPC. Used by the bulk endpoint to apply cache
 * hits without re-running any engine.
 *
 * Errors are logged but never thrown — the cache write is best-effort.
 */
export async function enrichFromCache(
  client: SupabaseClient,
  cachedResults: EnrichedCacheRow[],
  shouldUpdateEmptyOnly: boolean,
  logger: Logger,
): Promise<void> {
  if (cachedResults.length === 0) return;
  try {
    const cacheContactsData = cachedResults.map((r) => r.result);
    const { error: updateCacheError } = await client
      .schema("private")
      .rpc("enrich_contacts", {
        p_contacts_data: cacheContactsData,
        p_update_empty_fields_only: shouldUpdateEmptyOnly,
      });

    if (updateCacheError) {
      logger.error("Failed to update contacts from cache", {
        error: updateCacheError.message,
      });
    }
  } catch (err) {
    logger.error("Cache update error", { error: (err as Error).message });
  }
}
