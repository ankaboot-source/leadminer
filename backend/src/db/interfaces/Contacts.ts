import { Status } from '../../services/email-status/EmailStatusVerifier';
import { Contact, EmailStatus, ExtractionResult, Tag } from '../types';

export interface Contacts {
  create(
    contact: ExtractionResult,
    userId: string,
    miningId: string
  ): Promise<{ email: string; tags: Tag[] }[]>;
  refine(userId: string): Promise<boolean>;
  SelectRecentEmailStatus(email: string): Promise<EmailStatus | null>;
  upsertEmailStatus(status: EmailStatus): Promise<boolean>;
  updateManyPersonsStatus(
    userId: string,
    emailStatus: { status: Status; email: string }[]
  ): Promise<boolean>;
  getContacts(userId: string, emails?: string[]): Promise<Contact[]>;
  getUnverifiedContacts(userId: string, emails: string[]): Promise<Contact[]>;
  getExportedContacts(userId: string, emails?: string[]): Promise<Contact[]>;
  getNonExportedContacts(userId: string, emails?: string[]): Promise<Contact[]>;
  registerExportedContacts(contactIds: string[], userId: string): Promise<void>;
}
