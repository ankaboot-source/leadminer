export interface Details {
  isDisposable?: boolean;
  isRole?: boolean;
  isDisabled?: boolean;
  isCatchAll?: boolean;
  isDeliverable?: boolean;
  hasFullInbox?: boolean;
  isRecentFrom?: boolean;
  hasTimedOut?: boolean;
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
  verify(email: string, abortSignal?: AbortSignal): Promise<EmailStatusResult>;
  verifyMany(
    emails: string[],
    abortSignal?: AbortSignal
  ): Promise<EmailStatusResult[]>;
}
