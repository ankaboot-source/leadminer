import { NextFunction, Request, Response } from 'express';
import supabaseClient from '../utils/supabase';
import ENV from '../config';
import CreditsHandler from '../services/credits/creditHandler';
import { Users } from '../db/interfaces/Users';
import emailEnrichementService from '../services/email-enrichment';

export default function initializeEnrichementController(userResolver: Users) {
  return {
    async enrich(req: Request, res: Response, next: NextFunction) {
      const { user } = res.locals;
      const { emails }: { emails: string[] } = req.body;
      try {
        if (!Array.isArray(emails) || !emails.length) {
          return res
            .status(400)
            .json({ message: 'Parameter "emails" must be a list of emails' });
        }

        const { data, error: engagementError } = await supabaseClient
          .from('engagement')
          .select('email')
          .match({ user_id: user.id, engagement_type: 'ENRICH' });

        if (engagementError) {
          throw new Error(engagementError.message);
        }

        const enrichedContacts = data.map((record) => record.email as string);
        const contactsToEnrich = emails.filter(
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

          if (hasDeficientCredits || hasInsufficientCredits) {
            const response = {
              total: contactsToEnrich.length,
              available: Math.floor(availableUnits)
            };
            return res
              .status(creditsService.DEFICIENT_CREDITS_STATUS)
              .json(response);
          }
        }

        const { data: task, error } = await supabaseClient
          .from('tasks')
          .insert({
            user_id: user.id,
            status: 'running',
            type: 'enrich',
            category: 'enriching'
          })
          .select('id')
          .single();

        const enricher = emailEnrichementService.getEmailEnricher();
        const { token } = await enricher.enrichWebhook(
          contactsToEnrich,
          `${ENV.LEADMINER_API_HOST}/api/enrichement/webhook/${task?.id}`
        );

        const details = {
          taskId: task?.id,
          userId: user.id,
          webhookSecretToken: token,
          total: contactsToEnrich.length
        };

        await supabaseClient
          .from('tasks')
          .update({
            details: JSON.stringify({
              userId: user.id,
              webhookSecretToken: token,
              total: contactsToEnrich.length
            })
          })
          .eq('id', task?.id);

        if (error) {
          throw new Error(error.message);
        }

        return res.status(200).json(details);
      } catch (err) {
        return next(err);
      }
    },

    async webhook(req: Request, res: Response, next: NextFunction) {
      const { id: taskId } = req.params;
      const { token: webhookToken } = req.body;

      try {
        const enricher = emailEnrichementService.getEmailEnricher();

        const { data: task, error } = await supabaseClient
          .from('tasks')
          .select('*')
          .eq('id', taskId)
          .single();

        if (error) {
          throw new Error(error.message);
        }

        if (!task) {
          return res.status(404).send({
            message: `Enrichement with id ${webhookToken} not found.`
          });
        }

        const { userId, webhookSecretToken: cachedWebhookToken } = JSON.parse(
          task.details
        );

        if (webhookToken !== cachedWebhookToken) {
          return res.sendStatus(401);
        }

        const enrichementResult = enricher.enrichementMapper(req.body);

        await Promise.all(
          enrichementResult.map(
            async ({
              email,
              name,
              image,
              address,
              jobTitle,
              organization,
              givenName,
              familyName,
              sameAs
            }) => {
              const { data: organizationData, error: upsertError } =
                organization
                  ? await supabaseClient
                      .from('organizations')
                      .upsert({ name: organization })
                      .select('id')
                      .single()
                  : { data: null, error: null };

              if (upsertError) {
                throw new Error(upsertError.message);
              }

              const { error: updateError } = await supabaseClient
                .from('persons')
                .update({
                  image,
                  address,
                  name,
                  given_name: givenName,
                  family_name: familyName,
                  job_title: jobTitle,
                  works_for: organizationData?.id,
                  same_as: sameAs
                })
                .match({ user_id: userId, email });

              if (updateError) {
                throw new Error(updateError.message);
              }

              const { error: EngagementError } = await supabaseClient
                .from('engagement')
                .upsert({
                  email,
                  user_id: userId,
                  engagement_type: 'ENRICH'
                });

              if (EngagementError) {
                throw new Error(EngagementError.message);
              }
            }
          )
        );

        const { error: updateTaskError } = await supabaseClient
          .from('tasks')
          .update({
            status: 'done',
            stopped_at: new Date().toISOString()
          })
          .eq('id', taskId);

        if (updateTaskError) {
          throw new Error(updateTaskError.message);
        }

        if (ENV.ENABLE_CREDIT) {
          const creditHandler = new CreditsHandler(
            userResolver,
            ENV.CONTACT_CREDIT
          );
          await creditHandler.deduct(userId, enrichementResult.length);
        }

        return res.status(200);
      } catch (err) {
        await supabaseClient
          .from('tasks')
          .update({
            status: 'canceled',
            stopped_at: new Date().toISOString()
          })
          .eq('id', taskId);
        return next(err);
      }
    }
  };
}
