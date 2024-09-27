import { NextFunction, Request, Response } from 'express';
import ENV from '../config';
import { Users } from '../db/interfaces/Users';
import { Contact } from '../db/types';
import CreditsHandler from '../services/credits/creditsHandler';
import emailEnrichmentService from '../services/email-enrichment';
import supabaseClient from '../utils/supabase';
import { EnricherType } from '../services/email-enrichment/EmailEnricherFactory';
import { EnricherResult } from '../services/email-enrichment/EmailEnricher';
import logger from '../utils/logger';

interface TaskEnrich {
  id: string;
  user_id: string;
  status: 'running' | 'done' | 'canceled';
  details: {
    config: {
      secret?: string;
      user_id: string;
      instance: EnricherType;
      update_empty_fields_only: boolean;
    };
    progress: {
      total: number;
      enriched: number;
    };
    result?: {
      raw_data: unknown;
      data: EnricherResult[];
    };
    error?: string;
  };
}

interface TaskEnrichRedacted {
  id: TaskEnrich['id'];
  status: TaskEnrich['status'];
  details: {
    progress: TaskEnrich['details']['progress'];
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
async function getContactsToEnrich(
  userId: string,
  enrichAll: boolean,
  contacts?: Partial<Contact>[]
) {
  const enrichedEmails = await getEnrichedEmails(userId);

  if (!enrichAll && contacts?.length) {
    return contacts.filter(
      ({ email }) => !enrichedEmails.includes(email as string)
    );
  }

  const refinedEmails = await getRefinedPersonsEmails(userId);

  const { data, error } = await supabaseClient
    .from('persons')
    .select('email, name')
    .not('email', 'in', `(${enrichedEmails.join(',')})`)
    .in('email', refinedEmails)
    .returns<{ email: string; name: string }[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data.map(({ email, name }) => ({ email, name }));
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
    .single<TaskEnrich>();

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
  details?: Partial<TaskEnrich['details']>
) {
  const updateData: Partial<{
    status: string;
    details?: Partial<TaskEnrich['details']>;
    stopped_at: string | null;
  }> = {
    status,
    stopped_at: ['done', 'canceled'].includes(status)
      ? new Date().toISOString()
      : null
  };

  if (details) {
    updateData.details = details;
  }

  const { data, error } = await supabaseClient
    .from('tasks')
    .update(updateData)
    .eq('id', taskId)
    .select('*')
    .single<TaskEnrich>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Enriches a contact with the provided data.
 * @param userId - The ID of the user.
 * @param contact - The contact data to enrich.
 * @throws Error if there is an issue updating the contact in the database.
 */
async function enrichContact(
  userResolver: Users,
  userId: string,
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

  if (ENV.ENABLE_CREDIT) {
    const creditsHandler = new CreditsHandler(
      userResolver,
      ENV.CREDITS_PER_CONTACT
    );
    await creditsHandler.deduct(userId, contacts.length);
  }
}

interface EnrichmentCacheResult {
  task_id: string;
  user_id: string;
  created_at: string;
  result: EnricherResult;
}

async function searchEnrichmentCache(
  contacts: Partial<Contact>[]
): Promise<EnrichmentCacheResult[]> {
  const emails = contacts.map((contact) => contact.email);

  const { data, error } = await supabaseClient.rpc(
    'search_previous_enriched_emails',
    {
      emails
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

function redactEnrichmentTask(task: TaskEnrich): TaskEnrichRedacted {
  const { id, status, details } = task;
  const { progress, error } = details;
  return {
    id,
    status,
    details: { progress, error }
  };
}

export default function initializeEnrichmentController(userResolver: Users) {
  return {
    /**
     * Creates an Async Enrichment task for a list of emails.
     */
    async enrichSync(req: Request, res: Response, next: NextFunction) {
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
          message:
            'Parameter "contact" must be a non-empty object<{ email, name }>'
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
          const {
            hasDeficientCredits,
            hasInsufficientCredits,
            availableUnits
          } = await creditsHandler.validate(user.id, 1);

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
        const enrichmentCache = (
          await searchEnrichmentCache([contactToEnrich])
        )[0];

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
    },
    /**
     * Creates an Async Enrichment task for a list of emails.
     */
    async enrichAsync(req: Request, res: Response, next: NextFunction) {
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

      if (
        !enrichAllContacts &&
        (!Array.isArray(contacts) || !contacts.length)
      ) {
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

            const task = await updateEnrichmentTask(
              enrichmentTask.id,
              'running',
              {
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
              }
            );
            return redactEnrichmentTask(task);
          } catch (e) {
            const task = await updateEnrichmentTask(
              enrichmentTask.id,
              'canceled',
              {
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
              }
            );
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
    },

    /**
     * Handles webhook callbacks for enrichment tasks.
     */
    async webhook(req: Request, res: Response, next: NextFunction) {
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
  };
}
