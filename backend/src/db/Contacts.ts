import { Status } from '../services/email-status/EmailStatusVerifier';
import { ExtractionResult } from './types';

export interface Contacts {
  create(contact: ExtractionResult, userId: string): Promise<void>;
  refine(userId: string): Promise<boolean>;
  updatePersonStatus(
    personEmail: string,
    userId: string,
    status: Status
  ): Promise<boolean>;
}
