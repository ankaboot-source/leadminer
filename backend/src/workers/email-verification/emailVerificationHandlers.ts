import { Logger } from 'winston';
import PQueue from 'p-queue';
import Redis from 'ioredis';
import { Contacts } from '../../db/interfaces/Contacts';
import EmailStatusCache from '../../services/cache/EmailStatusCache';
import {
  EmailStatusResult,
  EmailStatusVerifier,
  EmailVerifierType
} from '../../services/email-status/EmailStatusVerifier';
import EmailStatusVerifierFactory from '../../services/email-status/EmailStatusVerifierFactory';

export interface EmailVerificationData {
  userId: string;
  email: string;
  miningId: string;
}

function getFailurePhase(
  cacheLookupTime: number,
  engineVerifyTime: number
): string {
  if (!cacheLookupTime) {
    return 'cache_lookup';
  }

  if (!engineVerifyTime) {
    return 'engine_verify';
  }

  return 'persistence';
}

const MAX_QUEUE_SIZE = 20_000;
const DRAIN_THRESHOLD = Math.floor(MAX_QUEUE_SIZE * 0.7);
const VERIFIER_PRIORITY: Record<EmailVerifierType, number> = {
  reacher: 1,
  zerobounce: 2,
  random: 0,
  mailercheck: 0,
  'email-message-class': 0
};

export class EmailVerificationHandler {
  private readonly queue: PQueue;

  private readonly streamActiveJobs = new Map<string, number>();

  private readonly streamProgressDelta = new Map<string, number>();

  private progressInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly contacts: Contacts,
    private readonly emailStatusCache: EmailStatusCache,
    private readonly emailStatusVerifier: EmailStatusVerifierFactory,
    private readonly redisClient: Redis,
    private readonly logger: Logger
  ) {
    this.queue = new PQueue({ concurrency: 10, interval: 100, intervalCap: 1 });
  }

  static generateEmailId(email: string, userId: string) {
    return `${email}:${userId}`;
  }

  static decodeEmailId(emailId: string) {
    const [email, userId] = emailId.split(':');
    return { email, userId };
  }

  /**
   * Processes jobs and manages queue priority
   */
  public async handle(streamId: string, jobs: EmailVerificationData[]) {
    if (!this.streamActiveJobs.has(streamId)) {
      this.logger.debug(
        '[EmailVerificationHandler.handle]: Aborting ingestion: stream was unregistered',
        { streamId }
      );
      return;
    }

    const emailToEmailIdsMap = new Map<string, string[]>();

    for (const { email, userId } of jobs) {
      const id = EmailVerificationHandler.generateEmailId(email, userId);
      const ids = emailToEmailIdsMap.get(email) || [];
      ids.push(id);
      emailToEmailIdsMap.set(email, ids);
    }

    const verifierGroups = this.emailStatusVerifier.getEmailVerifiers(
      Array.from(emailToEmailIdsMap.keys())
    );

    /* eslint-disable no-await-in-loop */
    for (const [engineName, [engine, emails]] of verifierGroups) {
      const priority = VERIFIER_PRIORITY[engineName as EmailVerifierType] ?? 0;

      for (const email of emails) {
        await this.applyBackpressure();

        if (!this.streamActiveJobs.has(streamId)) {
          this.logger.debug(
            '[EmailVerificationHandler.handle]: Aborting ingestion: stream was unregistered',
            { streamId }
          );
          break;
        }

        const emailIds = emailToEmailIdsMap.get(email);
        if (!emailIds || emailIds.length === 0) continue;

        if (emailIds.length > 1) {
          this.logger.debug(
            `[EmailVerificationHandler.handle]: Email ${email} has ${emailIds.length} duplicates will be pushed to queue`,
            { streamId }
          );
        }

        emailIds.forEach((emailId) => {
          const { email: emailToVerify, userId } =
            EmailVerificationHandler.decodeEmailId(emailId);

          this.incrementActive(streamId);

          this.queue
            .add(
              async () => {
                await this.verifySingle(
                  streamId,
                  emailToVerify,
                  userId,
                  engine,
                  engineName
                );
              },
              { priority }
            )
            .catch((error) => {
              this.logger.error('Queue error', { error: error.message, email });
            })
            .finally(() => {
              this.decrementActive(streamId);
            });
        });
      }
    }
    /* eslint-disable no-await-in-loop */
  }

  private async applyBackpressure() {
    if (this.queue.size < MAX_QUEUE_SIZE) return;

    this.logger.debug('Queue limit reached. Applying backpressure...', {
      currentSize: this.queue.size,
      limit: MAX_QUEUE_SIZE,
      waitThreshold: DRAIN_THRESHOLD
    });

    const t0 = performance.now();

    // p-queue utility to wait until size drops below threshold
    await this.queue.onSizeLessThan(DRAIN_THRESHOLD);

    const duration = (performance.now() - t0).toFixed(2);
    this.logger.info('Backpressure released', {
      durationMs: duration,
      newSize: this.queue.size
    });
  }

  private async verifySingle(
    streamId: string,
    email: string,
    userId: string,
    engine: EmailStatusVerifier,
    engineName: string
  ) {
    const startTime = performance.now();
    let cacheLookupTime = 0;
    let engineVerifyTime = 0;
    let persistenceTime = 0;
    let cacheHit = false;

    if (!this.streamActiveJobs.has(streamId)) {
      this.logger.debug(
        '[EmailVerificationHandler.verifySingle]: Aborting job: stream was unregistered',
        { streamId }
      );
      return;
    }

    try {
      const t0 = performance.now();
      let result = await this.isExistingStatus(email);
      cacheLookupTime = performance.now() - t0;

      if (result?.status) {
        cacheHit = true;
      } else {
        const t1 = performance.now();
        result = await engine.verify(email);
        engineVerifyTime = performance.now() - t1;
      }

      if (result?.status) {
        const t2 = performance.now();
        await this.updateStatus(userId, email, result);
        persistenceTime = performance.now() - t2;
      }

      this.logger.info('Verification completed', {
        streamId,
        engineName,
        cacheHit,
        metrics: {
          cacheLookupMs: cacheLookupTime.toFixed(2),
          engineVerifyMs: engineVerifyTime.toFixed(2),
          persistenceMs: persistenceTime.toFixed(2),
          totalMs: (performance.now() - startTime).toFixed(2)
        }
      });
    } catch (error) {
      const totalTimeSoFar = performance.now() - startTime;
      this.logger.error('Verification step failed', {
        error,
        streamId,
        engineName,
        context: {
          cacheHit,
          timeBeforeFailureMs: totalTimeSoFar.toFixed(2),
          phase: getFailurePhase(cacheLookupTime, engineVerifyTime)
        }
      });
    } finally {
      // Update progress for ticker
      const current = this.streamProgressDelta.get(streamId) ?? 0;
      this.streamProgressDelta.set(streamId, current + 1);
    }
  }

  private startProgressTicker() {
    if (this.progressInterval) return;

    this.progressInterval = setInterval(async () => {
      if (this.streamProgressDelta.size === 0) {
        this.stopProgressTicker();
        return;
      }

      for (const [streamId, count] of this.streamProgressDelta.entries()) {
        if (count === 0) continue;

        const channelId = streamId.split('-')[1] || streamId;
        const payload = JSON.stringify({
          miningId: channelId,
          progressType: 'verifiedContacts',
          count
        });

        this.redisClient.publish(channelId, payload).catch((err) => {
          this.logger.error('Redis Publish Failed', { streamId, err });
        });

        // Reset delta after publishing
        this.streamProgressDelta.set(streamId, 0);
      }
    }, 5000);
  }

  private stopProgressTicker() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
      this.logger.debug('Progress ticker stopped - no active streams');
    }
  }

  public registerStream(streamId: string) {
    if (!this.streamActiveJobs.has(streamId)) {
      this.streamActiveJobs.set(streamId, 0);
      this.streamProgressDelta.set(streamId, 0);
      this.startProgressTicker();
    }
  }

  public unregisterStream(streamId: string) {
    this.streamProgressDelta.delete(streamId);
    this.streamActiveJobs.delete(streamId);

    if (this.streamProgressDelta.size === 0) {
      this.stopProgressTicker();
    }
  }

  private async isExistingStatus(email: string) {
    const existingStatus =
      (await this.emailStatusCache.get(email)) ??
      (await this.contacts.SelectRecentEmailStatus(email));
    return existingStatus;
  }

  private async updateStatus(
    userId: string,
    email: string,
    status: EmailStatusResult
  ) {
    await this.emailStatusCache.set(email, status);
    return this.contacts.upsertEmailStatus({
      verifiedOn: new Date().toISOString(),
      ...status,
      email,
      userId
    });
  }

  private incrementActive(streamId: string) {
    const jobs = this.streamActiveJobs.get(streamId);
    if (!jobs) return;
    this.streamActiveJobs.set(streamId, jobs + 1);
  }

  private decrementActive(streamId: string) {
    const jobs = this.streamActiveJobs.get(streamId);
    if (!jobs) return;
    this.streamActiveJobs.set(streamId, jobs - 1);
  }
}

export default function initializeEmailVerificationProcessor(
  contacts: Contacts,
  emailStatusCache: EmailStatusCache,
  emailStatusVerifier: EmailStatusVerifierFactory,
  redisClient: Redis,
  logger: Logger
) {
  const handler = new EmailVerificationHandler(
    contacts,
    emailStatusCache,
    emailStatusVerifier,
    redisClient,
    logger
  );

  return handler;
}
