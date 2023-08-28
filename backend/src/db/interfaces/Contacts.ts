import { Status } from '../../services/email-status/EmailStatusVerifier';
import { Contact, ExtractionResult } from '../types';

export interface Contacts {
  create(contact: ExtractionResult, userId: string): Promise<void>;
  refine(userId: string): Promise<boolean>;
  updatePersonStatus(
    personEmail: string,
    userId: string,
    status: Status
  ): Promise<boolean>;
  getContacts(userId: string, execludeExported?: boolean): Promise<Contact[]>;
  getExportedContacts(userId: string): Promise<Contact[]>;
  getNonExportedContacts(userId: string): Promise<Contact[]>;
  registerExportedContacts(contactIds: string[], userId: string): Promise<void>;
}
