// Enrichment helpers — Deno/Supabase port of the helpers the backend
// controllers use (getContactsToEnrich, getEnrichmentCache, enrichFromCache).
// These are pure functions that take the Supabase client and are reused by
// the single-person and bulk-person routes.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";
import type { Logger } from "../../_shared/logger.ts";
import { errorMeta } from "./error-meta.ts";
import type { EnrichedCacheRow } from "./db-types.ts";
import type { EngineResponse } from "./engine.ts";
import { parseResult as defaultParseResult } from "./engines.ts";
import type EnrichmentsClient from "./enrichments-client.ts";

/**
 * A contact row trimmed to the fields needed by the enrichment flow.
 */
export interface EnrichmentContactRow {
  email: string;
  name?: string;
  id?: string;
}

/**
 * Maximum number of person ids sent in a single PostgREST `.in()` filter.
 * Ported from the backend's `enrichment.helpers.ts` (post-fork fix) to keep
 * the request URI below the gateway/proxy length limit for users with many
 * contacts.
 */
const CHUNK_SIZE = 150;

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

  const results: Array<{ id: string; email: string; name?: string }> = [];

  /* eslint-disable no-await-in-loop */
  for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
    const chunk = personIds.slice(i, i + CHUNK_SIZE);

    const { data: persons, error: personsError } = await client
      .schema("private")
      .from("persons")
      .select("id, email, name")
      .eq("user_id", userId)
      .in("id", chunk);

    if (personsError) {
      throw new Error(personsError.message);
    }

    results.push(...(persons ?? []));
  }

  return results.map((p) => ({
    email: p.email,
    name: p.name,
    id: p.id,
  }));
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
      logger.error("Cache check failed", { error: errorMeta(cacheError) });
    }

    if (cacheData) {
      cachedResults = cacheData as EnrichedCacheRow[];
    }
  } catch (err) {
    logger.error("Cache check error", { error: errorMeta(err) });
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

export type EnrichmentCacheParser = (
  result: unknown[],
  engine: string,
) => EngineResponse;

/**
 * Write previously-cached enrichment results back to the contacts table.
 *
 * The rows returned by `enriched_most_recent` carry the RAW provider
 * payload in `result`, not the snake_case contact shape that the
 * `enrich_contacts` RPC requires. Sending them to the RPC directly always
 * raised (missing `user_id` / `id`), and the error was swallowed — so the
 * routes reported success while nothing was written.
 *
 * Instead we mirror the backend `enrichFromCache` flow:
 *   1. run each raw row through the originating engine's `parseResult`,
 *   2. resolve `person_id` from the request contacts by email,
 *   3. persist through `EnrichmentsClient.enrich()` (contacts + ENRICH
 *      engagements), which builds the `user_id` + snake_case payload.
 *
 * Returns the person ids that were actually written, so callers can avoid
 * reporting success for contacts the database did not update.
 *
 * Parse failures are logged and skipped; write failures propagate so the
 * caller can report an error instead of a fake success.
 */
export async function enrichFromCache(
  enrichments: EnrichmentsClient,
  cachedResults: EnrichedCacheRow[],
  contacts: EnrichmentContactRow[],
  logger: Logger,
  parse: EnrichmentCacheParser = defaultParseResult,
): Promise<string[]> {
  if (cachedResults.length === 0) return [];

  const emailToId = new Map(
    contacts
      .filter(
        (c): c is { email: string; id: string } =>
          Boolean(c.email) && Boolean(c.id),
      )
      .map((c) => [c.email, c.id]),
  );

  const responses: EngineResponse[] = [];

  for (const row of cachedResults) {
    try {
      const parsed = parse([row.result], row.engine);
      if (!parsed.data.length) continue;

      for (const data of parsed.data) {
        if (data.email && !data.person_id) {
          data.person_id = emailToId.get(data.email);
        }
      }

      responses.push({ ...parsed, engine: "cache" });
    } catch (err) {
      logger.error("Failed to parse cached enrichment", {
        error: errorMeta(err),
      });
    }
  }

  if (responses.length === 0) return [];

  return await enrichments.enrich(responses);
}
