import { Logger } from 'winston';
import { EmailStatusVerifier, EmailVerifierType } from './EmailStatusVerifier';
import MailerCheckEmailStatusVerifier from './mailercheck';
import MailerCheckClient from './mailercheck/client';
import RandomEmailStatusVerifier from './random';
import ReacherEmailStatusVerifier from './reacher';
import ReacherClient from './reacher/client';

interface Config extends ReacherConfig, MailerCheckConfig {}

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
}

interface MailerCheckConfig {
  MAILERCHECK_API_KEY?: string;
}

export default class EmailStatusVerifierFactory {
  private static readonly MAILER_CHECK_DOMAIN_REGEX =
    /(?=(@hotmail|@gmail|@yahoo|@live|@outlook|@msn|@wandoo\.fr|@free\.fr|@orange\.fr|@laposte\.net))/;

  private readonly randomEmailStatusVerifier: EmailStatusVerifier;

  private reacherEmailStatusVerifier?: EmailStatusVerifier;

  private mailerCheckEmailStatusVerifier?: EmailStatusVerifier;

  constructor(config: Config, logger: Logger) {
    this.randomEmailStatusVerifier = new RandomEmailStatusVerifier();

    if (config.REACHER_API_KEY || config.REACHER_HEADER_SECRET) {
      this.createReacherEmailStatusVerifier(config, logger);
    }

    if (config.MAILERCHECK_API_KEY) {
      this.createMailerCheckStatusVerifier(
        { MAILERCHECK_API_KEY: config.MAILERCHECK_API_KEY },
        logger
      );
    }
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
      random: [] as string[]
    };

    emails.forEach((email) => {
      const verifier = this.getEmailVerifier(email);
      switch (verifier.constructor.name) {
        case 'ReacherEmailStatusVerifier':
          emailGroups.reacher.push(email);
          break;
        case 'MailerCheckEmailStatusVerifier':
          emailGroups.mailercheck.push(email);
          break;
        default:
          emailGroups.random.push(email);
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

    if (emailGroups.random.length > 0) {
      addVerifierEmails(
        'random',
        this.randomEmailStatusVerifier,
        emailGroups.random
      );
    } else {
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
    }

    return verifiersWithEmails;
  }

  getEmailVerifier(email: string): EmailStatusVerifier {
    if (
      this.reacherEmailStatusVerifier &&
      this.mailerCheckEmailStatusVerifier
    ) {
      return EmailStatusVerifierFactory.MAILER_CHECK_DOMAIN_REGEX.test(email)
        ? this.mailerCheckEmailStatusVerifier
        : this.reacherEmailStatusVerifier;
    }

    return (
      this.mailerCheckEmailStatusVerifier ??
      this.reacherEmailStatusVerifier ??
      this.randomEmailStatusVerifier
    );
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
}
