import { Status } from '../email-status/EmailStatusVerifier';

export default interface EmailStatusCache {
  get(email: string): Promise<Status | null>;
  set(email: string, status: Status): Promise<void>;
  setMany(inputs: { email: string; status: Status }[]): Promise<void>;
}
