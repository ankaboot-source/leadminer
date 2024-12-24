import { SupabaseClient } from "@supabase/supabase-js";
import { Logger } from "winston";
import { EnricherResult } from "../../services/email-enrichment/EmailEnricher";
import { EnricherType } from "../../services/email-enrichment/EmailEnricherFactory";
import {
  TaskCategory,
  TaskEnrich,
  TaskStatus,
  TaskType,
} from "../../services/tasks-manager/types";
import Engagement from "./engagement";
import SupabaseTasks from "./tasks";
import { Contact } from "../types";

export interface TaskRedacted {
  id: TaskEnrich["id"];
  status: TaskEnrich["status"];
  details: {
    total_to_enrich: number;
    total_enriched: number;
    error?: string[];
  };
}

export default class Enrichments {
  private task: TaskEnrich | null = null;
  constructor(
    private readonly tasks: SupabaseTasks,
    private readonly client: SupabaseClient,
    private readonly logger: Logger,
  ) {}

  redactedTask() {
    if (!this.task) return null;
    return {
      id: this.task.id,
      status: this.task.status,
      details: {
        total_to_enrich: this.task.details.total_to_enrich,
        total_enriched: this.task.details.total_enriched,
      },
    };
  }

  private mergeResults(result: TaskEnrich["details"]["result"]): void {
    if (!this.task) throw new Error("");
    for (const newResult of result) {
      const existingItem = this.task.details.result.find(
        (item) => item.token && item.token === newResult.token
      );
  
      if (existingItem) {
        Object.assign(existingItem, newResult);
      } else {
        this.task.details.result.push(newResult);
      }
    }
  }

  private async _end(status: TaskStatus) {
    if (!this.task) return;
    this.task.status = status;
    await this.tasks.update(this.task);
  }
  
  async end() {
    await this._end(TaskStatus.Done);
  }

  async cancel() {
    await this._end(TaskStatus.Canceled);
  }

  async createFromId(id: string) {
    this.task = await this.tasks.getById(id) as TaskEnrich;
    return this.task;
  }

  async create(
    userId: string,
    totalToEnrich: number,
    updateEmptyFieldsOnly: boolean,
  ) {
    this.task = (await this.tasks.create({
      userId: userId,
      status: TaskStatus.Running,
      type: TaskType.Enrich,
      category: TaskCategory.Enriching,
      details: {
        result: [],
        total_enriched: 0,
        total_to_enrich: totalToEnrich,
        update_empty_fields_only: updateEmptyFieldsOnly,
      },
    })) as TaskEnrich;
    return this.task;
  }

  async updateContacts(contacts: Partial<EnricherResult>[]) {
    if (!this.task) return null;
    const contactsDB = contacts.map((contact) => ({
      image: contact.image,
      email: contact.email,
      name: contact.name,
      job_title: contact.jobTitle,
      given_name: contact.givenName,
      family_name: contact.familyName,
      works_for: contact.organization,
      same_as: contact.sameAs?.join(","),
      location: contact.location?.join(","),
      alternate_name: contact.alternateName?.join(","),
    }));

    const { error } = await this.client
      .schema("private")
      .rpc("enrich_contacts", {
        p_contacts_data: contactsDB.map((contact) => ({
          ...contact,
          user_id: this.task?.userId,
        })),
        p_update_empty_fields_only:
          this.task.details.update_empty_fields_only ?? true,
      });

    if (error) throw new Error(error.message);
  }

  async enrich(result: TaskEnrich["details"]["result"]) {
    if (!this.task) throw new Error("");
    const enriched = result.map(({ data }) => data).flat();

    if (enriched.length) {
      await this.updateContacts(enriched);
      this.task.details.total_enriched += enriched.length;
    }

    this.mergeResults(result);

    await this.tasks.update(this.task);
  }
}