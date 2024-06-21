import { describe, expect, it, jest } from '@jest/globals';
import EmailStatusVerifierFactory from '../../../src/services/email-status/EmailStatusVerifierFactory';
import MailerCheckEmailStatusVerifier from '../../../src/services/email-status/mailercheck';
import RandomEmailStatusVerifier from '../../../src/services/email-status/random';
import ReacherEmailStatusVerifier from '../../../src/services/email-status/reacher';
import logger from '../../../src/utils/logger';
import ZerobounceEmailStatusVerifier from '../../../src/services/email-status/zerobounce';

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

describe('EmailStatusVerifierFactory() with load balancing disabled', () => {
  const defaultConf = {
    LOAD_BALANCE_VERIFIERS: false,
    ...reacherDefaultConfig
  };

  describe('getEmailVerifier', () => {
    it.each([
      ...mailercheckOnly,
      ...hotmailEmails,
      ...googleEmails,
      ...outlookEmails,
      ...yahooEmails
    ])(
      'Reacher & Mailercheck & Zerobounce configured: Use Zerobounce for all listed providers email %s',
      (email) => {
        const verifier = new EmailStatusVerifierFactory(
          {
            ...defaultConf,
            ZEROBOUNCE_API_KEY: 'sandbox',
            MAILERCHECK_API_KEY: 'apiKey',
            REACHER_API_KEY: 'apiKey'
          },
          logger
        ).getEmailVerifier(email);
        expect(verifier).toBeInstanceOf(ZerobounceEmailStatusVerifier);
      }
    );

    it.each([
      ...mailercheckOnly,
      ...hotmailEmails,
      ...googleEmails,
      ...outlookEmails,
      ...yahooEmails
    ])(
      'Reacher & Mailercheck configured: Use Mailercheck for all listed providers email %s',
      (email) => {
        const verifier = new EmailStatusVerifierFactory(
          {
            ...defaultConf,
            MAILERCHECK_API_KEY: 'apiKey',
            REACHER_API_KEY: 'apiKey'
          },
          logger
        ).getEmailVerifier(email);
        expect(verifier).toBeInstanceOf(MailerCheckEmailStatusVerifier);
      }
    );

    it.each([
      ...mailercheckOnly,
      ...hotmailEmails,
      ...googleEmails,
      ...outlookEmails,
      ...yahooEmails
    ])(
      'Reacher & Zerobounce configured: Use Zerobounce for all listed providers email %s',
      (email) => {
        const verifier = new EmailStatusVerifierFactory(
          {
            ...defaultConf,
            ZEROBOUNCE_API_KEY: 'sandbox',
            REACHER_API_KEY: 'apiKey'
          },
          logger
        ).getEmailVerifier(email);
        expect(verifier).toBeInstanceOf(ZerobounceEmailStatusVerifier);
      }
    );

    it.each([
      ...mailercheckOnly,
      ...googleEmails,
      ...yahooEmails,
      ...outlookEmails,
      ...hotmailEmails
    ])('Reacher configured: Use Reacher for all emails providers', (email) => {
      const verifier = new EmailStatusVerifierFactory(
        {
          ...defaultConf,
          REACHER_API_KEY: 'apiKey'
        },
        logger
      ).getEmailVerifier(email);
      expect(verifier).toBeInstanceOf(ReacherEmailStatusVerifier);
    });

    it('Reacher, MailerCheck, ZeroBounce are not provided: Fallback to random ', () => {
      const factory = new EmailStatusVerifierFactory(
        {
          LOAD_BALANCE_VERIFIERS: false,
          ...reacherDefaultConfig
        },
        logger
      );

      const verifier = factory.getEmailVerifier('email@domain.com');
      expect(verifier).toBeInstanceOf(RandomEmailStatusVerifier);
    });
  });

  describe('getEmailVerifiers', () => {
    it('Reacher && Mailercheck && Zerobounce configured: categorize emails correctly and use appropriate verifiers', () => {
      const result = new EmailStatusVerifierFactory(
        {
          ...defaultConf,
          MAILERCHECK_API_KEY: 'apiKey',
          ZEROBOUNCE_API_KEY: 'apiKey',
          REACHER_API_KEY: 'apiKey'
        },
        logger
      ).getEmailVerifiers(emails);

      expect(result.has('random')).toBeFalsy();
      expect(result.has('reacher')).toBeFalsy();
      expect(result.has('mailercheck')).toBeFalsy();
      expect(result.get('zerobounce')).toEqual([
        expect.any(ZerobounceEmailStatusVerifier),
        [
          ...mailercheckOnly,
          ...hotmailEmails,
          ...googleEmails,
          ...outlookEmails,
          ...yahooEmails
        ]
      ]);
    });

    it('Reacher && Mailercheck configured: categorize emails correctly and use appropriate verifiers', () => {
      const result = new EmailStatusVerifierFactory(
        {
          ...defaultConf,
          MAILERCHECK_API_KEY: 'apiKey',
          REACHER_API_KEY: 'apiKey'
        },
        logger
      ).getEmailVerifiers(emails);

      expect(result.has('random')).toBeFalsy();
      expect(result.has('reacher')).toBeFalsy();
      expect(result.has('zerobounce')).toBeFalsy();
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

    it('Reacher configured: categorize emails correctly and use appropriate verifiers', () => {
      const result = new EmailStatusVerifierFactory(
        {
          ...defaultConf,
          REACHER_API_KEY: 'apiKey'
        },
        logger
      ).getEmailVerifiers(emails);

      expect(result.has('random')).toBeFalsy();
      expect(result.has('mailercheck')).toBeFalsy();
      expect(result.has('zerobounce')).toBeFalsy();
      expect(result.get('reacher')).toEqual([
        expect.any(ReacherEmailStatusVerifier),
        [
          ...mailercheckOnly,
          ...hotmailEmails,
          ...googleEmails,
          ...outlookEmails,
          ...yahooEmails
        ]
      ]);
    });

    it('Mailercheck && Zerobounce configured: categorize emails correctly and use appropriate verifiers', () => {
      const result = new EmailStatusVerifierFactory(
        {
          ...defaultConf,
          MAILERCHECK_API_KEY: 'apiKey',
          ZEROBOUNCE_API_KEY: 'apiKey'
        },
        logger
      ).getEmailVerifiers(emails);

      expect(result.has('random')).toBeFalsy();
      expect(result.has('reacher')).toBeFalsy();
      expect(result.has('mailercheck')).toBeFalsy();
      expect(result.get('zerobounce')).toEqual([
        expect.any(ZerobounceEmailStatusVerifier),
        [
          ...mailercheckOnly,
          ...hotmailEmails,
          ...googleEmails,
          ...outlookEmails,
          ...yahooEmails
        ]
      ]);
    });

    it('No provider configured: Use Random verifier', () => {
      const factoryWithoutOtherVerifiers = new EmailStatusVerifierFactory(
        {
          LOAD_BALANCE_VERIFIERS: false,
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
});

describe('EmailStatusVerifierFactory() with load balancing enabled', () => {
  const defaultConf = {
    LOAD_BALANCE_VERIFIERS: true,
    ...reacherDefaultConfig
  };

  describe('getEmailVerifier', () => {
    it('Mailercheck & Zerobounce configured: load balance between verifiers', () => {
      const factory = new EmailStatusVerifierFactory(
        {
          ...defaultConf,
          ZEROBOUNCE_API_KEY: 'sandbox',
          MAILERCHECK_API_KEY: 'apiKey',
          REACHER_API_KEY: 'apiKey'
        },
        logger
      );

      const verifier1 = factory.getEmailVerifier('test@gmail.com');
      const verifier2 = factory.getEmailVerifier('test@gmail.com');
      expect(verifier1.constructor.name).not.toEqual(
        verifier2.constructor.name
      );
    });

    it('Zerobounce configured: use zerobounce', () => {
      const factory = new EmailStatusVerifierFactory(
        {
          ...defaultConf,
          ZEROBOUNCE_API_KEY: 'sandbox',
          REACHER_API_KEY: 'apiKey'
        },
        logger
      );

      const verifier1 = factory.getEmailVerifier('test@gmail.com');
      const verifier2 = factory.getEmailVerifier('test@gmail.com');

      expect(verifier1).toBeInstanceOf(ZerobounceEmailStatusVerifier);
      expect(verifier2).toBeInstanceOf(ZerobounceEmailStatusVerifier);
    });

    it('Mailercheck configured: use zerobounce', () => {
      const factory = new EmailStatusVerifierFactory(
        {
          ...defaultConf,
          MAILERCHECK_API_KEY: 'sandbox',
          REACHER_API_KEY: 'apiKey'
        },
        logger
      );

      const verifier1 = factory.getEmailVerifier('test@gmail.com');
      const verifier2 = factory.getEmailVerifier('test@gmail.com');

      expect(verifier1).toBeInstanceOf(MailerCheckEmailStatusVerifier);
      expect(verifier2).toBeInstanceOf(MailerCheckEmailStatusVerifier);
    });

    it('Reacher configured: use zerobounce', () => {
      const factory = new EmailStatusVerifierFactory(
        {
          ...defaultConf,
          REACHER_API_KEY: 'apiKey'
        },
        logger
      );

      const verifier1 = factory.getEmailVerifier('test@gmail.com');
      const verifier2 = factory.getEmailVerifier('test@gmail.com');

      expect(verifier1).toBeInstanceOf(ReacherEmailStatusVerifier);
      expect(verifier2).toBeInstanceOf(ReacherEmailStatusVerifier);
    });
  });

  describe('getEmailVerifiers', () => {
    it('Mailercheck & Zerobounce configured: load balance between verifiers', () => {
      const factory = new EmailStatusVerifierFactory(
        {
          ...defaultConf,
          ZEROBOUNCE_API_KEY: 'sandbox',
          MAILERCHECK_API_KEY: 'apiKey',
          REACHER_API_KEY: 'apiKey'
        },
        logger
      );

      const verifier1 = factory.getEmailVerifiers(['test@gmail.com']);
      const verifier2 = factory.getEmailVerifiers(['test@gmail.com']);

      expect(Array.from(verifier1.keys())[0]).not.toEqual(
        Array.from(verifier2.keys())[0]
      );
    });

    it('Zerobounce configured: Use zerobounce', () => {
      const factory = new EmailStatusVerifierFactory(
        {
          ...defaultConf,
          ZEROBOUNCE_API_KEY: 'sandbox',
          REACHER_API_KEY: 'apiKey'
        },
        logger
      );

      const verifier1 = factory.getEmailVerifiers(['test@gmail.com']);
      const verifier2 = factory.getEmailVerifiers(['test@gmail.com']);

      expect(verifier1.has('zerobounce')).toBeTruthy();
      expect(verifier2.has('zerobounce')).toBeTruthy();
    });

    it('Mailercheck configured: Use Mailercheck', () => {
      const factory = new EmailStatusVerifierFactory(
        {
          ...defaultConf,
          MAILERCHECK_API_KEY: 'apiKey',
          REACHER_API_KEY: 'apiKey'
        },
        logger
      );

      const verifier1 = factory.getEmailVerifiers(['test@gmail.com']);
      const verifier2 = factory.getEmailVerifiers(['test@gmail.com']);

      expect(verifier1.has('mailercheck')).toBeTruthy();
      expect(verifier2.has('mailercheck')).toBeTruthy();
    });

    it('Reacher configured: Use reacher for all', () => {
      const factory = new EmailStatusVerifierFactory(
        {
          ...defaultConf,
          REACHER_API_KEY: 'apiKey'
        },
        logger
      );

      const verifier1 = factory.getEmailVerifiers(['test@gmail.com']);
      const verifier2 = factory.getEmailVerifiers(['test@gmail.com']);

      expect(verifier1.has('reacher')).toBeTruthy();
      expect(verifier2.has('reacher')).toBeTruthy();
    });
  });
});
