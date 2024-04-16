import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import EmailStatusVerifierFactory from '../../../src/services/email-status/EmailStatusVerifierFactory';
import MailerCheckEmailStatusVerifier from '../../../src/services/email-status/mailercheck';
import RandomEmailStatusVerifier from '../../../src/services/email-status/random';
import ReacherEmailStatusVerifier from '../../../src/services/email-status/reacher';
import logger from '../../../src/utils/logger';

jest.mock('../../../src/config', () => ({
  LEADMINER_API_LOG_LEVEL: 'error'
}));

describe('getVerifier', () => {
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

  const googleEmails = ['leadminer-test1@gmail.com'];

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

    it.each(hotmailEmails)(
      'should use Reacher for hotmail.* email %s',
      (email) => {
        const verifier = factory.getVerifier(email);
        expect(verifier).toBeInstanceOf(ReacherEmailStatusVerifier);
      }
    );

    it.each([...googleEmails, ...outlookEmails, ...yahooEmails])(
      'should use MailerCheck for other providers email %s',
      (email) => {
        const verifier = factory.getVerifier(email);
        expect(verifier).toBeInstanceOf(MailerCheckEmailStatusVerifier);
      }
    );
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
      ...googleEmails,
      ...yahooEmails,
      ...outlookEmails,
      ...hotmailEmails
    ])('should use Reacher for all emails providers', (email) => {
      const verifier = factory.getVerifier(email);
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

    const verifier = factory.getVerifier('email@domain.com');

    expect(verifier).toBeInstanceOf(RandomEmailStatusVerifier);
  });
});
