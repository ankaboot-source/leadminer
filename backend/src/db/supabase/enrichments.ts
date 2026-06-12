import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from 'winston';
import { TaskCategory, TaskStatus, TaskType, EnrichTask } from '../types';

import Engagements, { EngagementType } from './engagements';
import SupabaseTasks from './tasks';

interface Contact {
  person_id?: string;
  id: string;
  userId: string;
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
}

interface TaskRedacted {
  id: EnrichTask['id'];
  userId: EnrichTask['userId'];
  status: EnrichTask['status'];
  details: {
    total_to_enrich: number;
    total_enriched: number;
    error?: string[];
  };
}

export default class Enrichments {
  private task: EnrichTask | null = null;

  constructor(
    private readonly tasks: SupabaseTasks,
    private readonly engagements: Engagements,
    private readonly client: SupabaseClient,
    private readonly logger: Logger
  ) {}

  private ensureTask(): EnrichTask {
    if (!this.task) {
      throw new Error(
        'No task is currently set. Ensure a task is initialized before using this method.'
      );
    }
    return this.task;
  }

  private mergeTaskDetailsResult(
    result: EnrichTask['details']['result']
  ): void {
    const task = this.ensureTask();
    for (const newResult of result) {
      const existingItem = task.details.result.find(
        (item) => item.token && item.token === newResult.token
      );

      if (existingItem) {
        Object.assign(existingItem, newResult);
      } else {
        task.details.result.push(newResult);
      }
    }
  }

  private async setTaskStatus(status: TaskStatus) {
    const task = this.ensureTask();
    task.status = status;
    task.startedAt = new Date().toISOString();
    await this.tasks.update(task);
    const msg = `task status updated to ${status}`;
    this.logger.debug(`[${this.constructor.name}.setTaskStatus]: ${msg}`);
  }

  public redactedTask(): TaskRedacted {
    const task = this.ensureTask();
    return {
      id: task.id,
      userId: task.userId,
      status: task.status,
      details: {
        total_to_enrich: task.details.total_to_enrich,
        total_enriched: task.details.total_enriched
      }
    };
  }

  public async end() {
    await this.setTaskStatus(TaskStatus.Done);
  }

  public async cancel() {
    await this.setTaskStatus(TaskStatus.Canceled);
  }

  public async createFromId(id: string) {
    this.task = (await this.tasks.getById(id)) as EnrichTask;
    return this.task;
  }

  public async create(
    userId: string,
    totalToEnrich: number,
    updateEmptyFieldsOnly: boolean
  ) {
    this.task = (await this.tasks.create({
      userId,
      status: TaskStatus.Running,
      type: TaskType.Enrich,
      category: TaskCategory.Enriching,
      details: {
        result: [],
        total_enriched: 0,
        total_to_enrich: totalToEnrich,
        update_empty_fields_only: updateEmptyFieldsOnly
      }
    })) as EnrichTask;
    return this.task;
  }

  public async updateContacts(contacts: Partial<Contact>[]): Promise<string[]> {
    const task = this.ensureTask();
    const contactsDB = contacts
      .map((contact) => ({
        id: (contact as any).person_id ?? contact.id,
        image: contact.image,
        email: contact.email,
        name: contact.name,
        job_title: contact.jobTitle,
        given_name: contact.givenName,
        family_name: contact.familyName,
        works_for: contact.organization,
        same_as: contact.sameAs?.join(','),
        location: contact.location,
        alternate_name: contact.alternateName?.join(','),
        telephone: (contact as any).telephone?.join(','),
        user_id: task.userId
      }))
      .filter((c) => Boolean(c.id));
    const { data, error } = await this.client
      .schema('private')
      .rpc('enrich_contacts', {
        p_contacts_data: contactsDB,
        p_update_empty_fields_only:
          task.details.update_empty_fields_only ?? true
      });

    if (error) throw error;

    const rows = data as { id: string }[];
    return rows.map((row) => row.id);
  }

  public async enrich(result: EnrichTask['details']['result']) {
    try {
      const task = this.ensureTask();

      const enriched = result
        .map(({ data, engine }) => ({ data, engine }))
        .flat();
      task.details.total_enriched += enriched.length;

      this.mergeTaskDetailsResult(result);

      await this.tasks.update(task);

      if (enriched.length) {
        const flatData = enriched.map(({ data }) => data).flat();
        const updatedPersonIds = await this.updateContacts(flatData);

        if (updatedPersonIds.length) {
          const confirmed = new Set(updatedPersonIds);
          const registrations: {
            person_id: string;
            user_id: string;
            engagement_type: EngagementType;
            service: string;
          }[] = [];

          for (const contact of flatData) {
            const person_id: string | undefined =
              (contact as any).person_id ?? contact.id;
            if (!person_id || !confirmed.has(person_id)) continue;
            const engine = enriched.find(({ data }) =>
              data.includes(contact)
            )?.engine;
            if (!engine) continue;
            registrations.push({
              person_id,
              user_id: task.userId,
              engagement_type: 'ENRICH',
              service: engine
            });
          }

          if (registrations.length) {
            await this.engagements.register(registrations);
          }
        }
      }
    } catch (err) {
      const msg = (err as Error).message || 'Unexpected error';
      this.logger.error(`[${this.constructor.name}.enrich]: ${msg}`);
    }
  }
}
