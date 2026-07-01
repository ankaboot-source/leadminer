// Database / SQL type definitions for the enrich edge function.
// Mirrors the backend's Task/EnrichTask types from backend/src/db/types.ts.
// Engine types (EngineResponse, EngineResult, Person) live in ../types.ts
// and will be ported to ./engine.ts by Review #2 in parallel.

import type { EngineResponse } from "../types.ts";

/**
 * Task lifecycle status. Mirrors the backend's `TaskStatus` enum
 * (backend/src/db/types.ts) using string literal union for Deno/TS ergonomics.
 */
export type TaskStatus = "running" | "canceled" | "done";

/**
 * Task type discriminator. Matches the backend's `TaskType` enum.
 */
export type TaskType =
  | "fetch"
  | "extract"
  | "clean"
  | "enrich"
  | "signature"
  | "google-contacts-fetch";

/**
 * Task category. Matches the backend's `TaskCategory` enum.
 */
export type TaskCategory = "mining" | "enriching" | "cleaning";

/**
 * Supabase row shape (snake_case) for `private.tasks`.
 */
export interface SupabaseTask {
  id?: string;
  user_id: string;
  type: TaskType;
  category: TaskCategory;
  status: TaskStatus;
  details: Record<string, unknown>;
  started_at?: string;
  stopped_at?: string;
  duration?: number;
}

/**
 * Application-level task shape (camelCase).
 */
export interface Task {
  id?: string;
  userId: string;
  type: TaskType;
  category: TaskCategory;
  status: TaskStatus;
  details: Record<string, unknown>;
  duration?: number;
  startedAt?: string;
  stoppedAt?: string;
}

/**
 * Enrichment-specific task details. Mirrors the backend's
 * `EnrichTaskDetails` interface. Extends `Record<string, unknown>` so it
 * remains assignable to the generic `Task.details` field, which the
 * Supabase JSONB column is typed as.
 */
export interface EnrichTaskDetails extends Record<string, unknown> {
  total_enriched: number;
  total_to_enrich: number;
  update_empty_fields_only: boolean;
  error?: string[];
  result: EngineResponse[];
  passive_mining?: boolean;
  contacts_map?: Array<{ email: string; person_id: string }>;
}

/**
 * Narrowed task type for enrichment flows. Mirrors the backend's `EnrichTask`.
 */
export interface EnrichTask extends Task {
  category: "enriching";
  type: "enrich";
  details: EnrichTaskDetails;
}

/**
 * Sanitized task representation safe to return to API consumers.
 * Mirrors the backend's `TaskRedacted` interface.
 */
export interface TaskRedacted {
  id: string;
  userId: string;
  status: TaskStatus;
  details: {
    total_to_enrich: number;
    total_enriched: number;
    error?: string[];
  };
}

/**
 * Contact shape used by `EnrichmentsClient.updateContacts` to map into the
 * `enrich_contacts` RPC payload. Mirrors the backend's internal `Contact`
 * interface used by `Enrichments.updateContacts`.
 */
export interface ContactRecord {
  person_id?: string;
  id?: string;
  email?: string;
  name?: string;
  givenName?: string;
  familyName?: string;
  alternateName?: string[];
  location?: string;
  organization?: string;
  jobTitle?: string;
  sameAs?: string[];
  image?: string;
  telephone?: string[];
}

/**
 * Engagement type discriminator. Mirrors the backend's `EngagementType`.
 */
export type EngagementType = "CSV" | "ENRICH";

/**
 * Single row written to `private.engagement` for each enriched contact.
 * Mirrors the shape used by the backend's `Engagements.register`.
 */
export interface EngagementRecord {
  person_id: string;
  user_id: string;
  engagement_type: EngagementType;
  service: string;
}

/**
 * Row returned by the `enriched_most_recent` RPC. The `result` field carries
 * the contact payload in the snake_case shape expected by `enrich_contacts`.
 */
export interface EnrichedCacheRow {
  task_id: string;
  user_id: string;
  engine: string;
  result: unknown;
}
