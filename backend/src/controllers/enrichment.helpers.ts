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
    total_enriched: number;
    total_to_enrich: number;
    update_empty_fields_only: boolean;
    error?: string;
    result: {
      token?: string;
      error?: string;
      raw_data?: unknown;
      data?: EnricherResult[];
      instance: EnricherType;
    }[];
  };
}

export interface EnrichmentCacheResult {
  task_id: string;
  user_id: string;
  created_at: string;
  instance: EnricherType;
  result: EnricherResult;
}

export interface TaskEnrichRedacted {
  id: TaskEnrich['id'];
  status: TaskEnrich['status'];
  details: {
    total_to_enrich: number;
    total_enriched: number;
    error?: string[];
  };
}

export function redactEnrichmentTask(task: TaskEnrich): TaskEnrichRedacted {
  const {
    id,
    status,
    details: { total_to_enrich: total, total_enriched: enriched }
  } = task;
  return {
    id,
    status,
    details: {
      total_to_enrich: total,
      total_enriched: enriched
    }
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

export async function createEnrichmentTask(
  userId: string,
  totalToEnrich: number,
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
        total_to_enrich: totalToEnrich,
        total_enriched: 0,
        update_empty_fields_only: updateEmptyFieldsOnly,
        result: []
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

export async function updateEnrichmentTaskDB(task: TaskEnrich) {
  const { data, error } = await supabaseClient
    .from('tasks')
    .update(task)
    .eq('id', task.id)
    .select('*')
    .single<TaskEnrich>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateEnrichmentTask(
  task: TaskEnrich,
  results: TaskEnrich['details']['result'],
  status?: TaskEnrich['status']
) {
  const enrichmentTask = task;

  // Update task progress
  enrichmentTask.details.total_enriched = results.reduce(
    (sum, { data }) => sum + (data?.length ?? 0),
    enrichmentTask.details.total_enriched
  );

  if (!status) {
    // update task status
    enrichmentTask.status = [
      ...enrichmentTask.details.result,
      ...results
    ].every(({ error }) => Boolean(error))
      ? 'canceled'
      : 'done';
  } else {
    enrichmentTask.status = status;
  }

  // Update task timing;
  enrichmentTask.stopped_at = ['done', 'canceled'].includes(
    enrichmentTask.status
  )
    ? new Date().toISOString()
    : null;

  enrichmentTask.details.result.push(
    ...results.filter(
      // Filter out any results with token === 'cache' results
      (result) => result.token !== 'cache'
    )
  );

  const updatedTask = await updateEnrichmentTaskDB(enrichmentTask);
  return updatedTask;
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

  const { data, error } = await supabaseClient.rpc('enriched_most_recent', {
    emails
  });

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
): Promise<[TaskEnrich | null, Partial<Contact>[]]> {
  try {
    const cacheResult = await searchEnrichmentCache(contacts);

    if (!cacheResult.length) return [null, contacts];

    const enrichmentCache = new Set(
      cacheResult.map(({ result }) => result.email)
    );

    const mappedResult = cacheResult
      .map((cache) => {
        const enricher = emailEnrichmentService.getEnricher(
          {},
          cache.instance as unknown as EnricherType
        );
        const enrichResult = enricher.instance.enrichmentMapper([cache.result]);
        return {
          instance: enricher.type,
          ...enrichResult
        };
      })
      .flat();

    await enrichContactDB(
      userResolver,
      userId,
      updateEmptyFieldsOnly,
      mappedResult.map(({ data }) => data).flat()
    );

    logger.debug('Enrichment cache hit: Enriched from cache', cacheResult);

    return [
      {
        status: 'done',
        type: 'enrich',
        category: 'enriching',
        id: 'cache',
        started_at: null,
        stopped_at: null,
        user_id: userId,
        details: {
          total_to_enrich: contacts.length,
          total_enriched: mappedResult.length,
          update_empty_fields_only: updateEmptyFieldsOnly,
          result: mappedResult.map((res) => ({
            ...res,
            token: 'cache'
          }))
        }
      },
      contacts.filter(
        (contact) => !enrichmentCache.has(contact.email as string)
      )
    ];
  } catch (err) {
    logger.error('Error enriching from cache', err);
    return [null, contacts];
  }
}

export async function enrichSync({
  enricher,
  contacts
}: {
  userResolver: Users;
  enricher: Enricher;
  contacts: Partial<Contact>[];
}): Promise<[TaskEnrich['details']['result'], Partial<Contact>[]]> {
  const toEnrich = contacts.filter((contact) => enricher.rule(contact));

  try {
    const results = (
      await Promise.all(
        toEnrich.map(async (c) => {
          try {
            const { data, raw_data: rawData } =
              await enricher.instance.enrichSync(c);
            return {
              data,
              raw_data: rawData,
              instance: enricher.type
            };
          } catch (err) {
            return {
              instance: enricher.type,
              error: (err as Error).message
            };
          }
        })
      )
    ).flat();

    const enrichedEmails = new Set(
      results.flat().flatMap(({ data = [] }) => data.map(({ email }) => email))
    );
    const notEnriched = contacts.filter(
      (c) => !enrichedEmails.has(c.email as string)
    );
    return [results, notEnriched];
  } catch (err) {
    return [[], contacts];
  }
}

export async function enrichPersonSync(
  userResolver: Users,
  task: TaskEnrich,
  contacts: Partial<Contact>[]
): Promise<[TaskEnrich['details']['result'], Partial<Contact>[]]> {
  let contactsToEnrich = contacts;

  const enrichResults: TaskEnrich['details']['result'] = [];

  const enrichers = [
    emailEnrichmentService.getEnricher({}, 'thedig'),
    emailEnrichmentService.getEnricher({}, 'proxycurl')
  ].filter(Boolean);

  if (!enrichers.length) throw new Error('No enrichers are available to use');

  for await (const enricher of enrichers) {
    try {
      const [results, notEnriched] = (await enrichSync({
        enricher,
        userResolver,
        contacts: contactsToEnrich
      })) ?? [[], []];

      const enrichedResult = results.flatMap(({ data = [] }) => data);
      if (enrichedResult.length) {
        await enrichContactDB(
          userResolver,
          task.user_id,
          task.details.update_empty_fields_only,
          enrichedResult
        );
      }

      contactsToEnrich = notEnriched;
      enrichResults.push(...results);

      if (!notEnriched.length) break;
    } catch (err) {
      enrichResults.push({
        instance: enricher.type,
        error: (err as Error).message
      });
    }
  }
  const contactsNotEnriched = contactsToEnrich;
  return [enrichResults, contactsNotEnriched];
}

export async function enrichWebhook(
  userResolver: Users,
  task: TaskEnrich,
  token: string,
  results: unknown
) {
  const enrichmentTask = task;
  const enricher = enrichmentTask.details.result.find(
    (enr) => enr.token === token
  );

  if (!enricher) {
    throw new Error(`No enricher found for token: ${token}`);
  }

  const enrichResult: TaskEnrich['details']['result'][0] = {
    token,
    instance: enricher.instance,
    data: [],
    raw_data: []
  };

  try {
    const enrichService = emailEnrichmentService.getEnricher(
      {},
      enricher.instance
    );
    const { data, raw_data: rawData } =
      enrichService.instance.enrichmentMapper(results);

    if (data.length) {
      await enrichContactDB(
        userResolver,
        enrichmentTask.user_id,
        enrichmentTask.details.update_empty_fields_only,
        data
      );
    }

    enrichResult.data = data;
    enrichResult.raw_data = rawData;
  } catch (err) {
    enrichResult.error = (err as Error).message;
  }

  return enrichResult;
}
