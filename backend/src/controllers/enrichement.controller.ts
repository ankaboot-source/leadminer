import { NextFunction, Request, Response } from 'express';
import supabaseClient from '../utils/supabase';
import ENV from '../config';
import CreditsHandler from '../services/credits/creditHandler';
import { Users } from '../db/interfaces/Users';
import emailEnrichementService from '../services/email-enrichment';
import { Contact } from '../db/types';

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
 * Retrieves or creates an organization by name.
 * @param name - The name of the organization.
 * @returns The organization data.
 * @throws Error if there is an issue fetching or creating the organization in the database.
 */
async function getOrCreateOrganization(name: string) {
  const { data: existingOrganization } = await supabaseClient
    .from('organizations')
    .select('id')
    .eq('name', name)
    .single();

  if (existingOrganization) {
    return existingOrganization;
  }

  const { data: createdOrganization, error: upsertError } = await supabaseClient
    .from('organizations')
    .upsert({ name })
    .select('id')
    .single();

  if (upsertError) {
    throw new Error(upsertError.message);
  }

  return createdOrganization;
}

/**
 * Enriches a contact with the provided data.
 * @param userId - The ID of the user.
 * @param contact - The contact data to enrich.
 * @throws Error if there is an issue updating the contact in the database.
 */
async function enrichContact(
  userId: string,
  {
    email,
    name,
    image,
    address,
    job_title,
    works_for,
    given_name,
    family_name,
    same_as
  }: Partial<Contact>
) {
  const organization = works_for
    ? await getOrCreateOrganization(works_for)
    : undefined;

  const { error: updateError } = await supabaseClient
    .from('persons')
    .update({
      name,
      image,
      same_as,
      address,
      job_title,
      given_name,
      family_name,
      works_for: organization?.id
    })
    .match({ user_id: userId, email });

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { error: engagementError } = await supabaseClient
    .from('engagement')
    .upsert({
      email,
      user_id: userId,
      engagement_type: 'ENRICH'
    });

  if (engagementError) {
    throw new Error(engagementError.message);
  }
}

export default function initializeEnrichementController(userResolver: Users) {
  return {
    /**
     * Creates an Enrichment task for a list of emails.
     */
    async enrich(req: Request, res: Response, next: NextFunction) {
      const { user } = res.locals;
      const { partial, emails }: { partial: boolean; emails: string[] } =
        req.body;
      try {
        if (!Array.isArray(emails) || !emails.length) {
          return res
            .status(400)
            .json({ message: 'Parameter "emails" must be a list of emails' });
        }

        const enrichedContacts = await getEnrichedEmails(user.id);
        let contactsToEnrich = emails.filter(
          (email) => !enrichedContacts.includes(email)
        );

        if (!contactsToEnrich.length) {
          return res.status(200).json({ alreadyEnriched: true });
        }

        if (ENV.ENABLE_CREDIT) {
          const creditsService = new CreditsHandler(
            userResolver,
            ENV.CONTACT_CREDIT
          );
          const {
            hasDeficientCredits,
            hasInsufficientCredits,
            availableUnits
          } = await creditsService.validate(user.id, contactsToEnrich.length);

          if (!partial && (hasDeficientCredits || hasInsufficientCredits)) {
            const response = {
              total: contactsToEnrich.length,
              available: Math.floor(availableUnits)
            };
            return res
              .status(creditsService.DEFICIENT_CREDITS_STATUS)
              .json(response);
          }
          contactsToEnrich = contactsToEnrich.slice(0, availableUnits);
        }

        const enricher = emailEnrichementService.getEmailEnricher();
        const enrichmentTask = await startEnrichmentTask(user.id);

        const { token } = await enricher.enrichWebhook(
          contactsToEnrich,
          `${ENV.LEADMINER_API_HOST}/api/enrichement/webhook/${enrichmentTask.id}`
        );

        await updateEnrichmentTask(enrichmentTask.id, 'running', {
          userId: user.id,
          enrichmentToken: token,
          result: {
            total: contactsToEnrich.length
          }
        });

        return res.status(200).json({
          taskId: enrichmentTask.id,
          total: contactsToEnrich.length
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
        const { userId: cachedUserId, enrichmentToken: cachedEnrichmentToken } =
          details;

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

        await Promise.all(
          enrichementResult.map((contact) =>
            enrichContact(cachedUserId, {
              image: contact.image,
              email: contact.email,
              name: contact.name,
              same_as: contact.sameAs,
              address: contact.address,
              job_title: contact.jobTitle,
              given_name: contact.givenName,
              family_name: contact.familyName,
              works_for: contact.organization
            })
          )
        );

        await updateEnrichmentTask(taskId, 'done', {
          ...details,
          result: {
            ...details.result,
            enriched: enrichementResult.length
          }
        });

        if (ENV.ENABLE_CREDIT) {
          const creditHandler = new CreditsHandler(
            userResolver,
            ENV.CONTACT_CREDIT
          );
          await creditHandler.deduct(cachedUserId, enrichementResult.length);
        }

        return res.status(200);
      } catch (err) {
        await updateEnrichmentTask(taskId, 'canceled');
        return next(err);
      }
    }
  };
}
