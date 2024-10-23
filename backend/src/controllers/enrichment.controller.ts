import { NextFunction, Request, Response } from 'express';
import { Users } from '../db/interfaces/Users';
import { Contact } from '../db/types';
import {
  createEnrichmentTask,
  enrichFromCache,
  enrichPersonSync,
  enrichWebhook,
  getContactsToEnrich,
  getEnrichmentTask,
  redactEnrichmentTask,
  TaskEnrich,
  updateEnrichmentTask
} from './enrichment.helpers';
import Billing from '../utils/billing-plugin';
import emailEnrichmentService from '../services/email-enrichment';
import ENV from '../config';

async function checkAndFilterEligibleContacts(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { user } = res.locals;
  const { enrichAllContacts, updateEmptyFieldsOnly } = req.body;
  const contacts = [
    ...(req.body.contacts ? req.body.contacts : [req.body.contact])
  ].filter(Boolean);

  const isMissingParam = !enrichAllContacts && !Array.isArray(contacts);

  if (isMissingParam) {
    return res.status(400).json({
      message: 'Missing parameter contact or contacts'
    });
  }

  try {
    let contactsToEnrich = await getContactsToEnrich(
      user.id,
      enrichAllContacts ?? false,
      contacts
    );

    if (Billing) {
      const { hasDeficientCredits, hasInsufficientCredits, availableUnits } =
        await Billing.validateCustomerCredits(user.id, contactsToEnrich.length);

      if (hasDeficientCredits || hasInsufficientCredits) {
        const response = {
          total: contactsToEnrich.length,
          available: Math.floor(availableUnits)
        };
        return res.status(402).json(response);
      }

      contactsToEnrich = contactsToEnrich.slice(0, availableUnits);
    }

    const enrichment: {
      contact?: Partial<Contact>;
      contacts?: Partial<Contact>[];
      updateEmptyFieldsOnly: boolean;
    } = {
      updateEmptyFieldsOnly
    };

    if (enrichAllContacts || req.body.contacts) {
      enrichment.contacts = contactsToEnrich;
    } else if (req.body.contact) {
      const [contact] = contactsToEnrich;
      enrichment.contact = contact;
    }
    res.locals.enrichment = enrichment;
    return next();
  } catch (error) {
    return next(error);
  }
}

async function enrichContactSync(
  userResolver: Users,
  _: Request,
  res: Response
) {
  const {
    user,
    enrichment: { contact, updateEmptyFieldsOnly }
  } = res.locals;

  const [TaskCached, [contactToEnrich]] = await enrichFromCache(
    userResolver,
    user.id,
    updateEmptyFieldsOnly,
    [contact]
  );

  if (TaskCached && !contactToEnrich) {
    return res.status(200).json({
      task: TaskCached
    });
  }

  const task = await createEnrichmentTask(user.id, 1, updateEmptyFieldsOnly);

  const [result] = await enrichPersonSync(userResolver, task, [
    contactToEnrich
  ]);
  await updateEnrichmentTask(task, result);

  return res.status(200).json({
    task: redactEnrichmentTask(task)
  });
}

async function enrichPersonBulk(
  userResolver: Users,
  _: Request,
  res: Response
) {
  const {
    user,
    enrichment: { contacts, updateEmptyFieldsOnly }
  } = res.locals;

  const [taskCached, contactsToEnrich] = await enrichFromCache(
    userResolver,
    user.id,
    updateEmptyFieldsOnly,
    contacts
  );

  if (taskCached && !contactsToEnrich.length) {
    return res.status(200).json({ task: taskCached });
  }

  const task = await createEnrichmentTask(
    user.id,
    contacts.length,
    updateEmptyFieldsOnly
  );

  const enrichResult: TaskEnrich['details']['result'] = [];

  const [results, notEnriched] = await enrichPersonSync(
    userResolver,
    task,
    contactsToEnrich
  );
  enrichResult.push(...results);

  if (notEnriched.length) {
    const voilanorbert = emailEnrichmentService.getEnricher({}, 'voilanorbert');
    try {
      const { token } = await voilanorbert.instance.enrichAsync(
        notEnriched,
        `${ENV.LEADMINER_API_HOST}/api/enrich/webhook/${task.id}`
      );
      enrichResult.push({
        token,
        instance: voilanorbert.type
      });
    } catch (err) {
      enrichResult.push({
        error: (err as Error).message,
        instance: voilanorbert.type
      });
    }
    await updateEnrichmentTask(task, enrichResult, 'running');
    return res.status(200).json({ task });
  }

  await updateEnrichmentTask(task, enrichResult);
  return res.status(200).json({ task });
}

async function enrichPersonWebhook(
  userResolver: Users,
  req: Request,
  res: Response
) {
  const { id: taskId } = req.params;
  const { token } = req.body;
  const task = await getEnrichmentTask(taskId);

  if (!task.id) {
    return res.status(404).send({
      message: `Enrichment with id ${taskId} not found.`
    });
  }

  const result = await enrichWebhook(userResolver, task, token, req.body);
  task.details.result = task.details.result.filter(
    (data) => data.token !== token
  );
  await updateEnrichmentTask(task, [result], 'done');
  return res.status(200);
}

export default function initializeEnrichmentController(userResolver: Users) {
  return {
    enrichPerson: async (req: Request, res: Response, next: NextFunction) => {
      try {
        await enrichContactSync(userResolver, req, res);
      } catch (err) {
        next(err);
      }
    },
    enrichPersonBulk: async (
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      try {
        await enrichPersonBulk(userResolver, req, res);
      } catch (err) {
        next(err);
      }
    },
    enrichWebhook: async (req: Request, res: Response, next: NextFunction) => {
      try {
        await enrichPersonWebhook(userResolver, req, res);
      } catch (err) {
        next(err);
      }
    },
    preEnrichmentMiddleware: (
      req: Request,
      res: Response,
      next: NextFunction
    ) => checkAndFilterEligibleContacts(req, res, next)
  };
}
