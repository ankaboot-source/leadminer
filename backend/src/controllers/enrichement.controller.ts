import { User } from '@supabase/supabase-js';
import { NextFunction, Request, Response } from 'express';
import ENV from '../config';
import { Users } from '../db/interfaces/Users';
import { Contact } from '../db/types';
import CreditsHandler from '../services/credits/creditsHandler';
import emailEnrichementService from '../services/email-enrichment';
import supabaseClient from '../utils/supabase';

/**
 * Queries enriched emails for a given user.
 * @param userId - The ID of the user.
 * @returns List of enriched email addresses.
 * @throws Error if there is an issue fetching data from the database.
 */
async function getEnrichedEmails(userId: string) {
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
 * Queries emails for a given user.
 * @param userId - The ID of the user.
 * @returns List of email addresses.
 * @throws Error if there is an issue fetching data from the database.
 */
async function getEmails(userId: string) {
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
 * Starts a new enrichment task.
 * @param userId - The ID of the user.
 * @returns The newly created task.
 * @throws Error if there is an issue creating the task in the database.
 */
async function startEnrichmentTask(userId: string) {
  const { data: task, error } = await supabaseClient
    .from('tasks')
    .insert({
      user_id: userId,
      status: 'running',
      type: 'enrich',
      category: 'enriching'
    })
    .select('id')
    .single<{ id: string }>();

  if (error) {
    throw new Error(error.message);
  }
  return task;
}

/**
 * Retrieves an enrichment task by its ID.
 * @param taskId - The ID of the task.
 * @returns The task data.
 * @throws Error if there is an issue fetching the task from the database.
 */
async function getEnrichmentTask(taskId: string) {
  const { data: task, error } = await supabaseClient
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single<{
      id: string;
      details: {
        userId: string;
        enrichmentToken: string;
        updateEmptyFieldsOnly: boolean;
        result?: {
          total?: number;
          enriched?: number;
        };
      };
    }>();

  if (error) {
    throw new Error(error.message);
  }

  return task;
}

/**
 * Updates an enrichment task with the given status and details.
 * @param taskId - The ID of the task.
 * @param status - The new status of the task.
 * @param details - Optional details to update the task with.
 * @throws Error if there is an issue updating the task in the database.
 */
async function updateEnrichmentTask(
  taskId: string,
  status: 'running' | 'done' | 'canceled',
  details?: {
    userId: string;
    enrichmentToken: string;
    updateEmptyFieldsOnly: boolean;
    result?: {
      total?: number;
      enriched?: number;
    };
  }
) {
  const { error } = await supabaseClient
    .from('tasks')
    .update({
      status,
      details,
      stopped_at: ['done', 'canceled'].includes(status)
        ? new Date().toISOString()
        : null
    })
    .eq('id', taskId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Enriches a contact with the provided data.
 * @param userId - The ID of the user.
 * @param contact - The contact data to enrich.
 * @throws Error if there is an issue updating the contact in the database.
 */
async function enrichContact(
  updateEmptyFieldsOnly: boolean,
  contacts: Partial<Contact>[]
) {
  // update contacts
  const { error } = await supabaseClient.rpc('enrich_contacts', {
    p_contacts_data: contacts.map((contact) => ({
      ...contact,
      same_as: contact.same_as?.join(','),
      location: contact.location?.join(',')
    })),
    p_update_empty_fields_only: updateEmptyFieldsOnly ?? true
  });

  if (error) {
    throw new Error(error.message);
  }

  // Update engagement table
  await Promise.all(
    contacts.map(async ({ email, user_id }) => {
      const { error: engagementError } = await supabaseClient
        .from('engagement')
        .upsert({
          email,
          user_id,
          engagement_type: 'ENRICH'
        });

      if (engagementError) {
        throw new Error(engagementError.message);
      }
    })
  );
}

async function validateRequest(req: Request, res: Response) {
  const userId = (res.locals.user as User).id;
  const {
    emails,
    enrichAllContacts,
    updateEmptyFieldsOnly
  }: {
    emails?: string[];
    enrichAllContacts: boolean;
    updateEmptyFieldsOnly: boolean;
  } = req.body;
  let emailsToEnrich: string[] | null;

  if (enrichAllContacts) {
    emailsToEnrich = await getEmails(userId);
  } else if (Array.isArray(emails) && emails.length) {
    emailsToEnrich = emails;
  } else {
    return { userId, enrichableContacts: null, updateEmptyFieldsOnly };
  }

  const enrichedEmails = new Set(await getEnrichedEmails(userId));
  const enrichableContacts = emailsToEnrich.filter(
    (email) => !enrichedEmails.has(email)
  );

  return { userId, enrichableContacts, updateEmptyFieldsOnly };
}

async function startEnrichmentAndGetTaskId(
  userId: string,
  contactsToEnrich: string[],
  updateEmptyFieldsOnly: boolean
) {
  const enrichmentTask = await startEnrichmentTask(userId);
  const enricher = emailEnrichementService.getEmailEnricher();
  const { token } = await enricher.enrichWebhook(
    contactsToEnrich,
    `${ENV.LEADMINER_API_HOST}/api/enrichement/webhook/${enrichmentTask.id}`
  );

  await updateEnrichmentTask(enrichmentTask.id, 'running', {
    userId,
    enrichmentToken: token,
    updateEmptyFieldsOnly,
    result: {
      total: contactsToEnrich.length
    }
  });

  return enrichmentTask.id;
}

async function verifyCredits(
  userId: string,
  userResolver: Users,
  total: number
) {
  // Verify Credits
  const creditsHandler = new CreditsHandler(
    userResolver,
    ENV.CREDITS_PER_CONTACT
  );
  const creditsInfo = await creditsHandler.validate(userId, total);

  return { creditsHandler, creditsInfo };
}

export default function initializeEnrichementController(userResolver: Users) {
  return {
    /**
     * Creates an Enrichment task for a list of emails.
     */
    async enrich(req: Request, res: Response, next: NextFunction) {
      try {
        const { userId, enrichableContacts, updateEmptyFieldsOnly } =
          await validateRequest(req, res);

        if (enrichableContacts === null)
          return res.status(400).json({
            message: 'Parameter "emails" must be a non-empty list of emails'
          });
        if (!enrichableContacts.length)
          return res.status(200).json({ alreadyEnriched: true });

        let contactsToEnrich = enrichableContacts;
        const total = contactsToEnrich.length;
        if (ENV.ENABLE_CREDIT) {
          const { creditsHandler, creditsInfo } = await verifyCredits(
            userId,
            userResolver,
            total
          );
          if (
            creditsInfo.hasDeficientCredits ||
            creditsInfo.hasInsufficientCredits
          ) {
            return res.status(creditsHandler.DEFICIENT_CREDITS_STATUS).json({
              total,
              available: Math.floor(creditsInfo.availableUnits)
            });
          }
          contactsToEnrich = contactsToEnrich.slice(
            0,
            creditsInfo.availableUnits
          );
        }
        const taskId = await startEnrichmentAndGetTaskId(
          userId,
          contactsToEnrich,
          updateEmptyFieldsOnly
        );
        return res.status(200).json({
          taskId,
          total
        });
      } catch (err) {
        return next(err);
      }
    },

    /**
     * Handles webhook callbacks for enrichment tasks.
     */
    async webhook(req: Request, res: Response, next: NextFunction) {
      const { id: taskId } = req.params;
      const { token: enrichmentToken } = req.body;

      try {
        const enricher = emailEnrichementService.getEmailEnricher();

        const { id, details } = await getEnrichmentTask(taskId);
        const {
          userId: cachedUserId,
          enrichmentToken: cachedEnrichmentToken,
          updateEmptyFieldsOnly
        } = details;

        if (!id) {
          return res.status(404).send({
            message: `Enrichement with id ${enrichmentToken} not found.`
          });
        }

        if (enrichmentToken !== cachedEnrichmentToken) {
          return res
            .status(401)
            .json({ message: 'You are not authorized to use this token' });
        }

        const enrichementResult = enricher.enrichementMapper(req.body);
        await enrichContact(
          updateEmptyFieldsOnly,
          enrichementResult.map((contact) => ({
            user_id: cachedUserId,
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
          ...details,
          result: {
            ...details.result,
            enriched: enrichementResult.length
          }
        });

        if (ENV.ENABLE_CREDIT) {
          const creditsHandler = new CreditsHandler(
            userResolver,
            ENV.CREDITS_PER_CONTACT
          );
          await creditsHandler.deduct(cachedUserId, enrichementResult.length);
        }

        return res.status(200);
      } catch (err) {
        await updateEnrichmentTask(taskId, 'canceled');
        return next(err);
      }
    }
  };
}
