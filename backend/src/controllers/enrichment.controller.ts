import { NextFunction, Request, Response } from 'express';
import ENV from '../config';
import { Users } from '../db/interfaces/Users';
import { Contact } from '../db/types';
import CreditsHandler from '../services/credits/creditsHandler';
import emailEnrichmentService from '../services/email-enrichment';
import supabaseClient from '../utils/supabase';
import { EnricherType } from '../services/email-enrichment/EmailEnricherFactory';
import { EnricherResult } from '../services/email-enrichment/EmailEnricher';

interface EnrichmentTask {
  id: string;
  user_id: string;
  status: 'running' | 'done' | 'canceled';
  details: {
    userId: string;
    enrichmentToken: string;
    enricherType: EnricherType;
    updateEmptyFieldsOnly: boolean;
    progress?: {
      total?: number;
      enriched?: number;
    };
    result?: EnricherResult;
    error?: string;
  };
}

/**
 * Queries emails for a given user from table "refinedpersons".
 * @param userId - The ID of the user.
 * @returns List of email addresses.
 * @throws Error if there is an issue fetching data from the database.
 */
async function getRefinedPersonsEmails(userId: string) {
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
 * Queries all contacts from the persons that are not yet enriched.
 * @param userId - The ID of the user.
 * @returns List of contacts to be enriched.
 * @throws Error if there is an issue fetching data from the database.
 */
async function getAllContactsToEnrich(userId: string) {
  const enrichedEmails = await getEnrichedEmails(userId);
  const refinedEmails = await getRefinedPersonsEmails(userId);

  const { data: contacts, error } = await supabaseClient
    .from('persons')
    .select('email, name')
    .not('email', 'in', `(${enrichedEmails.join(',')})`)
    .in('email', refinedEmails)
    .returns<{ email: string; name: string }[]>();

  if (error) {
    throw new Error(error.message);
  }

  return contacts.map(({ email, name }) => ({ email, name }));
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
    .single<EnrichmentTask>();

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
  details?: Partial<EnrichmentTask['details']>
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

export default function initializeEnrichmentController(userResolver: Users) {
  return {
    /**
     * Creates an Enrichment task for a list of emails.
     */
    async enrich(req: Request, res: Response, next: NextFunction) {
      const { user } = res.locals;
      const {
        emails,
        enrichAllContacts,
        updateEmptyFieldsOnly
      }: {
        emails?: Partial<Contact>[];
        enrichAllContacts: boolean;
        updateEmptyFieldsOnly: boolean;
      } = req.body;

      try {
        let emailsToEnrich = emails;

        if (enrichAllContacts) {
          emailsToEnrich = await getAllContactsToEnrich(user.id);
        } else if (!Array.isArray(emails) || !emails.length) {
          return res.status(400).json({
            message: 'Parameter "emails" must be a non-empty list of emails'
          });
        }

        let contactsToEnrich = emailsToEnrich?.map(({ email, name }) => ({
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
          const {
            hasDeficientCredits,
            hasInsufficientCredits,
            availableUnits
          } = await creditsHandler.validate(user.id, contactsToEnrich.length);

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

        const enrichers = emailEnrichmentService.getEnrichers(contactsToEnrich);

        const promises = enrichers.map(async ([enricher, contacts]) => {
          if (contacts.length === 0) return null;
          const enrichmentTask = await startEnrichmentTask(user.id);
          try {
            const { token } = await enricher.instance.enrichWebhook(
              contacts,
              `${ENV.LEADMINER_API_HOST}/api/enrichment/webhook/${enrichmentTask.id}`
            );

            await updateEnrichmentTask(enrichmentTask.id, 'running', {
              enricherType: enricher.type,
              userId: user.id,
              enrichmentToken: token,
              updateEmptyFieldsOnly,
              progress: {
                total: contactsToEnrich?.length
              }
            });
            return {
              id: enrichmentTask.id,
              status: 'running',
              error: null
            };
          } catch (e) {
            await updateEnrichmentTask(enrichmentTask.id, 'canceled', {
              enricherType: enricher.type,
              userId: user.id,
              enrichmentToken: '',
              updateEmptyFieldsOnly,
              error: (e as Error).message ?? 'Failed to start enrichment '
            });
            return {
              id: enrichmentTask.id,
              status: 'canceled',
              error: (e as Error).message ?? 'Failed to start enrichment'
            };
          }
        });

        const taskIds = (await Promise.all(promises)).filter(Boolean);

        return res.status(200).json({
          task_ids: taskIds,
          total: contactsToEnrich?.length
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
      const enrichmentToken = req.headers['x-task-id'] ?? req.body.token;

      const { id, details } = await getEnrichmentTask(taskId);
      const {
        enricherType,
        userId: cachedUserId,
        enrichmentToken: cachedEnrichmentToken,
        updateEmptyFieldsOnly
      } = details;

      if (!id) {
        return res.status(404).send({
          message: `Enrichment with id ${enrichmentToken} not found.`
        });
      }

      if (enrichmentToken !== cachedEnrichmentToken) {
        return res
          .status(401)
          .json({ message: 'You are not authorized to use this token' });
      }

      try {
        const enricher = emailEnrichmentService.getEnricher({}, enricherType);
        const enrichmentResult = enricher.instance.enrichmentMapper(req.body);

        await enrichContact(
          updateEmptyFieldsOnly,
          enrichmentResult.map((contact) => ({
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
          progress: {
            ...details.progress,
            enriched: enrichmentResult.length
          }
        });

        if (ENV.ENABLE_CREDIT) {
          const creditsHandler = new CreditsHandler(
            userResolver,
            ENV.CREDITS_PER_CONTACT
          );
          await creditsHandler.deduct(cachedUserId, enrichmentResult.length);
        }

        return res.status(200);
      } catch (err) {
        await updateEnrichmentTask(taskId, 'canceled', {
          ...details,
          error: 'webhook error'
        });
        return next(err);
      }
    }
  };
}
