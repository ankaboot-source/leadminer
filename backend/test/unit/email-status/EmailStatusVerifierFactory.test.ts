import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import EmailStatusVerifierFactory from '../../../src/services/email-status/EmailStatusVerifierFactory';
import MailerCheckEmailStatusVerifier from '../../../src/services/email-status/mailercheck';
import RandomEmailStatusVerifier from '../../../src/services/email-status/random';
import ReacherEmailStatusVerifier from '../../../src/services/email-status/reacher';
import logger from '../../../src/utils/logger';

jest.mock('../../../src/config', () => ({
  LEADMINER_API_LOG_LEVEL: 'error'
}));

const reacherDefaultConfig = {
  REACHER_SMTP_CONNECTION_TIMEOUT_SECONDS: 5,
  REACHER_SMTP_CONNECTION_RETRIES: 5,
  REACHER_MICROSOFT365_USE_API: true,
  REACHER_GMAIL_USE_API: true,
  REACHER_YAHOO_USE_API: true,
  REACHER_REQUEST_TIMEOUT_MS: 5
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

const mailercheckOnly = [
  'test@wandoo.fr',
  'test@free.fr',
  'test@orange.fr',
  'test@laposte.net',
  'test@live.com'
];

const googleEmails = ['leadminer-test1@gmail.com'];

const emails = [
  ...mailercheckOnly,
  ...hotmailEmails,
  ...googleEmails,
  ...outlookEmails,
  ...yahooEmails
];

describe('getEmailVerifier', () => {
  describe('EmailStatusVerifierFactory() with Reacher & Mailercheck configured', () => {
    let factory: EmailStatusVerifierFactory;

    beforeEach(() => {
      factory = new EmailStatusVerifierFactory(
        {
          MAILERCHECK_API_KEY: 'apiKey',
          REACHER_API_KEY: 'apiKey',
          ...reacherDefaultConfig
        },
        logger
      );
    });

    it.each([
      ...mailercheckOnly,
      ...hotmailEmails,
      ...googleEmails,
      ...outlookEmails,
      ...yahooEmails
    ])('should use MailerCheck for other providers email %s', (email) => {
      const verifier = factory.getEmailVerifier(email);
      expect(verifier).toBeInstanceOf(MailerCheckEmailStatusVerifier);
    });
  });

  describe('EmailStatusVerifierFactory() with Reacher configured', () => {
    let factory: EmailStatusVerifierFactory;
    beforeEach(() => {
      factory = new EmailStatusVerifierFactory(
        {
          REACHER_API_KEY: 'apiKey',
          ...reacherDefaultConfig
        },
        logger
      );
    });

    it.each([
      ...mailercheckOnly,
      ...googleEmails,
      ...yahooEmails,
      ...outlookEmails,
      ...hotmailEmails
    ])('should use Reacher for all emails providers', (email) => {
      const verifier = factory.getEmailVerifier(email);
      expect(verifier).toBeInstanceOf(ReacherEmailStatusVerifier);
    });
  });

  it('should fallback to default implementation when Reacher and MailerCheck credentials are not provided', () => {
    const factory = new EmailStatusVerifierFactory(
      {
        ...reacherDefaultConfig
      },
      logger
    );

    const verifier = factory.getEmailVerifier('email@domain.com');

    expect(verifier).toBeInstanceOf(RandomEmailStatusVerifier);
  });
});

describe('getEmailVerifiers', () => {
  let factory: EmailStatusVerifierFactory;

  beforeEach(() => {
    factory = new EmailStatusVerifierFactory(
      {
        MAILERCHECK_API_KEY: 'apiKey',
        REACHER_API_KEY: 'apiKey',
        ...reacherDefaultConfig
      },
      logger
    );
  });

  it('should categorize emails correctly and use appropriate verifiers', () => {
    const result = factory.getEmailVerifiers(emails);

    expect(result.has('random')).toBeFalsy();
    expect(result.has('reacher')).toBeFalsy();
    expect(result.get('mailercheck')).toEqual([
      expect.any(MailerCheckEmailStatusVerifier),
      [
        ...mailercheckOnly,
        ...hotmailEmails,
        ...googleEmails,
        ...outlookEmails,
        ...yahooEmails
      ]
    ]);
  });

  it('should use Reacher for all email providers when only Reacher is configured', () => {
    factory = new EmailStatusVerifierFactory(
      {
        REACHER_API_KEY: 'apiKey',
        ...reacherDefaultConfig
      },
      logger
    );
    const result = factory.getEmailVerifiers(emails);

    expect(result.has('random')).toBeFalsy();
    expect(result.has('mailercheck')).toBeFalsy();
    expect(result.get('reacher')).toEqual([
      expect.any(ReacherEmailStatusVerifier),
      emails
    ]);
  });

  it('should use Mailercheck for all email providers when only Mailercheck is configured', () => {
    factory = new EmailStatusVerifierFactory(
      {
        MAILERCHECK_API_KEY: 'apiKey',
        ...reacherDefaultConfig
      },
      logger
    );
    const result = factory.getEmailVerifiers(emails);

    expect(result.has('random')).toBeFalsy();
    expect(result.has('reacher')).toBeFalsy();
    expect(result.get('mailercheck')).toEqual([
      expect.any(MailerCheckEmailStatusVerifier),
      emails
    ]);
  });

  it('should use only Random when other verifiers are absent', () => {
    const factoryWithoutOtherVerifiers = new EmailStatusVerifierFactory(
      {
        ...reacherDefaultConfig
      },
      logger
    );

    const result = factoryWithoutOtherVerifiers.getEmailVerifiers(emails);

    expect(result.has('mailercheck')).toBeFalsy();
    expect(result.has('reacher')).toBeFalsy();
    expect(result.get('random')).toEqual([
      expect.any(RandomEmailStatusVerifier),
      emails
    ]);
  });
});
