export type EmailVerifierType =
  | 'random'
  | 'email-message-class'
  | 'mailercheck'
  | 'reacher'
  | 'zerobounce';

export interface Details {
  status?: string;
  sub_status?: string;
  isDisposable?: boolean;
  isRole?: boolean;
  isDisabled?: boolean;
  isCatchAll?: boolean;
  isDeliverable?: boolean;
  hasFullInbox?: boolean;
  isRecentFrom?: boolean;
  hasTimedOut?: boolean;
  hasPastDeliveryIssues?: boolean;
  isBlocked?: boolean;
  isNotFound?: boolean;
  source?: EmailVerifierType;
}

export enum Status {
  VALID = 'VALID',
  RISKY = 'RISKY',
  INVALID = 'INVALID',
  UNKNOWN = 'UNKNOWN'
}

export interface EmailStatusResult {
  email: string;
  status: Status;
  details?: Details;
}

export interface EmailStatusVerifier {
  emailsQuota: number;

  verify(email: string): Promise<EmailStatusResult>;
  verifyMany(emails: string[]): Promise<EmailStatusResult[]>;
  isEligibleEmail(email: string): boolean;
}
