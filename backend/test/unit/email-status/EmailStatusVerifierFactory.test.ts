import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Logger } from 'winston';
import EmailStatusVerifierFactory from '../../../src/services/email-status/EmailStatusVerifierFactory';

jest.mock('../../../src/config', () => ({
  LEADMINER_API_LOG_LEVEL: 'error',
  EMAILS_QUOTA_REACHER: 10,
  EMAILS_QUOTA_MAILERCHECK: 5,
  EMAILS_QUOTA_ZEROBOUNCE: 15
}));

const reacherDefaultConfig = {
  REACHER_HOST: 'test',
  REACHER_SMTP_CONNECTION_TIMEOUT_SECONDS: 5,
  REACHER_SMTP_CONNECTION_RETRIES: 5,
  REACHER_MICROSOFT365_USE_API: true,
  REACHER_GMAIL_USE_API: true,
  REACHER_YAHOO_USE_API: true,
  REACHER_REQUEST_TIMEOUT_MS: 5,
  REACHER_RATE_LIMITER_REQUESTS: 5,
  REACHER_RATE_LIMITER_INTERVAL: 1000
};

const outlookEmails = [
  'leadminer-test1@outlook.com',
  'leadminer-test3@live.fr',
  'leadminer-test4@msn.us',
  'leadminer-test5@outlook.in',
  'leadminer-test7@live.com.au',
  'leadminer-test8@outlook.nl',
  'leadminer-test9@live.es',
  'leadminer-test10@msn.com.br',
  'leadminer-test12@live.mx'
];

const hotmailEmails = [
  'leadminer-test1@hotmail.co.uk',
  'leadminer-test2@hotmail.co.jp',
  'leadminer-test3@hotmail.ru'
];

const yahooEmails = [
  'leadminer-test1@yahoo.com',
  'leadminer-test2@yahoo.fr',
  'leadminer-test3@yahoo.us',
  'leadminer-test4@yahoo.in'
];

const mailercheckZerobounceOnly = [
  'test1@wanadoo.fr',
  'test2@free.fr',
  'test3@orange.fr',
  'test4@laposte.net',
  'test5@live.com'
];

const googleEmails = ['leadminer-test1@gmail.com', 'leadminer-test2@gmail.com'];

const LOGGER = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
} as unknown as Logger;

describe('EmailStatusVerifierFactory()', () => {
  let baseConfig: any;
  let factory: EmailStatusVerifierFactory;

  beforeEach(() => {
    baseConfig = {
      ...reacherDefaultConfig,
      ZEROBOUNCE_API_KEY: 'sandbox',
      MAILERCHECK_API_KEY: 'apiKey',
      REACHER_API_KEY: 'apiKey'
    };

    factory = new EmailStatusVerifierFactory(baseConfig, LOGGER);
  });

  describe('getEmailVerifiers', () => {
    it('should return verifiers with emails partitioned based on capacity', () => {
      const emails = [
        ...mailercheckZerobounceOnly,
        ...hotmailEmails,
        ...googleEmails,
        ...outlookEmails,
        ...yahooEmails
      ];

      const verifiersMap = factory.getEmailVerifiers(emails);

      expect(verifiersMap.size).toBe(3);
      expect(verifiersMap.get('mailercheck')).toBeDefined();
      expect(verifiersMap.get('zerobounce')).toBeDefined();
      expect(verifiersMap.get('reacher')).toBeDefined();

      const emailAllocatedReacher = verifiersMap.get('reacher')?.[1]
        .length as number;
      const emailAllocatedMailercheck = verifiersMap.get('mailercheck')?.[1]
        .length as number;
      const emailAllocatedZerobounce = verifiersMap.get('zerobounce')?.[1]
        .length as number;

      expect(emailAllocatedReacher).toBe(2);
      expect(emailAllocatedMailercheck).toBe(5);
      expect(emailAllocatedZerobounce).toBe(
        emails.length - (emailAllocatedReacher + emailAllocatedMailercheck)
      );
    });

    it('should return verifiers with emails partitioned based on capacity, without reacher', () => {
      const emails = [
        ...mailercheckZerobounceOnly,
        ...hotmailEmails,
        ...googleEmails,
        ...outlookEmails,
        ...yahooEmails
      ];

      delete baseConfig.REACHER_API_KEY;

      factory = new EmailStatusVerifierFactory(baseConfig, LOGGER);

      const verifiersMap = factory.getEmailVerifiers(emails);

      expect(verifiersMap.size).toBe(2);
      expect(verifiersMap.get('reacher')).toBeUndefined();
      expect(verifiersMap.get('mailercheck')).toBeDefined();
      expect(verifiersMap.get('zerobounce')).toBeDefined();

      const emailAllocatedMailercheck = verifiersMap.get('mailercheck')?.[1]
        .length as number;
      const emailAllocatedZerobounce = verifiersMap.get('zerobounce')?.[1]
        .length as number;

      expect(emailAllocatedMailercheck).toBe(5);
      expect(emailAllocatedZerobounce).toBe(
        emails.length - emailAllocatedMailercheck
      );
    });

    it('should return verifiers with emails partitioned based on capacity, without mailercheck', () => {
      const emails = [
        ...mailercheckZerobounceOnly,
        ...hotmailEmails,
        ...googleEmails,
        ...outlookEmails,
        ...yahooEmails
      ];

      delete baseConfig.MAILERCHECK_API_KEY;

      factory = new EmailStatusVerifierFactory(baseConfig, LOGGER);

      const verifiersMap = factory.getEmailVerifiers(emails);

      expect(verifiersMap.size).toBe(2);
      expect(verifiersMap.get('reacher')).toBeDefined();
      expect(verifiersMap.get('zerobounce')).toBeDefined();
      expect(verifiersMap.get('mailercheck')).toBeUndefined();

      const emailAllocatedReacher = verifiersMap.get('reacher')?.[1]
        .length as number;
      const emailAllocatedZerobounce = verifiersMap.get('zerobounce')?.[1]
        .length as number;

      expect(emailAllocatedReacher).toBe(2);
      expect(emailAllocatedZerobounce).toBe(
        emails.length - emailAllocatedReacher
      );
    });

    it('should return verifiers with emails partitioned based on capacity, Without zerobounce', () => {
      const emails = [
        ...mailercheckZerobounceOnly,
        ...hotmailEmails,
        ...googleEmails,
        ...outlookEmails,
        ...yahooEmails
      ];

      delete baseConfig.ZEROBOUNCE_API_KEY;

      factory = new EmailStatusVerifierFactory(baseConfig, LOGGER);

      const verifiersMap = factory.getEmailVerifiers(emails);

      expect(verifiersMap.size).toBe(2);
      expect(verifiersMap.get('reacher')).toBeDefined();
      expect(verifiersMap.get('mailercheck')).toBeDefined();
      expect(verifiersMap.get('zerobounce')).toBeUndefined();

      const emailAllocatedReacher = verifiersMap.get('reacher')?.[1]
        .length as number;
      const emailAllocatedMailercheck = verifiersMap.get('mailercheck')?.[1]
        .length as number;

      expect(emailAllocatedReacher).toBe(2);
      expect(emailAllocatedMailercheck).toBe(
        emails.length - emailAllocatedReacher
      );
    });

    it('should use available verifier without partitioning emails, if verifiers.length === 1', () => {
      const emails = [
        ...mailercheckZerobounceOnly,
        ...hotmailEmails,
        ...googleEmails,
        ...outlookEmails,
        ...yahooEmails
      ];

      delete baseConfig.ZEROBOUNCE_API_KEY;
      delete baseConfig.MAILERCHECK_API_KEY;

      factory = new EmailStatusVerifierFactory(baseConfig, LOGGER);

      const verifiersMap = factory.getEmailVerifiers(emails);
      const [[, assignedEmails]] = Array.from(verifiersMap.values());

      expect(verifiersMap.size).toBe(1);
      expect(assignedEmails.length).toBe(emails.length);
    });
  });
});
