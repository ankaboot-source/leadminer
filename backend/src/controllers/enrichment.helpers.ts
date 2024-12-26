import { Response } from 'express';
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
 * Queries emails for a given user from table "refinedpersons".
 * @param userId - The ID of the user.
 * @returns List of email addresses.
 * @throws Error if there is an issue fetching data from the database.
 */
export async function getRefinedPersonsEmails(userId: string) {
  const { data: emails, error } = await supabaseClient
    .schema('private')
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
    .schema('private')
    .from('persons')
    .select('email, name')
    .in('email', refinedEmails)
    .returns<{ email: string; name: string }[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data.map(({ email, name }) => ({ email, name }));
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
  contacts: Contact[],
  res: Response
) {
  const toEnrich = await getContactsToEnrich(userId, enrichAll, contacts);

  const { total, available } = await restrictOrDecline(userId, toEnrich.length);

  if (total === 0) {
    return res.status(402).json({ total, available });
  }

  return {
    updateEmptyFieldsOnly,
    contacts: toEnrich.slice(0, available),
    contact: toEnrich.slice(0, available)[0]
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
  return (
    data as {
      task_id: string;
      user_id: string;
      created_at: string;
      engine: string;
      result: EngineResult;
    }[]
  )
    .flatMap((cache) => enricher.parseResult([cache.result], cache.engine))
    .filter((cache): cache is EngineResponse => Boolean(cache?.data.length))
    .map((cache) => ({ ...cache, engine: 'cache' }));
}

export async function enrichFromCache(
  enrichmentsDB: Enrichments,
  contacts: Partial<Contact>[]
) {
  const cached = await getEnrichmentCache(contacts, EnrichmentService);
  const enrichedEmails = new Set(
    cached.flatMap(({ data }) => data).map(({ email }) => email)
  );

  if (enrichedEmails.size) {
    await enrichmentsDB.enrich(cached);
    logger.debug(
      'Contacts enriched from cache.',
      Array.from(enrichedEmails.values())
    );
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

  for await (const result of EnrichmentService.enrich(contacts)) {
    await enrichmentsDB.enrich([result]);
    enriched.add(result.data[0].email);
  }

  if (enriched.size > 1) {
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
    await enrichmentsDB.enrich([result]);
  }
}
