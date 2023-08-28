import { Logger } from 'winston';
import { EmailStatusVerifier } from './EmailStatusVerifier';
import RandomEmailStatusVerifier from './RandomEmailStatusVerifier';
import ReacherEmailStatusVerifier from './reacher';
import ReacherClient from './reacher/client';

const EmailStatusVerifierFactory = {
  create(
    config: {
      NODE_ENV: 'development' | 'production' | 'test';
      REACHER_HOST: string;
      REACHER_API_KEY?: string;
      REACHER_HEADER_SECRET?: string;
    },
    logger: Logger
  ): EmailStatusVerifier {
    if (config.NODE_ENV === 'development') {
      return new RandomEmailStatusVerifier();
    }

    const reacherClient = new ReacherClient(logger, {
      host: config.REACHER_HOST,
      apiKey: config.REACHER_API_KEY,
      headerSecret: config.REACHER_HEADER_SECRET
    });

    return new ReacherEmailStatusVerifier(reacherClient, logger);
  }
};

export default EmailStatusVerifierFactory;
