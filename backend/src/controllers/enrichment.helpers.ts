import ENV from '../config';
import { Users } from '../db/interfaces/Users';
import { Contact } from '../db/types';
import CreditsHandler from '../services/credits/creditsHandler';
import { EnricherResult } from '../services/email-enrichment/EmailEnricher';
import { EnricherType } from '../services/email-enrichment/EmailEnricherFactory';
import supabaseClient from '../utils/supabase';

export interface TaskEnrich {
  id: string;
  user_id: string;
  status: 'running' | 'done' | 'canceled';
  details: {
    config: {
      secret?: string;
      user_id: string;
      instance: EnricherType;
      update_empty_fields_only: boolean;
    };
    progress: {
      total: number;
      enriched: number;
    };
    result?: {
      raw_data: unknown;
      data: EnricherResult[];
    };
    error?: string;
  };
}

export interface EnrichmentCacheResult {
  task_id: string;
  user_id: string;
  created_at: string;
  result: EnricherResult;
}

export interface TaskEnrichRedacted {
  id: TaskEnrich['id'];
  status: TaskEnrich['status'];
  details: {
    progress: TaskEnrich['details']['progress'];
    error?: string;
  };
}

/**
 * Queries emails for a given user from table "refinedpersons".
 * @param userId - The ID of the user.
 * @returns List of email addresses.
 * @throws Error if there is an issue fetching data from the database.
 */
export async function getRefinedPersonsEmails(userId: string) {
  const { data: emails, error } = await supabaseClient
    .from('refinedpersons')
    .select('email')
    .match({ user_id: userId })
    .returns<{ email: string }[]>();

  if (error) {
    throw new Error(error.message);
  }

  return emails.map((record) => record.email);
}

/**
 * Queries enriched emails for a given user.
 * @param userId - The ID of the user.
 * @returns List of enriched email addresses.
 * @throws Error if there is an issue fetching data from the database.
 */
export async function getEnrichedEmails(userId: string) {
  const { data: emails, error } = await supabaseClient
    .from('engagement')
    .select('email')
    .match({ user_id: userId, engagement_type: 'ENRICH' })
    .returns<{ email: string }[]>();

  if (error) {
    throw new Error(error.message);
  }

  return emails.map((record) => record.email);
}

/**
 * Queries all contacts from the persons that are not yet enriched.
 * @param userId - The ID of the user.
 * @returns List of contacts to be enriched.
 * @throws Error if there is an issue fetching data from the database.
 */
export async function getContactsToEnrich(
  userId: string,
  enrichAll: boolean,
  contacts?: Partial<Contact>[]
) {
  const enrichedEmails = await getEnrichedEmails(userId);

  if (!enrichAll && contacts?.length) {
    return contacts.filter(
      ({ email }) => !enrichedEmails.includes(email as string)
    );
  }

  const refinedEmails = await getRefinedPersonsEmails(userId);

  const { data, error } = await supabaseClient
    .from('persons')
    .select('email, name')
    .not('email', 'in', `(${enrichedEmails.join(',')})`)
    .in('email', refinedEmails)
    .returns<{ email: string; name: string }[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data.map(({ email, name }) => ({ email, name }));
}

/**
 * Starts a new enrichment task.
 * @param userId - The ID of the user.
 * @returns The newly created task.
 * @throws Error if there is an issue creating the task in the database.
 */
export async function startEnrichmentTask(userId: string) {
  const { data: task, error } = await supabaseClient
    .from('tasks')
    .insert({
      user_id: userId,
      status: 'running',
      type: 'enrich',
      category: 'enriching'
    })
    .select('id')
    .single<{ id: string }>();

  if (error) {
    throw new Error(error.message);
  }
  return task;
}

/**
 * Retrieves an enrichment task by its ID.
 * @param taskId - The ID of the task.
 * @returns The task data.
 * @throws Error if there is an issue fetching the task from the database.
 */
export async function getEnrichmentTask(taskId: string) {
  const { data: task, error } = await supabaseClient
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single<TaskEnrich>();

  if (error) {
    throw new Error(error.message);
  }

  return task;
}

/**
 * Updates an enrichment task with the given status and details.
 * @param taskId - The ID of the task.
 * @param status - The new status of the task.
 * @param details - Optional details to update the task with.
 * @throws Error if there is an issue updating the task in the database.
 */
export async function updateEnrichmentTask(
  taskId: string,
  status: 'running' | 'done' | 'canceled',
  details?: Partial<TaskEnrich['details']>
) {
  const updateData: Partial<{
    status: string;
    details?: Partial<TaskEnrich['details']>;
    stopped_at: string | null;
  }> = {
    status,
    stopped_at: ['done', 'canceled'].includes(status)
      ? new Date().toISOString()
      : null
  };

  if (details) {
    updateData.details = details;
  }

  const { data, error } = await supabaseClient
    .from('tasks')
    .update(updateData)
    .eq('id', taskId)
    .select('*')
    .single<TaskEnrich>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Enriches a contact with the provided data.
 * @param userId - The ID of the user.
 * @param contact - The contact data to enrich.
 * @throws Error if there is an issue updating the contact in the database.
 */
export async function enrichContact(
  userResolver: Users,
  userId: string,
  updateEmptyFieldsOnly: boolean,
  contacts: Partial<Contact>[]
) {
  // update contacts
  const { error } = await supabaseClient.rpc('enrich_contacts', {
    p_contacts_data: contacts.map((contact) => ({
      ...contact,
      same_as: contact.same_as?.join(','),
      location: contact.location?.join(',')
    })),
    p_update_empty_fields_only: updateEmptyFieldsOnly ?? true
  });

  if (error) {
    throw new Error(error.message);
  }

  // Update engagement table
  await Promise.all(
    contacts.map(async ({ email, user_id }) => {
      const { error: engagementError } = await supabaseClient
        .from('engagement')
        .upsert({
          email,
          user_id,
          engagement_type: 'ENRICH'
        });

      if (engagementError) {
        throw new Error(engagementError.message);
      }
    })
  );

  if (ENV.ENABLE_CREDIT) {
    const creditsHandler = new CreditsHandler(
      userResolver,
      ENV.CREDITS_PER_CONTACT
    );
    await creditsHandler.deduct(userId, contacts.length);
  }
}

export async function searchEnrichmentCache(
  contacts: Partial<Contact>[]
): Promise<EnrichmentCacheResult[]> {
  const emails = contacts.map((contact) => contact.email);

  const { data, error } = await supabaseClient.rpc(
    'search_previous_enriched_emails',
    {
      emails
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export function redactEnrichmentTask(task: TaskEnrich): TaskEnrichRedacted {
  const { id, status, details } = task;
  const { progress, error } = details;
  return {
    id,
    status,
    details: { progress, error }
  };
}
