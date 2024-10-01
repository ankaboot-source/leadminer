import ENV from '../config';
import { Users } from '../db/interfaces/Users';
import { Contact } from '../db/types';
import CreditsHandler from '../services/credits/creditsHandler';
import emailEnrichmentService from '../services/email-enrichment';
import { EnricherResult } from '../services/email-enrichment/EmailEnricher';
import {
  Enricher,
  EnricherType
} from '../services/email-enrichment/EmailEnricherFactory';
import logger from '../utils/logger';
import supabaseClient from '../utils/supabase';

export interface TaskEnrich {
  id: string;
  user_id: string;
  status: 'running' | 'done' | 'canceled';
  category: 'enriching';
  type: 'enrich';
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
  contacts: Partial<Contact>[]
) {
  const { error } = await supabaseClient.rpc('enrich_contacts', {
    p_contacts_data: contacts.map((contact) => ({
      ...contact,
      user_id: userId,
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
      details: { progress: { total: 1, enriched: 1 } }
    },
    contacts.filter((contact) => enrichmentCache.has(contact.email as string))
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
  const { raw_data: rawData, data } = await enricher.instance.enrichSync(
    contact
  );
  const task = await createEnrichmentTask(
    userId,
    enricher.type,
    [contact],
    updateEmptyFieldsOnly
  );
  await enrichContactDB(userResolver, userId, updateEmptyFieldsOnly, data);
  return upsertEnrichmentTask(task.id, 'done', {
    details: {
      config: {
        user_id: userId,
        instance: enricher.type,
        update_empty_fields_only: updateEmptyFieldsOnly
      },
      progress: { enriched: 1, total: 1 },
      result: { raw_data: rawData, data }
    }
  });
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

  const [enrichmentTask, [contactToEnrich]] = await enrichFromCache(
    userResolver,
    userId,
    updateEmptyFieldsOnly,
    [contact]
  );

  if (enrichmentTask && !contactToEnrich) return [enrichmentTask];

  const task = await startSyncEnricherTask(userResolver, {
    contact,
    userId,
    updateEmptyFieldsOnly
  });
  return redactEnrichmentTask(task);
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
  const promises = enrichers.map(async ([enricher, contactsList]) =>
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

  const results = await startAsyncEnricherTasks(userId, enrichParams, contacts);

  return results.map((task) => redactEnrichmentTask(task));
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
      details: {
        ...details,
        error:
          (err as Error).message || 'Error processing enrichment from webhook'
      }
    });
    throw err;
  }
}
