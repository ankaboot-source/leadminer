import { NextFunction, Request, Response } from 'express';
import ENV from '../config';
import { Users } from '../db/interfaces/Users';
import { Contact } from '../db/types';
import CreditsHandler from '../services/credits/creditsHandler';
import emailEnrichmentService from '../services/email-enrichment';
import logger from '../utils/logger';
import {
  enrichContact,
  getContactsToEnrich,
  getEnrichmentTask,
  redactEnrichmentTask,
  searchEnrichmentCache,
  startEnrichmentTask,
  TaskEnrichRedacted,
  updateEnrichmentTask
} from './enrichment.helpers';

async function enrichContactsSync(
  userResolver: Users,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { user } = res.locals;
  const {
    contact,
    updateEmptyFieldsOnly
  }: {
    contact?: Partial<Contact>;
    updateEmptyFieldsOnly: boolean;
  } = req.body;

  if (!contact?.email) {
    return res.status(400).json({
      message: 'Parameter "contact" must be a non-empty object<{ email, name }>'
    });
  }

  try {
    const contactToEnrich = (
      await getContactsToEnrich(user.id, false, [contact])
    ).map(({ email, name }) => ({
      email,
      name
    }))[0];

    if (!contactToEnrich) {
      return res.status(200).json({ alreadyEnriched: true });
    }

    if (ENV.ENABLE_CREDIT) {
      const creditsHandler = new CreditsHandler(
        userResolver,
        ENV.CREDITS_PER_CONTACT
      );
      const { hasDeficientCredits, hasInsufficientCredits, availableUnits } =
        await creditsHandler.validate(user.id, 1);

      if (hasDeficientCredits || hasInsufficientCredits) {
        const response = {
          total: 1,
          available: Math.floor(availableUnits)
        };
        return res
          .status(creditsHandler.DEFICIENT_CREDITS_STATUS)
          .json(response);
      }
    }

    const enricher = emailEnrichmentService.getEnricher({}, 'thedig');
    const enrichmentCache = (await searchEnrichmentCache([contactToEnrich]))[0];

    if (enrichmentCache) {
      await enrichContact(userResolver, user.id, updateEmptyFieldsOnly, [
        {
          user_id: user.id,
          ...enrichmentCache.result
        }
      ]);
      logger.info('[CACHE]: Enriched contact from cache', enrichmentCache);
      return res.status(200).json({
        task: {
          id: 'enrichment-cache',
          status: 'done',
          details: {
            progress: {
              total: 1,
              enriched: 1
            }
          }
        }
      });
    }

    const enrichmentResult = await enricher.instance.enrichSync(
      contactToEnrich
    );
    const { raw_data: originalData, data: enrichmentResultMapped } =
      enricher.instance.enrichmentMapper([enrichmentResult]);

    await enrichContact(
      userResolver,
      user.id,
      updateEmptyFieldsOnly,
      enrichmentResultMapped.map((result) => ({
        user_id: user.id,
        ...result
      }))
    );

    const { id: taskId } = await startEnrichmentTask(user.id);
    const task = await updateEnrichmentTask(taskId, 'done', {
      config: {
        user_id: user.id,
        instance: enricher.type,
        update_empty_fields_only: updateEmptyFieldsOnly
      },
      progress: {
        enriched: 1,
        total: 1
      },
      result: {
        raw_data: originalData,
        data: enrichmentResultMapped
      }
    });
    return res.status(200).json({ task: redactEnrichmentTask(task) });
  } catch (err) {
    return next(err);
  }
}

async function enrichContactsAsync(
  userResolver: Users,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { user } = res.locals;
  const {
    contacts,
    enrichAllContacts,
    updateEmptyFieldsOnly
  }: {
    contacts?: Partial<Contact>[];
    enrichAllContacts: boolean;
    updateEmptyFieldsOnly: boolean;
  } = req.body;

  if (!enrichAllContacts && (!Array.isArray(contacts) || !contacts.length)) {
    return res.status(400).json({
      message: 'Parameter "contacts" must be a non-empty list of emails'
    });
  }

  const enrichmentTasks: TaskEnrichRedacted[] = [];

  try {
    let contactsToEnrich = (
      await getContactsToEnrich(user.id, enrichAllContacts, contacts)
    ).map(({ email, name }) => ({
      email,
      name
    }));

    if (!contactsToEnrich?.length) {
      return res.status(200).json({ alreadyEnriched: true });
    }

    if (ENV.ENABLE_CREDIT) {
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
        return res
          .status(creditsHandler.DEFICIENT_CREDITS_STATUS)
          .json(response);
      }
      contactsToEnrich = contactsToEnrich.slice(0, availableUnits);
    }

    const enrichmentCache = await searchEnrichmentCache(contactsToEnrich);

    if (enrichmentCache.length) {
      const enrichedEmails = new Set(
        enrichmentCache.map(({ result }) => result.email)
      );

      const enrichmentResult = enrichmentCache.map(({ result }) => ({
        user_id: user.id,
        ...result
      }));

      await enrichContact(
        userResolver,
        user.id,
        updateEmptyFieldsOnly,
        enrichmentResult
      );

      logger.debug(
        'Enrichment cache hit: Enriched from cache',
        enrichmentCache
      );

      enrichmentTasks.push({
        id: 'cache-hit',
        status: 'done',
        details: {
          progress: {
            total: enrichmentCache.length,
            enriched: enrichmentResult.length
          }
        }
      });

      if (enrichmentCache.length === contactsToEnrich.length) {
        return res.status(200).json({ tasks: enrichmentTasks });
      }

      contactsToEnrich = contactsToEnrich.filter(
        ({ email }) => !enrichedEmails.has(email as string)
      );
    }

    const enrichers = emailEnrichmentService.getEnrichers(contactsToEnrich);

    const promises = enrichers.map(async ([enricher, contactsList]) => {
      if (contactsList.length === 0) return null;
      const enrichmentTask = await startEnrichmentTask(user.id);
      try {
        const { token } = await enricher.instance.enrichAsync(
          contactsList,
          `https://f034-197-238-156-21.ngrok-free.app/api/enrich/webhook/${enrichmentTask.id}`
        );

        logger.debug('Got enrichment token for the request', {
          instance: enricher.type,
          token
        });

        const task = await updateEnrichmentTask(enrichmentTask.id, 'running', {
          config: {
            secret: token,
            user_id: user.id,
            instance: enricher.type,
            update_empty_fields_only: updateEmptyFieldsOnly
          },
          progress: {
            enriched: 0,
            total: contactsToEnrich?.length ?? 0
          }
        });
        return redactEnrichmentTask(task);
      } catch (e) {
        const task = await updateEnrichmentTask(enrichmentTask.id, 'canceled', {
          config: {
            user_id: user.id,
            instance: enricher.type,
            update_empty_fields_only: updateEmptyFieldsOnly
          },
          progress: {
            enriched: 0,
            total: contactsToEnrich?.length ?? 0
          },
          error: (e as Error).message ?? 'Failed to start enrichment '
        });
        return redactEnrichmentTask(task);
      }
    });

    enrichmentTasks.push(
      ...(await Promise.all(promises)).filter(
        (task): task is TaskEnrichRedacted => task !== null
      )
    );

    return res.status(200).json({ tasks: enrichmentTasks });
  } catch (err) {
    return next(err);
  }
}

async function enrichContactsAsyncWebhookHandler(
  userResolver: Users,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { id: taskId } = req.params;
  const enrichmentToken = req.headers['x-task-id'] ?? req.body.token;

  const { id, details } = await getEnrichmentTask(taskId);
  const {
    instance,
    user_id: userId,
    secret: secretToken,
    update_empty_fields_only: updateEmptyFieldsOnly
  } = details.config;

  if (!id) {
    return res.status(404).send({
      message: `Enrichment with id ${enrichmentToken} not found.`
    });
  }

  if (enrichmentToken !== secretToken) {
    return res
      .status(401)
      .json({ message: 'You are not authorized to use this token' });
  }

  try {
    const enricher = emailEnrichmentService.getEnricher({}, instance);
    const { raw_data: originalData, data: enrichmentResult } =
      enricher.instance.enrichmentMapper(req.body);

    await enrichContact(
      userResolver,
      userId,
      updateEmptyFieldsOnly,
      enrichmentResult.map((contact) => ({
        user_id: userId,
        image: contact.image,
        email: contact.email,
        name: contact.name,
        same_as: contact.sameAs,
        location: contact.location,
        job_title: contact.jobTitle,
        given_name: contact.givenName,
        family_name: contact.familyName,
        works_for: contact.organization
      }))
    );
    await updateEnrichmentTask(taskId, 'done', {
      config: details.config,
      progress: {
        ...details.progress,
        enriched: enrichmentResult.length
      },
      result: {
        raw_data: originalData,
        data: enrichmentResult
      }
    });

    return res.status(200);
  } catch (err) {
    await updateEnrichmentTask(taskId, 'canceled', {
      ...details,
      error:
        (err as Error).message || 'Error processing enrichment from webhook'
    });
    return next(err);
  }
}

export default function initializeEnrichmentController(userResolver: Users) {
  return {
    enrichSync: (req: Request, res: Response, next: NextFunction) => enrichContactsSync(userResolver, req, res, next),
    enrichAsync: (req: Request, res: Response, next: NextFunction) => enrichContactsAsync(userResolver, req, res, next),
    /**
     * Handles webhook callbacks for async enrichment tasks.
     */
    webhook: (req: Request, res: Response, next: NextFunction) => enrichContactsAsyncWebhookHandler(userResolver, req, res, next)
  };
}
