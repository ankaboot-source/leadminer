import { EmailStatusResult } from '../email-status/EmailStatusVerifier';

export default interface EmailStatusCache {
  get(email: string): Promise<EmailStatusResult | null>;
  set(email: string, status: EmailStatusResult): Promise<void>;
  setMany(inputs: EmailStatusResult[]): Promise<void>;
}
