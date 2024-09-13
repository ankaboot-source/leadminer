import {
  EmailStatusResult,
  Status
} from '../../services/email-status/EmailStatusVerifier';
import { Contact, ExtractionResult } from '../types';

export interface Contacts {
  create(contact: ExtractionResult, userId: string): Promise<string[]>;
  refine(userId: string): Promise<boolean>;
  updateSinglePersonStatus(
    personEmail: string,
    userId: string,
    status: EmailStatusResult
  ): Promise<boolean>;
  updateManyPersonsStatus(
    userId: string,
    emailStatus: { status: Status; email: string }[]
  ): Promise<boolean>;
  getUnverifiedEmails(userId: string): Promise<string[]>;
  getContacts(userId: string, emails?: string[]): Promise<Contact[]>;
  getExportedContacts(userId: string, emails?: string[]): Promise<Contact[]>;
  getNonExportedContacts(userId: string, emails?: string[]): Promise<Contact[]>;
  registerExportedContacts(contactIds: string[], userId: string): Promise<void>;
}
