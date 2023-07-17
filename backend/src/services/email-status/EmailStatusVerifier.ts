export interface Details {
  isDisposable?: boolean;
  isRole?: boolean;
  isDisabled?: boolean;
  isCatchAll?: boolean;
  isDeliverable?: boolean;
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
  verify(email: string): Promise<EmailStatusResult>;
  verifyMany(emails: string[]): Promise<EmailStatusResult[]>;
}
