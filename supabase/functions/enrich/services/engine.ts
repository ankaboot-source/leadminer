/**
 * Engine contract ported from
 * `backend/src/services/enrichment/Engine.ts`.
 *
 * The `Engine` interface describes the shape every enrichment provider
 * implementation must satisfy: a stable `name`, sync/async capability
 * flags, an `isValid` predicate for selecting applicable engines, and
 * the three enrichment operations (`enrichSync`, `enrichAsync`,
 * `parseResult`).
 *
 * The accompanying `Person`, `EngineResult`, and `EngineResponse` shapes
 * are preserved verbatim so the public surface stays compatible with
 * downstream consumers (e.g. the `ContactsEnrichClient` from Review #3).
 */

/**
 * A person record as understood by the enrichment stack. The `identifiers`
 * field carries contact IDs from the database so enrichment results can
 * be re-attached to the originating contact.
 */
export interface Person {
  url: string;
  email: string;
  name?: string;
  image?: string;
  job_title?: string;
  given_name?: string;
  family_name?: string;
  works_for?: string;
  alternate_name?: string[];
  location?: string;
  same_as?: string[];
  identifiers: string[];
}

/**
 * A single enrichment result row, ready to be written to the contacts
 * table. `person_id` is included so the orchestrator can echo back the
 * contact identifier without re-deriving it from the request.
 */
export interface EngineResult {
  person_id?: string;
  email: string;
  name?: string;
  image?: string;
  location?: string;
  jobTitle?: string;
  organization?: string;
  givenName?: string;
  familyName?: string;
  sameAs?: string[];
  identifiers?: string[];
  alternateName?: string[];
}

/**
 * The response envelope returned by every engine. `data` contains the
 * normalized `EngineResult` rows; `raw_data` keeps the original payload
 * for debugging; `token` is populated by async engines that return a
 * job handle to be polled via webhook.
 */
export interface EngineResponse {
  token?: string;
  engine: string;
  raw_data: unknown[];
  data: EngineResult[];
}

/**
 * The Engine contract. Implementations may be sync-only (e.g. EnrichLayer,
 * TheDig), async-only (e.g. Voilanorbert), or dual-mode.
 */
export interface Engine {
  readonly name: string;
  readonly isSync: boolean;
  readonly isAsync: boolean;

  isValid: (contact: Partial<Person>) => boolean;
  enrichAsync(
    persons: Partial<Person>[],
    webhook: string
  ): Promise<EngineResponse>;
  enrichSync(persons: Partial<Person>): Promise<EngineResponse>;
  parseResult(data: unknown[]): EngineResponse;
}
