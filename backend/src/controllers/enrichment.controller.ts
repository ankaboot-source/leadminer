import { NextFunction, Request, Response } from 'express';
import {
  createEnrichmentTask,
  enrichFromCache,
  enrichPersonAsync,
  enrichPersonSync,
  getEnrichmentCache,
  prepareForEnrichment
} from './enrichment.helpers';

import Billing from '../utils/billing-plugin';
import EnrichmentService from '../services/enrichment';

async function preEnrichmentMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { user } = res.locals;
  const { contact, enrichAllContacts, updateEmptyFieldsOnly } = req.body;
  const contacts = [...(req.body.contacts ?? []), contact].filter(Boolean);

  if (!enrichAllContacts && contacts.length === 0) {
    const msg = 'Missing parameter contact or contacts';
    return res.status(400).json({ message: msg });
  }

  try {
    const enrichment = await prepareForEnrichment(
      user.id,
      enrichAllContacts ?? false,
      updateEmptyFieldsOnly,
      contacts
    );

    if (enrichment.available === 0) {
      return res.status(402).json({
        total: enrichment.total,
        available: enrichment.available
      });
    }

    res.locals.enrichment = enrichment;
    return next();
  } catch (error) {
    return next(error);
  }
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
  const enrichmentsDB = createEnrichmentTask();
  try {
    await enrichmentsDB.create(user.id, 1, updateEmptyFieldsOnly);
    const notEnriched = await enrichFromCache(
      getEnrichmentCache,
      enrichmentsDB,
      [contact]
    );
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
  const { user, enrichment } = res.locals;
  const { contacts, updateEmptyFieldsOnly } = enrichment;
  const enrichmentsDB = createEnrichmentTask();
  try {
    await enrichmentsDB.create(user.id, contacts.length, updateEmptyFieldsOnly);
    const notEnrichedCache = await enrichFromCache(
      getEnrichmentCache,
      enrichmentsDB,
      contacts
    );
    const notEnriched = await enrichPersonSync(enrichmentsDB, notEnrichedCache);
    const enrichAsyncResult = notEnriched.length
      ? await enrichPersonAsync(enrichmentsDB, notEnriched)
      : null;

    if (!enrichAsyncResult) {
      await enrichmentsDB.end();
    }

    return res.status(200).json({ task: enrichmentsDB.redactedTask() });
  } catch (err) {
    await enrichmentsDB.cancel();
    if (isEmptyEnrichEngines(err)) res.statusCode = 503;
    return next(err);
  }
}

async function enrichWebhook(req: Request, res: Response, next: NextFunction) {
  const { id: taskId } = req.params;
  const { token } = req.body;
  const enrichmentsDB = createEnrichmentTask();

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

export default function initializeEnrichmentController() {
  return {
    enrichPerson,
    enrichPersonBulk,
    enrichWebhook,
    preEnrichmentMiddleware
  };
}
