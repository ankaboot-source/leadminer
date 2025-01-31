import { Logger } from 'winston';
import { EmailStatusVerifier, EmailVerifierType } from './EmailStatusVerifier';
import MailerCheckEmailStatusVerifier from './mailercheck';
import MailerCheckClient from './mailercheck/client';
import ReacherEmailStatusVerifier from './reacher';
import ReacherClient from './reacher/client';
import ZerobounceEmailStatusVerifier from './zerobounce';
import ZerobounceClient from './zerobounce/client';

interface Config extends ReacherConfig, MailerCheckConfig, ZerobounceConfig {
  LOAD_BALANCE_VERIFIERS: boolean;
}

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

export default class EmailStatusVerifierFactory {
  private static readonly MAILER_CHECK_DOMAIN_REGEX =
    /(?=(@hotmail|@yahoo|@live|@outlook|@msn|@wandoo\.fr|@free\.fr|@orange\.fr|@laposte\.net))/;

  private currentVerifierIndex = 0;

  private verifiers: EmailStatusVerifier[] = [];

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

    if (config.LOAD_BALANCE_VERIFIERS === true) {
      if (this.mailerCheckEmailStatusVerifier) {
        this.verifiers.push(this.mailerCheckEmailStatusVerifier);
      }

      if (this.zerobounceEmailStatusVerifier) {
        this.verifiers.push(this.zerobounceEmailStatusVerifier);
      }

      if (this.reacherEmailStatusVerifier && !this.verifiers.length) {
        this.verifiers.push(this.reacherEmailStatusVerifier);
      }
    } else {
      this.verifiers = [
        this.zerobounceEmailStatusVerifier ??
          this.mailerCheckEmailStatusVerifier ??
          this.reacherEmailStatusVerifier
      ].filter(Boolean) as EmailStatusVerifier[];
    }
  }

  private getNextVerifier(): EmailStatusVerifier {
    const verifier = this.verifiers[this.currentVerifierIndex];
    this.currentVerifierIndex =
      (this.currentVerifierIndex + 1) % this.verifiers.length;
    return verifier;
  }

  getEmailVerifiers(
    emails: string[]
  ): Map<EmailVerifierType, [EmailStatusVerifier, string[]]> {
    const verifiersWithEmails = new Map<
      EmailVerifierType,
      [EmailStatusVerifier, string[]]
    >();

    const emailGroups = {
      reacher: [] as string[],
      mailercheck: [] as string[],
      zerobounce: [] as string[]
    };

    emails.forEach((email) => {
      const verifier = this.getEmailVerifier(email);
      switch (verifier.constructor.name) {
        case 'ReacherEmailStatusVerifier':
          emailGroups.reacher.push(email);
          break;
        case 'ZerobounceEmailStatusVerifier':
          emailGroups.zerobounce.push(email);
          break;
        case 'MailerCheckEmailStatusVerifier':
          emailGroups.mailercheck.push(email);
          break;
        default:
          break;
      }
    });

    const addVerifierEmails = (
      type: EmailVerifierType,
      verifier: EmailStatusVerifier,
      emailList: string[]
    ) => {
      if (emailList.length > 0) {
        verifiersWithEmails.set(type, [verifier, emailList]);
      }
    };

    if (emailGroups.reacher.length > 0 && this.reacherEmailStatusVerifier) {
      addVerifierEmails(
        'reacher',
        this.reacherEmailStatusVerifier,
        emailGroups.reacher
      );
    }
    if (
      emailGroups.mailercheck.length > 0 &&
      this.mailerCheckEmailStatusVerifier
    ) {
      addVerifierEmails(
        'mailercheck',
        this.mailerCheckEmailStatusVerifier,
        emailGroups.mailercheck
      );
    }
    if (
      emailGroups.zerobounce.length > 0 &&
      this.zerobounceEmailStatusVerifier
    ) {
      addVerifierEmails(
        'zerobounce',
        this.zerobounceEmailStatusVerifier,
        emailGroups.zerobounce
      );
    }

    return verifiersWithEmails;
  }

  getEmailVerifier(email: string): EmailStatusVerifier {
    if (this.reacherEmailStatusVerifier && this.verifiers.length > 0) {
      return EmailStatusVerifierFactory.MAILER_CHECK_DOMAIN_REGEX.test(email)
        ? this.getNextVerifier()
        : this.reacherEmailStatusVerifier;
    }
    return this.getNextVerifier();
  }

  private createReacherEmailStatusVerifier(
    config: ReacherConfig,
    logger: Logger
  ) {
    const reacherClient = new ReacherClient(logger, {
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
      },
      rateLimiter: {
        requests: config.REACHER_RATE_LIMITER_REQUESTS,
        interval: config.REACHER_RATE_LIMITER_INTERVAL,
        spaced: false
      }
    });

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
      logger
    );

    this.zerobounceEmailStatusVerifier = new ZerobounceEmailStatusVerifier(
      client,
      logger
    );
  }
}
