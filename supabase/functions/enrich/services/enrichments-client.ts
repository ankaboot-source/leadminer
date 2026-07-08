// EnrichmentsClient — Deno/Supabase port of backend/src/db/supabase/enrichments.ts.
// Owns the enrichment task lifecycle (create, status transitions, finalize),
// contact updates via the `enrich_contacts` RPC, and engagement registration.
//
// Differences from the backend version (edge-specific adaptations):
// - No Billing hooks (validateCustomerCredits / deductCustomerCredits).
// - Constructor takes only (client, logger); TasksClient and
//   EngagementsClient are instantiated internally with the same deps.
// - Re-throws on enrich() failure so the route can mark the task as
//   canceled (the backend swallows the error because its flow is async
//   and token-based, not request-scoped).
// - Adds `completeWithEmptyResult` to persist a `{ engine: "none", ... }`
//   placeholder row when no engine returned data (matches the legacy
//   index.ts behavior for the /person endpoint).

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";
import type { EngineResponse, EngineResult } from "../types.ts";
import type { Logger } from "../../_shared/logger.ts";
import type {
  ContactRecord,
  EnrichTask,
  EngagementType,
  TaskRedacted,
  TaskStatus,
} from "./db-types.ts";
import EngagementsClient from "./engagements-client.ts";
import TasksClient from "./tasks-client.ts";

const EMPTY_RESULT: EngineResponse = {
  engine: "none",
  data: [],
  raw_data: [],
};

/**
 * Orchestrates an enrichment task's full lifecycle:
 *   create  →  enrich (one or many batches)  →  end | cancel
 *
 * The instance holds the current `EnrichTask` in memory for the duration
 * of a request so callers do not need to thread the task id through every
 * step.
 */
export default class EnrichmentsClient {
  private task: EnrichTask | null = null;
  private readonly tasks: TasksClient;
  private readonly engagements: EngagementsClient;

  constructor(
    private readonly client: SupabaseClient,
    private readonly logger: Logger,
  ) {
    this.tasks = new TasksClient(client, logger);
    this.engagements = new EngagementsClient(client, logger);
  }

  private ensureTask(): EnrichTask {
    if (!this.task) {
      throw new Error(
        "No task is currently set. Ensure a task is initialized before using this method.",
      );
    }
    return this.task;
  }

  /**
   * Merge incoming `result` entries into the current task's `details.result`
   * array, matching by `token` when present (mirrors the backend).
   */
  private mergeTaskDetailsResult(result: EngineResponse[]): void {
    const task = this.ensureTask();
    for (const newResult of result) {
      const token = newResult.token;
      const existingItem = token
        ? task.details.result.find((item) => item.token === token)
        : undefined;
      if (existingItem) {
        Object.assign(existingItem, newResult);
      } else {
        task.details.result.push(newResult);
      }
    }
  }

  private async setTaskStatus(status: TaskStatus): Promise<void> {
    const task = this.ensureTask();
    task.status = status;
    task.startedAt = new Date().toISOString();
    await this.tasks.update(task);
    const msg = `task status updated to ${status}`;
    this.logger.debug(`[${this.constructor.name}.setTaskStatus]: ${msg}`);
  }

  /**
   * Sanitized task representation for logging/responses.
   */
  redactedTask(): TaskRedacted {
    const task = this.ensureTask();
    return {
      id: task.id as string,
      userId: task.userId,
      status: task.status,
      details: {
        total_to_enrich: task.details.total_to_enrich,
        total_enriched: task.details.total_enriched,
        ...(task.details.error ? { error: task.details.error } : {}),
      },
    };
  }

  /**
   * Mark the current task as done. Mirrors the backend's `end()`.
   */
  async end(): Promise<void> {
    await this.setTaskStatus("done");
  }

  /**
   * Mark the current task as canceled. Mirrors the backend's `cancel()`.
   */
  async cancel(): Promise<void> {
    await this.setTaskStatus("canceled");
  }

  /**
   * Load an existing task by id (e.g., for webhook flows that resume
   * an in-flight task). Mirrors the backend's `createFromId`.
   */
  async createFromId(id: string): Promise<EnrichTask> {
    const task = (await this.tasks.getById(id)) as unknown as EnrichTask;
    this.task = task;
    return task;
  }

  /**
   * Create a new enrichment task in the `running` state and store it
   * as the current task. Mirrors the backend's `create`.
   */
  async create(
    userId: string,
    totalToEnrich: number,
    updateEmptyFieldsOnly: boolean,
  ): Promise<EnrichTask> {
    const task = (await this.tasks.create({
      userId,
      status: "running",
      type: "enrich",
      category: "enriching",
      details: {
        result: [],
        total_enriched: 0,
        total_to_enrich: totalToEnrich,
        update_empty_fields_only: updateEmptyFieldsOnly,
      },
    })) as unknown as EnrichTask;
    this.task = task;
    return task;
  }

  /**
   * Persist the empty-result placeholder used by the /person endpoint
   * when no engine returned data. The task is marked done so the UI
   * stops polling.
   *
   * Edge-specific helper; no backend equivalent.
   */
  async completeWithEmptyResult(result: EngineResponse | null): Promise<void> {
    const task = this.ensureTask();
    task.status = "done";
    task.details.result = [result ?? EMPTY_RESULT];
    await this.tasks.update(task);
  }

  /**
   * Map `ContactRecord` → snake_case row for the `enrich_contacts` RPC.
   * Joins array-valued fields (`sameAs`, `alternateName`, `telephone`)
   * into comma-separated strings to match the `text[]` column expected
   * by the SQL function.
   */
  private static buildContactsDbPayload(
    contacts: Array<Partial<ContactRecord> & { user_id: string }>,
  ): Array<Record<string, unknown>> {
    return contacts
      .map((contact) => ({
        id: contact.person_id ?? contact.id,
        image: contact.image,
        email: contact.email,
        name: contact.name,
        job_title: contact.jobTitle,
        given_name: contact.givenName,
        family_name: contact.familyName,
        works_for: contact.organization,
        same_as: contact.sameAs?.join(","),
        location: contact.location,
        alternate_name: contact.alternateName?.join(","),
        telephone: contact.telephone?.join(","),
        user_id: contact.user_id,
      }))
      .filter((c) => Boolean(c.id));
  }

  /**
   * Run the `enrich_contacts` RPC and return the list of person ids that
   * were actually updated. Mirrors the backend's `updateContacts`.
   */
  async updateContacts(
    contacts: Partial<ContactRecord>[],
  ): Promise<string[]> {
    const task = this.ensureTask();
    const contactsDB = EnrichmentsClient.buildContactsDbPayload(
      contacts.map((c) => ({ ...c, user_id: task.userId })),
    );
    const { data, error } = await this.client
      .schema("private")
      .rpc("enrich_contacts", {
        p_contacts_data: contactsDB,
        p_update_empty_fields_only:
          task.details.update_empty_fields_only ?? true,
      });

    if (error) throw error;

    const rows = (data ?? []) as Array<{ id: string }>;
    return rows.map((row) => row.id);
  }

  /**
   * Process a batch of enrichment results: merge them into the task,
   * update the contact rows, and register engagement rows. Mirrors the
   * backend's `enrich` while re-throwing on failure so the route can
   * cancel the task.
   */
  async enrich(results: EngineResponse[]): Promise<void> {
    const task = this.ensureTask();

    const enriched = results
      .map(({ data, engine }) => ({ data, engine }))
      .flat();
    task.details.total_enriched += enriched.length;

    this.mergeTaskDetailsResult(results);
    await this.tasks.update(task);

    if (enriched.length) {
      const flatData: EngineResult[] = enriched
        .map(({ data }) => data)
        .flat();
      const updatedPersonIds = await this.updateContacts(flatData);

      if (updatedPersonIds.length) {
        const confirmed = new Set(updatedPersonIds);
        const registrations: Array<{
          person_id: string;
          user_id: string;
          engagement_type: EngagementType;
          service: string;
        }> = [];

        for (const contact of flatData) {
          const personId: string | undefined = contact.person_id;
          if (!personId || !confirmed.has(personId)) continue;
          const engine = enriched.find(({ data }) =>
            data.includes(contact)
          )?.engine;
          if (!engine) continue;
          registrations.push({
            person_id: personId,
            user_id: task.userId,
            engagement_type: "ENRICH",
            service: engine,
          });
        }

        if (registrations.length) {
          await this.engagements.register(registrations);
        }
      }
    }
  }
}
