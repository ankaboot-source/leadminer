import { Logger } from 'winston';
import { EmailStatusVerifier } from './EmailStatusVerifier';
import RandomEmailStatusVerifier from './random';
import ReacherEmailStatusVerifier from './reacher';
import ReacherClient from './reacher/client';

interface DevConfig {
  NODE_ENV: 'development';
}

interface ProductionConfig {
  NODE_ENV: 'production' | 'test';
  REACHER_HOST: string;
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
  REACHER_HOTMAIL_USE_HEADLESS: string;
  REACHER_MICROSOFT365_USE_API: boolean;
  REACHER_GMAIL_USE_API: boolean;
  REACHER_YAHOO_USE_API: boolean;
}

type Config = DevConfig | ProductionConfig;

const EmailStatusVerifierFactory = {
  create(config: Config, logger: Logger): EmailStatusVerifier {
    if (config.NODE_ENV === 'development') {
      return new RandomEmailStatusVerifier();
    }

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

    return new ReacherEmailStatusVerifier(reacherClient, logger);
  }
};

export default EmailStatusVerifierFactory;
