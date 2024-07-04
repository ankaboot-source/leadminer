import { NextFunction, Request, Response } from 'express';
import { Redis } from 'ioredis';
import { VoilanorbertEmailEnricher } from '../services/email-enrichment/voilanorbert';
import Voilanorbert from '../services/email-enrichment/voilanorbert/client';
import logger from '../utils/logger';
import supabaseClient from '../utils/supabase';
import ENV from '../config';
import CreditsHandler from '../services/credits/creditHandler';
import { Users } from '../db/interfaces/Users';

export default function initializeEnrichementController(
  userResolver: Users,
  redisClient: Redis
) {
  const CACHING_KEY = 'enrich';
  return {
    async enrich(req: Request, res: Response, next: NextFunction) {
      const { user } = res.locals;
      const { emails }: { emails: string[] } = req.body;

      if (!emails || !Array.isArray(emails)) {
        return res
          .status(400)
          .json({ message: 'Parameter emails:string[] is required.' });
      }

      try {
        if (ENV.ENABLE_CREDIT) {
          const creditHandler = new CreditsHandler(
            userResolver,
            ENV.CONTACT_CREDIT
          );
          const {
            hasDeficientCredits,
            hasInsufficientCredits,
            availableUnits
          } = await creditHandler.validate(user.id, emails.length);

          if (hasDeficientCredits || hasInsufficientCredits) {
            const response = {
              total: emails.length,
              available: Math.floor(availableUnits)
            };
            return res
              .status(creditHandler.DEFICIENT_CREDITS_STATUS)
              .json(response);
          }
        }

        const enricher = new VoilanorbertEmailEnricher(
          new Voilanorbert(
            {
              username: ENV.VOILANORBERT_USERNAME!,
              apiToken: ENV.VOILANORBERT_API_KEY!
            },
            logger
          ),
          logger
        );

        const result = await enricher.enrichWebhook(
          emails,
          `${ENV.LEADMINER_API_HOST}/api/enrichement/webhook`
        );

        await redisClient.hset(
          CACHING_KEY,
          result.token,
          JSON.stringify({
            token: result.token,
            userId: user.id,
            createdAt: Date.now()
          })
        );

        return res.status(200).json({ ...result });
      } catch (err) {
        return next(err);
      }
    },

    async webhook(req: Request, res: Response, next: NextFunction) {
      const data = req.body;

      try {
        const enricher = new VoilanorbertEmailEnricher(
          new Voilanorbert(
            {
              username: ENV.VOILANORBERT_USERNAME!,
              apiToken: ENV.VOILANORBERT_API_KEY!
            },
            logger
          ),
          logger
        );

        const verification = await redisClient.hget(CACHING_KEY, data.token);

        if (verification === null) {
          return res.sendStatus(404);
        }

        const { userId, token } = JSON.parse(verification);

        if (userId !== userId.id || token !== data.token) {
          return res.sendStatus(401);
        }

        const enrichementResult = enricher.webhookHandler(data);

        await Promise.allSettled(
          enrichementResult.map(async (result) =>
            supabaseClient
              .from('persons')
              .update({
                image: result.image.length ? result.image : undefined,
                name: result.fullName.length ? result.fullName : undefined,
                works_for: result.organization.length
                  ? result.organization
                  : undefined,
                job_title: result.role.length ? result.role : undefined,
                location: result.location.length ? result.location : undefined,
                same_as: result.same_as.length ? result.same_as : undefined
              })
              .eq('user_id', userId)
          )
        );

        if (ENV.ENABLE_CREDIT) {
          const creditHandler = new CreditsHandler(
            userResolver,
            ENV.CONTACT_CREDIT
          );
          await creditHandler.validate(userId, enrichementResult.length);
        }

        return res.sendStatus(200);
      } catch (err) {
        return next(err);
      }
    }
  };
}
