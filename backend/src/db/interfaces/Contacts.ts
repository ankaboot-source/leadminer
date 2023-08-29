import { Status } from '../../services/email-status/EmailStatusVerifier';
import { Contact, ExtractionResult } from '../types';

export interface Contacts {
  create(contact: ExtractionResult, userId: string): Promise<void>;
  refine(userId: string): Promise<boolean>;
  updateSinglePersonStatus(
    personEmail: string,
    userId: string,
    status: Status
  ): Promise<boolean>;
  updateManyPersonsStatus(
    userId: string,
    emailStatus: { status: Status; email: string }[]
  ): Promise<boolean>;
  getContacts(userId: string): Promise<Contact[]>;
  getUnverifiedEmails(userId: string): Promise<string[]>;
  getExportedContacts(userId: string): Promise<Contact[]>;
  getNonExportedContacts(userId: string): Promise<Contact[]>;
  registerExportedContacts(contactIds: string[], userId: string): Promise<void>;
}
