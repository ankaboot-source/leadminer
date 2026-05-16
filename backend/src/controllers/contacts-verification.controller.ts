import { User } from '@supabase/supabase-js';
import { NextFunction, Request, Response } from 'express';
import { Contacts } from '../db/interfaces/Contacts';
import { Status } from '../services/email-status/EmailStatusVerifier';
import ReacherEmailStatusVerifier from '../services/email-status/reacher';
import ReacherClient from '../services/email-status/reacher/client';
import { TokenBucketRateLimiter, Distribution } from '../services/rate-limiter';
import logger from '../utils/logger';
import ENV from '../config';

export default function initializeContactsVerificationController(
  contacts: Contacts
) {
  const reacherClient = new ReacherClient(
    {
      host: ENV.REACHER_HOST,
      apiKey: ENV.REACHER_API_KEY,
      headerSecret: ENV.REACHER_HEADER_SECRET,
      timeoutMs: ENV.REACHER_REQUEST_TIMEOUT_MS
    },
    new TokenBucketRateLimiter({
      executeEvenly: false,
      uniqueKey: 'email-verification-reacher-single',
      distribution: Distribution.Redis,
      requests: ENV.REACHER_RATE_LIMITER_REQUESTS,
      intervalSeconds: ENV.REACHER_RATE_LIMITER_INTERVAL
    }),
    logger
  );

  const reacherVerifier = new ReacherEmailStatusVerifier(reacherClient, logger);

  return {
    async verifyEmailStatus(req: Request, res: Response, next: NextFunction) {
      try {
        const user = res.locals.user as User;
        const { email } = req.body;

        if (!email || typeof email !== 'string') {
          return res.status(400).json({ error: 'Email is required' });
        }

        const result = await reacherVerifier.verify(email);

        await contacts.upsertEmailStatus({
          email,
          status: result.status as Status,
          verifiedOn: new Date().toISOString(),
          userId: user.id,
          details: result.details
        });

        await contacts.updateManyPersonsStatus(user.id, [
          { email, status: result.status as Status }
        ]);

        return res.json({
          email,
          status: result.status,
          details: result.details
        });
      } catch (error) {
        return next(error);
      }
    }
  };
}
