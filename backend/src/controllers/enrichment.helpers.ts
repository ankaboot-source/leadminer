import { EngineResponse, EngineResult } from '../services/enrichment/Engine';

import Billing from '../utils/billing-plugin';
import { Contact } from '../db/types';
import ENV from '../config';
import Engagements from '../db/supabase/engagements';
import Enricher from '../services/enrichment/Enricher';
import EnrichmentService from '../services/enrichment';
import Enrichments from '../db/supabase/enrichments';
import SupabaseTasks from '../db/supabase/tasks';
import logger from '../utils/logger';
import supabaseClient from '../utils/supabase';

/**
 * Queries person ids for a given user from table "refinedpersons".
 * @param userId - The ID of the user.
 * @returns List of person UUIDs.
 */
export async function getRefinedPersons(userId: string) {
  const { data, error } = await supabaseClient
    .schema('private')
    .from('refinedpersons')
    .select('person_id')
    .match({ user_id: userId })
    .returns<{ person_id: string }[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data.map((record) => record.person_id);
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

  const refinedPersonIds = await getRefinedPersons(userId);

  const { data, error } = await supabaseClient
    .schema('private')
    .from('persons')
    .select('id, email, name')
    .eq('user_id', userId)
    .in('id', refinedPersonIds)
    .returns<{ id: string; email: string | null; name: string }[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data.map(({ id, email, name }) => ({ id, email, name }));
}

export async function restrictOrDecline(userId: string, totalContacts: number) {
  const { availableUnits } = (await Billing?.validateCustomerCredits(
    userId,
    totalContacts
  )) ?? { availableUnits: totalContacts };

  return {
    total: totalContacts,
    available: Math.floor(availableUnits)
  };
}

export async function prepareForEnrichment(
  userId: string,
  enrichAll: boolean,
  updateEmptyFieldsOnly: boolean,
  contacts: Contact[]
) {
  const toEnrich = await getContactsToEnrich(userId, enrichAll, contacts);
  const { total, available } = await restrictOrDecline(userId, toEnrich.length);
  const selectedContacts = toEnrich.slice(0, available);

  return {
    total,
    available,
    updateEmptyFieldsOnly,
    contacts: selectedContacts,
    contact: selectedContacts[0]
  };
}

export function createEnrichmentTask() {
  const tasks = new SupabaseTasks(supabaseClient, logger);
  const engagements = new Engagements(supabaseClient, logger);
  const enrichmentsDB = new Enrichments(
    tasks,
    engagements,
    supabaseClient,
    logger
  );
  return enrichmentsDB;
}

export interface EnrichmentCache {
  task_id: string;
  user_id: string;
  created_at: string;
  engine: string;
  result: EngineResult;
}

export async function getEnrichmentCache(
  contacts: Partial<Contact>[],
  enricher: Enricher
) {
  const { data, error } = await supabaseClient
    .schema('private')
    .rpc('enriched_most_recent', {
      emails: contacts.map((contact) => contact.email)
    });

  if (error) {
    throw new Error(error.message);
  }
  return !data
    ? []
    : (data as EnrichmentCache[])
        .flatMap((cache) => enricher.parseResult([cache.result], cache.engine))
        .filter((cache): cache is EngineResponse => Boolean(cache?.data.length))
        .map((cache) => ({ ...cache, engine: 'cache' }));
}

export async function enrichFromCache(
  getCached: (
    contacts: Partial<Contact>[],
    enricher: Enricher
  ) => Promise<EngineResponse[]>,
  enrichmentsDB: Enrichments,
  contacts: Partial<Contact>[]
) {
  const emailToId = new Map(
    contacts
      .filter(
        (c): c is { email: string; id: string } =>
          Boolean(c.email) && Boolean(c.id)
      )
      .map((c) => [c.email, c.id])
  );

  const cached = await getCached(contacts, EnrichmentService);
  const enrichedEmails = new Set(
    cached
      .flatMap(({ data }) => (data as Partial<Contact>[]) || [])
      .filter((contact): contact is Partial<Contact> => Boolean(contact?.email))
      .map(({ email }) => email)
  );

  if (enrichedEmails.size) {
    for (const response of cached) {
      for (const data of response.data) {
        data.person_id = emailToId.get(data.email);
      }
    }
    await enrichmentsDB.enrich(cached);
    logger.debug('Enriched from cache.', Array.from(enrichedEmails.values()));
  }

  return contacts.filter(
    (contact) => contact.email && !enrichedEmails.has(contact.email)
  );
}

export async function enrichPersonSync(
  enrichmentsDB: Enrichments,
  contacts: Partial<Contact>[]
) {
  const task = enrichmentsDB.redactedTask();
  const enriched = new Set<string>();

  for (const contact of contacts) {
    // eslint-disable-next-line no-await-in-loop
    const result = await EnrichmentService.enrichSync(contact);
    if (!result) continue;
    for (const data of result.data) {
      data.person_id = contact.id;
    }
    // eslint-disable-next-line no-await-in-loop
    await enrichmentsDB.enrich([result]);
    if (contact.email) enriched.add(contact.email);
  }

  if (enriched.size > 0) {
    await Billing?.deductCustomerCredits(task.userId, enriched.size);
  }

  return contacts.filter((c) => (c.email ? !enriched.has(c.email) : false));
}

export async function enrichPersonAsync(
  enrichmentsDB: Enrichments,
  contacts: Partial<Contact>[]
) {
  const task = enrichmentsDB.redactedTask();
  const webhook = `${ENV.LEADMINER_API_HOST}/api/enrich/webhook/${task.id}`;
  const result = await EnrichmentService.enrichAsync(contacts, webhook);

  if (result) {
    const contactsMap = contacts
      .filter(
        (c): c is { email: string; id: string } =>
          Boolean(c.email) && Boolean(c.id)
      )
      .map((c) => ({ email: c.email, person_id: c.id }));
    (
      result as EngineResponse & {
        contacts_map: Array<{ email: string; person_id: string }>;
      }
    ).contacts_map = contactsMap;
    await enrichmentsDB.enrich([result]);
  }
  return result;
}
