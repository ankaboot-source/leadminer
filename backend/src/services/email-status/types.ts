export interface EmailVerificationJobData {
  userId: string;
  email: string;
}

export type EmailVerifierType = 'random' | 'mailercheck' | 'reacher';
