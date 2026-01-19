import { Logger } from 'winston';
import { EmailStatusVerifier, EmailVerifierType } from './EmailStatusVerifier';
import MailerCheckEmailStatusVerifier from './mailercheck';
import MailerCheckClient from './mailercheck/client';
import ReacherEmailStatusVerifier from './reacher';
import ReacherClient from './reacher/client';
import ZerobounceEmailStatusVerifier from './zerobounce';
import ZerobounceClient from './zerobounce/client';
import { Distribution, TokenBucketRateLimiter } from '../rate-limiter';

interface Config extends ReacherConfig, MailerCheckConfig, ZerobounceConfig {}

interface ReacherConfig {
  REACHER_HOST?: string;
  REACHER_API_KEY?: string;
  REACHER_HEADER_SECRET?: string;
  REACHER_SMTP_FROM?: string;
  REACHER_SMTP_HELLO?: string;
  REACHER_PROXY_PORT?: number;
  REACHER_PROXY_HOST?: string;
  REACHER_PROXY_USERNAME?: string;
  REACHER_PROXY_PASSWORD?: string;
  REACHER_REQUEST_TIMEOUT_MS: number;
  REACHER_SMTP_CONNECTION_TIMEOUT_SECONDS: number;
  REACHER_SMTP_CONNECTION_RETRIES: number;
  REACHER_HOTMAIL_USE_HEADLESS?: string;
  REACHER_MICROSOFT365_USE_API: boolean;
  REACHER_GMAIL_USE_API: boolean;
  REACHER_YAHOO_USE_API: boolean;
  REACHER_RATE_LIMITER_REQUESTS: number;
  REACHER_RATE_LIMITER_INTERVAL: number;
}

interface MailerCheckConfig {
  MAILERCHECK_API_KEY?: string;
}

interface ZerobounceConfig {
  ZEROBOUNCE_API_KEY?: string;
}

interface Verifier {
  type: EmailVerifierType;
  verifier: EmailStatusVerifier;
}

function partitionEmailsByQuota(
  emails: string[],
  verifier: Verifier
): { selectedEmails: string[]; skippedEmails: string[] } {
  const selectedEmails: string[] = [];
  const skippedEmails: string[] = [];

  for (const email of emails) {
    if (!verifier.verifier.isEligibleEmail(email)) {
      skippedEmails.push(email);
      continue;
    }

    if (selectedEmails.length >= verifier.verifier.emailsQuota) {
      skippedEmails.push(email);
      continue;
    }

    selectedEmails.push(email);
  }

  return { selectedEmails, skippedEmails };
}

export default class EmailStatusVerifierFactory {
  private readonly verifiers: Verifier[];

  private reacherEmailStatusVerifier?: EmailStatusVerifier;

  private mailerCheckEmailStatusVerifier?: EmailStatusVerifier;

  private zerobounceEmailStatusVerifier?: EmailStatusVerifier;

  constructor(config: Config, logger: Logger) {
    if (
      config.REACHER_HOST &&
      (config.REACHER_API_KEY || config.REACHER_HEADER_SECRET)
    ) {
      this.createReacherEmailStatusVerifier(config, logger);
    }

    if (config.MAILERCHECK_API_KEY) {
      this.createMailerCheckStatusVerifier(
        { MAILERCHECK_API_KEY: config.MAILERCHECK_API_KEY },
        logger
      );
    }

    if (config.ZEROBOUNCE_API_KEY) {
      this.createZerobounceStatusVerifier(
        { ZEROBOUNCE_API_KEY: config.ZEROBOUNCE_API_KEY },
        logger
      );
    }

    this.verifiers = this.createVerifiers();
  }

  private createVerifiers(): Verifier[] {
    const generate = (
      type: EmailVerifierType,
      verifier: EmailStatusVerifier
    ) => ({ type, verifier });

    return [
      this.reacherEmailStatusVerifier &&
        generate('reacher', this.reacherEmailStatusVerifier),
      this.mailerCheckEmailStatusVerifier &&
        generate('mailercheck', this.mailerCheckEmailStatusVerifier),
      this.zerobounceEmailStatusVerifier &&
        generate('zerobounce', this.zerobounceEmailStatusVerifier)
    ].filter(
      (
        verifier
      ): verifier is {
        type: EmailVerifierType;
        verifier: EmailStatusVerifier;
      } => verifier !== undefined
    );
  }

  private getVerifiersWithEmails(emails: string[]): [Verifier, string[]][] {
    const partitioned: [Verifier, string[]][] = [];

    if (!this.verifiers.length) return partitioned;

    let remainingEmails = [...emails];

    for (const verifier of this.verifiers.slice(0, -1)) {
      const { selectedEmails, skippedEmails } = partitionEmailsByQuota(
        remainingEmails,
        verifier
      );

      if (selectedEmails.length) {
        partitioned.push([verifier, selectedEmails]);
      }

      remainingEmails = skippedEmails;
    }

    if (remainingEmails.length) {
      partitioned.push([
        this.verifiers[this.verifiers.length - 1],
        remainingEmails
      ]);
    }

    return partitioned;
  }

  getEmailVerifiers(emails: string[]) {
    let verifiersAssigned = this.verifiers.length
      ? ([[this.verifiers[0], emails]] as [Verifier, string[]][])
      : [];

    if (this.verifiers.length > 1) {
      verifiersAssigned = this.getVerifiersWithEmails(emails);
    }

    return new Map<EmailVerifierType, [EmailStatusVerifier, string[]]>(
      verifiersAssigned.map(([{ type, verifier }, emailList]) => [
        type,
        [verifier, emailList]
      ])
    );
  }

  private createReacherEmailStatusVerifier(
    config: ReacherConfig,
    logger: Logger
  ) {
    const reacherClient = new ReacherClient(
      {
        host: config.REACHER_HOST,
        apiKey: config.REACHER_API_KEY,
        headerSecret: config.REACHER_HEADER_SECRET,
        timeoutMs: config.REACHER_REQUEST_TIMEOUT_MS,
        microsoft365UseApi: config.REACHER_MICROSOFT365_USE_API,
        gmailUseApi: config.REACHER_GMAIL_USE_API,
        yahooUseApi: config.REACHER_YAHOO_USE_API,
        hotmailUseHeadless: config.REACHER_HOTMAIL_USE_HEADLESS,
        smtpRetries: config.REACHER_SMTP_CONNECTION_RETRIES,
        smtpTimeoutSeconds: config.REACHER_SMTP_CONNECTION_TIMEOUT_SECONDS,
        smtpConfig: {
          helloName: config.REACHER_SMTP_HELLO,
          fromEmail: config.REACHER_SMTP_FROM,
          proxy:
            config.REACHER_PROXY_HOST && config.REACHER_PROXY_PORT
              ? {
                  port: config.REACHER_PROXY_PORT,
                  host: config.REACHER_PROXY_HOST,
                  username: config.REACHER_PROXY_USERNAME,
                  password: config.REACHER_PROXY_PASSWORD
                }
              : undefined
        }
      },
      new TokenBucketRateLimiter({
        executeEvenly: false,
        uniqueKey: 'email-verification-reacher',
        distribution: Distribution.Memory,
        requests: config.REACHER_RATE_LIMITER_REQUESTS,
        intervalSeconds: config.REACHER_RATE_LIMITER_INTERVAL
      }),
      logger
    );

    this.reacherEmailStatusVerifier = new ReacherEmailStatusVerifier(
      reacherClient,
      logger
    );
  }

  private createMailerCheckStatusVerifier(
    { MAILERCHECK_API_KEY }: { MAILERCHECK_API_KEY: string },
    logger: Logger
  ) {
    const client = new MailerCheckClient(
      { apiToken: MAILERCHECK_API_KEY },
      new TokenBucketRateLimiter({
        executeEvenly: false,
        uniqueKey: 'email-verification-mailercheck',
        distribution: Distribution.Memory,
        requests: 60,
        intervalSeconds: 60
      }),
      logger
    );

    this.mailerCheckEmailStatusVerifier = new MailerCheckEmailStatusVerifier(
      client,
      logger
    );
  }

  private createZerobounceStatusVerifier(
    { ZEROBOUNCE_API_KEY }: { ZEROBOUNCE_API_KEY: string },
    logger: Logger
  ) {
    const client = new ZerobounceClient(
      { apiToken: ZEROBOUNCE_API_KEY },
      new TokenBucketRateLimiter({
        executeEvenly: false,
        uniqueKey: 'email-verification-zerobounce-single',
        distribution: Distribution.Memory,
        requests: ZerobounceClient.SINGLE_VALIDATION_PER_10_SECONDS,
        intervalSeconds: 60
      }),
      new TokenBucketRateLimiter({
        executeEvenly: false,
        uniqueKey: 'email-verification-zerobounce-bulk',
        distribution: Distribution.Memory,
        requests: ZerobounceClient.BATCH_VALIDATION_PER_MINUTE,
        intervalSeconds: 60
      }),
      logger
    );

    this.zerobounceEmailStatusVerifier = new ZerobounceEmailStatusVerifier(
      client,
      logger
    );
  }
}
