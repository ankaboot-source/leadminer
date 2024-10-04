import { NextFunction, Request, Response } from 'express';
import ENV from '../config';
import { Users } from '../db/interfaces/Users';
import { Contact } from '../db/types';
import CreditsHandler from '../services/credits/creditsHandler';
import {
  enrichAsync,
  enrichSync,
  getContactsToEnrich,
  getEnrichmentTask,
  asyncWebhookEnrich
} from './enrichment.helpers';
import Billing from '../utils/billing-plugin';

async function checkAndFilterEligibleContacts(
  userResolver: Users,
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

  if (!ENV.ENABLE_CREDIT) {
    return next();
  }

  try {
    const contactsToEnrich = await getContactsToEnrich(
      user.id,
      enrichAllContacts ?? false,
      contacts
    );

    if (!contactsToEnrich.length) {
      return res.status(200).json({ alreadyEnriched: true });
    }

    const creditsHandler = new CreditsHandler(
      userResolver,
      ENV.CREDITS_PER_CONTACT
    );

    const { hasDeficientCredits, hasInsufficientCredits, availableUnits } =
      await creditsHandler.validate(user.id, contactsToEnrich.length);

    if (hasDeficientCredits || hasInsufficientCredits) {
      const response = {
        total: contactsToEnrich.length,
        available: Math.floor(availableUnits)
      };
      return res.status(creditsHandler.DEFICIENT_CREDITS_STATUS).json(response);
    }

    const enrichment: {
      contact?: Partial<Contact>;
      contacts?: Partial<Contact>[];
      updateEmptyFieldsOnly: boolean;
    } = {
      updateEmptyFieldsOnly
    };

    if (req.body.contact) {
      const [contact] = contactsToEnrich.slice(0, availableUnits);
      enrichment.contact = contact;
    } else if (req.body.contacts) {
      enrichment.contacts = contactsToEnrich.slice(0, availableUnits);
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
  const task = await enrichSync(userResolver, contact, {
    userId: user.id,
    updateEmptyFieldsOnly
  });
  return res.status(200).json(task);
}

async function enrichContactsAsync(
  userResolver: Users,
  _: Request,
  res: Response
) {
  const {
    user,
    enrichment: { contacts, updateEmptyFieldsOnly }
  } = res.locals;
  const tasks = await enrichAsync(userResolver, contacts, {
    userId: user.id,
    updateEmptyFieldsOnly,
    webhook: `${ENV.LEADMINER_API_HOST}/api/enrich/webhook/`
  });
  return res.status(200).json(tasks);
}

async function enrichContactsAsyncWebhookHandler(
  userResolver: Users,
  req: Request,
  res: Response
) {
  const { id: taskId } = req.params;
  const task = await getEnrichmentTask(taskId);
  if (!task.id) {
    return res.status(404).send({
      message: `Enrichment with id ${taskId} not found.`
    });
  }
  await asyncWebhookEnrich(userResolver, task, req.body);
  return res.status(200);
}

export default function initializeEnrichmentController(userResolver: Users) {
  return {
    enrichSync: async (req: Request, res: Response, next: NextFunction) => {
      try {
        await enrichContactSync(userResolver, req, res);
      } catch (err) {
        next(err);
      }
    },
    enrichAsync: async (req: Request, res: Response, next: NextFunction) => {
      try {
        await enrichContactsAsync(userResolver, req, res);
      } catch (err) {
        next(err);
      }
    },
    webhook: async (req: Request, res: Response, next: NextFunction) => {
      try {
        await enrichContactsAsyncWebhookHandler(userResolver, req, res);
      } catch (err) {
        next(err);
      }
    },
    preEnrichmentMiddleware: (
      req: Request,
      res: Response,
      next: NextFunction
    ) => checkAndFilterEligibleContacts(userResolver, req, res, next)
  };
}
