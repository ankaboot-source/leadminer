import { Users } from '../db/interfaces/Users';
import { Contact } from '../db/types';
import emailEnrichmentService from '../services/email-enrichment';
import { EnricherResult } from '../services/email-enrichment/EmailEnricher';
import {
  Enricher,
  EnricherType
} from '../services/email-enrichment/EmailEnricherFactory';
import Billing from '../utils/billing-plugin';
import logger from '../utils/logger';
import supabaseClient from '../utils/supabase';

export interface TaskEnrich {
  id: string;
  user_id: string;
  status: 'running' | 'done' | 'canceled';
  category: 'enriching';
  type: 'enrich';
  started_at: string | null;
  stopped_at: string | null;
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

export function redactEnrichmentTask(task: TaskEnrich): TaskEnrichRedacted {
  const { id, status, details } = task;
  const { progress, error } = details;
  return {
    id,
    status,
    details: { progress, error }
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
  if (!enrichAll) {
    return contacts ?? [];
  }

  const refinedEmails = await getRefinedPersonsEmails(userId);

  const { data, error } = await supabaseClient
    .from('persons')
    .select('email, name')
    .in('email', refinedEmails)
    .returns<{ email: string; name: string }[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data.map(({ email, name }) => ({ email, name }));
}

async function createEnrichmentTask(
  userId: string,
  enricherType: EnricherType,
  contactsList: Partial<Contact>[],
  updateEmptyFieldsOnly: boolean
) {
  const { data: task, error } = await supabaseClient
    .from('tasks')
    .insert({
      user_id: userId,
      status: 'running',
      type: 'enrich',
      category: 'enriching',
      details: {
        config: {
          user_id: userId,
          instance: enricherType,
          update_empty_fields_only: updateEmptyFieldsOnly
        },
        progress: {
          enriched: 0,
          total: contactsList.length
        }
      }
    })
    .select('*')
    .single<TaskEnrich>();

  if (error) throw new Error(error.message);
  return task;
}

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

export async function upsertEnrichmentTask(
  taskId: string,
  status: 'running' | 'done' | 'canceled',
  task: Partial<TaskEnrich>
) {
  const { data, error } = await supabaseClient
    .from('tasks')
    .upsert({
      ...task,
      status,
      stopped_at: ['done', 'canceled'].includes(status)
        ? new Date().toISOString()
        : null
    })
    .eq('id', taskId)
    .select('*')
    .single<TaskEnrich>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function addContactsToEngagementHistory(
  user_id: string,
  emails: string[]
) {
  const insertPromises = emails.map((email) =>
    supabaseClient.from('engagement').upsert({
      email,
      user_id,
      engagement_type: 'ENRICH'
    })
  );

  const results = await Promise.all(insertPromises);
  results.forEach(({ error }) => {
    if (error) {
      throw new Error(error.message);
    }
  });
}

/**
 * Enriches a contact with the provided data.
 * @param userId - The ID of the user.
 * @param contact - The contact data to enrich.
 * @throws Error if there is an issue updating the contact in the database.
 */
export async function enrichContactDB(
  userResolver: Users,
  userId: string,
  updateEmptyFieldsOnly: boolean,
  contacts: Partial<EnricherResult>[]
) {
  const contactsDB: Partial<Contact>[] = contacts.map((contact) => ({
    image: contact.image,
    email: contact.email,
    name: contact.name,
    same_as: contact.sameAs,
    location: contact.location,
    job_title: contact.jobTitle,
    given_name: contact.givenName,
    family_name: contact.familyName,
    works_for: contact.organization
  }));

  const { error } = await supabaseClient.rpc('enrich_contacts', {
    p_contacts_data: contactsDB.map((contact) => ({
      ...contact,
      user_id: userId,
      alternate_names: contact.alternate_names?.join(','),
      same_as: contact.same_as?.join(','),
      location: contact.location?.join(',')
    })),
    p_update_empty_fields_only: updateEmptyFieldsOnly ?? true
  });

  if (error) throw new Error(error.message);

  await addContactsToEngagementHistory(
    userId,
    contacts.map((contact) => contact.email as string)
  );

  if (Billing) {
    await Billing.deductCustomerCredits(userId, contacts.length);
  }
}

export async function searchEnrichmentCache(
  contacts: Partial<Contact>[]
): Promise<EnrichmentCacheResult[]> {
  const emails = contacts.map((contact) => contact.email);

  const { data, error } = await supabaseClient.rpc(
    'search_recent_enriched_emails',
    {
      emails
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function enrichFromCache(
  userResolver: Users,
  userId: string,
  updateEmptyFieldsOnly: boolean,
  contacts: Partial<Contact>[]
): Promise<[TaskEnrichRedacted | null, Partial<Contact>[]]> {
  const cacheResult = await searchEnrichmentCache(contacts);

  if (!cacheResult.length) return [null, contacts];

  const enrichmentCache = new Set(
    cacheResult.map(({ result }) => result.email)
  );

  await enrichContactDB(
    userResolver,
    userId,
    updateEmptyFieldsOnly,
    cacheResult.map((cache) => cache.result)
  );

  logger.debug('Enrichment cache hit: Enriched from cache', cacheResult);

  return [
    {
      id: 'enrichment-cache',
      status: 'done',
      details: {
        progress: { total: contacts.length, enriched: cacheResult.length }
      }
    },
    contacts.filter((contact) => !enrichmentCache.has(contact.email as string))
  ];
}

async function startSyncEnricherTask(
  userResolver: Users,
  enrichParams: {
    userId: string;
    updateEmptyFieldsOnly: boolean;
    contact: Partial<Contact>;
  }
) {
  const { userId, contact, updateEmptyFieldsOnly } = enrichParams;
  const enricher = emailEnrichmentService.getEnricher({}, 'thedig');

  const task = await createEnrichmentTask(
    userId,
    enricher.type,
    [contact],
    updateEmptyFieldsOnly
  );

  const config = {
    user_id: userId,
    instance: enricher.type,
    update_empty_fields_only: updateEmptyFieldsOnly
  };

  try {
    const { raw_data: rawData, data } =
      await enricher.instance.enrichSync(contact);
    await enrichContactDB(userResolver, userId, updateEmptyFieldsOnly, data);
    return await upsertEnrichmentTask(task.id, 'done' as TaskEnrich['status'], {
      ...task,
      details: {
        config,
        progress: { enriched: 1, total: 1 },
        result: { raw_data: rawData, data }
      }
    });
  } catch (err) {
    await upsertEnrichmentTask(task.id, 'canceled', {
      ...task,
      details: {
        config,
        progress: { enriched: 0, total: 1 },
        error: (err as Error).message
      }
    });
    throw err;
  }
}

export async function enrichSync(
  userResolver: Users,
  contact: Partial<Contact>,
  enrichParams: {
    userId: string;
    updateEmptyFieldsOnly: boolean;
  }
) {
  const { userId, updateEmptyFieldsOnly } = enrichParams;

  const [enrichmentTask] = await enrichFromCache(
    userResolver,
    userId,
    updateEmptyFieldsOnly,
    [contact]
  );

  if (enrichmentTask) return [enrichmentTask];

  const task = await startSyncEnricherTask(userResolver, {
    contact,
    userId,
    updateEmptyFieldsOnly
  });
  return [redactEnrichmentTask(task)];
}

async function asyncEnricherTask(
  userId: string,
  enrichParams: {
    webhook: string;
    updateEmptyFieldsOnly: boolean;
  },
  enricher: Enricher,
  contactsList: Partial<Contact>[]
) {
  const task = await createEnrichmentTask(
    userId,
    enricher.type,
    contactsList,
    enrichParams.updateEmptyFieldsOnly
  );
  try {
    const { token } = await enricher.instance.enrichAsync(
      contactsList,
      enrichParams.webhook + task.id
    );
    task.details.config.secret = token;
    return await upsertEnrichmentTask(task.id, 'running', task);
  } catch (err) {
    return await upsertEnrichmentTask(task.id, 'canceled', {
      ...task,
      details: {
        ...task.details,
        error: (err as Error).message ?? 'Failed to make enrichment request'
      }
    });
  }
}

async function startAsyncEnricherTasks(
  userId: string,
  enrichParams: {
    webhook: string;
    updateEmptyFieldsOnly: boolean;
  },
  contacts: Partial<Contact>[]
) {
  const enrichers = emailEnrichmentService.getEnrichers(contacts);
  const promises = enrichers.map(([enricher, contactsList]) =>
    asyncEnricherTask(
      userId,
      {
        updateEmptyFieldsOnly: enrichParams.updateEmptyFieldsOnly,
        webhook: enrichParams.webhook
      },
      enricher,
      contactsList
    )
  );
  return Promise.all(promises);
}

export async function enrichAsync(
  userResolver: Users,
  contacts: Partial<Contact>[],
  enrichParams: {
    userId: string;
    webhook: string;
    updateEmptyFieldsOnly: boolean;
  }
) {
  const { userId, updateEmptyFieldsOnly } = enrichParams;
  const [enrichmentTask, contactsToEnrich] = await enrichFromCache(
    userResolver,
    userId,
    updateEmptyFieldsOnly,
    contacts
  );

  if (enrichmentTask && !contactsToEnrich.length) return [enrichmentTask];

  const results = [
    enrichmentTask,
    ...(
      await startAsyncEnricherTasks(userId, enrichParams, contactsToEnrich)
    ).map((task) => redactEnrichmentTask(task))
  ];

  return results.filter(Boolean);
}

async function updateContactAndTaskDB(
  userResolver: Users,
  userId: string,
  task: TaskEnrich,
  result: {
    raw_data: unknown;
    data: EnricherResult[];
  }
) {
  const { id, details } = task;
  const { data, raw_data: rawData } = result;
  await enrichContactDB(
    userResolver,
    userId,
    details.config.update_empty_fields_only,
    data
  );
  await upsertEnrichmentTask(id, 'done', {
    ...task,
    details: {
      config: details.config,
      progress: { ...details.progress, enriched: result.data.length },
      result: { raw_data: rawData, data }
    }
  });
}

export async function asyncWebhookEnrich(
  userResolver: Users,
  task: TaskEnrich,
  data: unknown
) {
  const { id, user_id: userId, details } = task;
  try {
    const {
      details: { config }
    } = task;
    const enricher = emailEnrichmentService.getEnricher({}, config.instance);
    const result = enricher.instance.enrichmentMapper(data);
    await updateContactAndTaskDB(userResolver, userId, task, result);
  } catch (err) {
    await upsertEnrichmentTask(id, 'canceled', {
      ...task,
      details: {
        ...details,
        error:
          (err as Error).message || 'Error processing enrichment from webhook'
      }
    });
    throw err;
  }
}
