import { describe, expect, it, jest } from '@jest/globals';
import EmailStatusVerifierFactory from '../../../src/services/email-status/EmailStatusVerifierFactory';
import MailerCheckEmailStatusVerifier from '../../../src/services/email-status/mailercheck';
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
    'user1@outlook.com',
    'john.doe@hotmail.co.uk',
    'jane_smith@live.fr',
    'test.user@msn.us',
    'example@outlook.in',
    'user@hotmail.co.jp',
    'jane.doe@live.com.au',
    'msnuser@outlook.nl',
    'test.email@live.es',
    'user@msn.com.br',
    'john.doe@hotmail.ru',
    'test.email@live.mx'
  ];

  const yahooEmails = [
    'user1@yahoo.com',
    'jane_smith@yahoo.fr',
    'test.user@yahoo.us',
    'example@yahoo.in'
  ];

  it.each(outlookEmails)(
    'should use MailerCheck for outlook email %s when MailerCheck api key is provided',
    (email) => {
      const sut = new EmailStatusVerifierFactory(
        {
          MAILERCHECK_API_KEY: 'apiKey',
          ...reacherDefaultConfig
        },
        logger
      );

      const verifier = sut.getVerifier(email);

      expect(verifier).toBeInstanceOf(MailerCheckEmailStatusVerifier);
    }
  );

  it.each(yahooEmails)(
    'should use MailerCheck for yahoo email %s when MailerCheck api key is provided',
    (email) => {
      const sut = new EmailStatusVerifierFactory(
        {
          MAILERCHECK_API_KEY: 'apiKey',
          ...reacherDefaultConfig
        },
        logger
      );

      const verifier = sut.getVerifier(email);

      expect(verifier).toBeInstanceOf(MailerCheckEmailStatusVerifier);
    }
  );
});
