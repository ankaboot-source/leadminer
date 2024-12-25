import { Logger } from 'winston';
import { SupabaseClient } from '@supabase/supabase-js';
import { TaskCategory, TaskStatus, TaskType } from '../types';

import Engagements from './engagements';
import SupabaseTasks from './tasks';
import { TaskEnrich } from '../../services/tasks-manager/types';

interface Contact {
  id: string;
  userId: string;
  email: string;
  name?: string;
  givenName?: string;
  familyName?: string;
  alternateName?: string[];
  location?: string[];
  organization?: string;
  jobTitle?: string;
  sameAs?: string[];
  image?: string;
}

interface TaskRedacted {
  id: TaskEnrich['id'];
  userId: TaskEnrich['userId'];
  status: TaskEnrich['status'];
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
    private readonly engagements: Engagements,
    private readonly client: SupabaseClient,
    private readonly logger: Logger
  ) {}

  private ensureTask(): TaskEnrich {
    if (!this.task) {
      throw new Error(
        'No task is currently set. Ensure a task is initialized before using this method.'
      );
    }
    return this.task;
  }

  private mergeTaskDetailsResult(
    result: TaskEnrich['details']['result']
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
    this.task = (await this.tasks.getById(id)) as TaskEnrich;
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
    })) as TaskEnrich;
    return this.task;
  }

  public async updateContacts(contacts: Partial<Contact>[]) {
    const task = this.ensureTask();
    const contactsDB = contacts.map((contact) => ({
      image: contact.image,
      email: contact.email,
      name: contact.name,
      job_title: contact.jobTitle,
      given_name: contact.givenName,
      family_name: contact.familyName,
      works_for: contact.organization,
      same_as: contact.sameAs?.join(','),
      location: contact.location?.join(','),
      alternate_name: contact.alternateName?.join(','),
      user_id: task.userId
    }));
    const { error } = await this.client
      .schema('private')
      .rpc('enrich_contacts', {
        p_contacts_data: contactsDB,
        p_update_empty_fields_only:
          task.details.update_empty_fields_only ?? true
      });

    if (error) throw error;
  }

  public async enrich(result: TaskEnrich['details']['result']) {
    try {
      const task = this.ensureTask();

      const enriched = result.map(({ data }) => data).flat();
      if (enriched.length) {
        await this.updateContacts(enriched);
        await this.engagements.register(
          task.userId,
          enriched.map((contact) => contact.email as string),
          'ENRICH'
        );
        task.details.total_enriched += enriched.length;
      }
      this.mergeTaskDetailsResult(result);
      await this.tasks.update(task);
    } catch (err) {
      const msg = (err as Error).message || 'Unexpected error';
      this.logger.error(`[${this.constructor.name}.enrich]: ${msg}`);
    }
  }
}
