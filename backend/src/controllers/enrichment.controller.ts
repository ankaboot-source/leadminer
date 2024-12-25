import { NextFunction, Request, Response } from 'express';
import {
  createEnrichmentTask,
  enrichPersonAsync,
  enrichPersonSync,
  getEnrichmentCache,
  prepareForEnrichment
} from './enrichment.helpers';

import Billing from '../utils/billing-plugin';
import { Contact } from '../db/types';
import EnrichmentService from '../services/enrichment';
import Enrichments from '../db/supabase/enrichments';
import { Users } from '../db/interfaces/Users';
import logger from '../utils/logger';

async function preEnrichmentMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { user } = res.locals;
  const { enrichAllContacts, updateEmptyFieldsOnly } = req.body;
  const contacts = [...(req.body.contacts ?? []), req.body.contact].filter(
    Boolean
  );

  if (!enrichAllContacts && !Array.isArray(contacts)) {
    const msg = 'Missing parameter contact or contacts';
    return res.status(400).json({ message: msg });
  }

  try {
    res.locals.enrichment = await prepareForEnrichment(
      user.id,
      enrichAllContacts ?? false,
      updateEmptyFieldsOnly,
      contacts,
      res
    );
    return next();
  } catch (error) {
    return next(error);
  }
}

async function enrichFromCache(
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

function isEmptyEnrichEngines(error: unknown) {
  return Boolean(
    error instanceof Error && error.message.startsWith('Enricher not found.')
  );
}

async function enrichPerson(_: Request, res: Response, next: NextFunction) {
  const {
    user,
    enrichment: { contact, updateEmptyFieldsOnly }
  } = res.locals;
  const enrichmentsDB = await createEnrichmentTask();
  try {
    await enrichmentsDB.create(user.id, 1, updateEmptyFieldsOnly);
    const notEnriched = await enrichFromCache(enrichmentsDB, [contact]);
    await enrichPersonSync(enrichmentsDB, notEnriched);
    await enrichmentsDB.end();
    return res.status(200).json({ task: enrichmentsDB.redactedTask() });
  } catch (err) {
    await enrichmentsDB.cancel();
    if (isEmptyEnrichEngines(err)) {
      res.statusCode = 503;
    }
    return next(err);
  }
}

async function enrichPersonBulk(_: Request, res: Response, next: NextFunction) {
  const {
    user,
    enrichment: { contacts, updateEmptyFieldsOnly }
  } = res.locals;
  const enrichmentsDB = await createEnrichmentTask();
  try {
    await enrichmentsDB.create(user.id, contacts.length, updateEmptyFieldsOnly);

    const task = enrichmentsDB.redactedTask();
    const notEnrichedCache = await enrichFromCache(enrichmentsDB, contacts);
    const notEnriched = await enrichPersonSync(enrichmentsDB, notEnrichedCache);

    if (notEnriched.length) {
      await enrichPersonAsync(enrichmentsDB, notEnriched);
    } else {
      await enrichmentsDB.end();
    }

    return res.status(200).json({ task });
  } catch (err) {
    await enrichmentsDB.cancel();
    if (isEmptyEnrichEngines(err)) {
      res.statusCode = 503;
    }
    return next(err);
  }
}

async function enrichWebhook(req: Request, res: Response, next: NextFunction) {
  const { id: taskId } = req.params;
  const { token } = req.body;
  const enrichmentsDB = await createEnrichmentTask();

  try {
    const task = await enrichmentsDB.createFromId(taskId);
    const taskResult = task?.details.result.find((enr) => enr.token === token);

    if (!taskResult) return res.sendStatus(404);

    const { engine } = taskResult;
    const result = EnrichmentService.parseResult([req.body], engine);

    await enrichmentsDB.enrich([{ ...taskResult, ...result }]);
    await Billing?.deductCustomerCredits(
      task.userId,
      result.data.filter(Boolean).length
    );
    await enrichmentsDB.end();
    return res.sendStatus(200);
  } catch (err) {
    await enrichmentsDB.cancel();
    return next(err);
  }
}

export default function initializeEnrichmentController(userResolver: Users) {
  return {
    enrichPerson,
    enrichPersonBulk,
    enrichWebhook,
    preEnrichmentMiddleware
  };
}
