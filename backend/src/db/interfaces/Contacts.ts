import { Status } from '../../services/email-status/EmailStatusVerifier';
import {
  Contact,
  ContactFrontend,
  EmailStatus,
  ExportService,
  ExtractionResult,
  Tag
} from '../types';

export interface Contacts {
  create(
    contact: ExtractionResult,
    userId: string,
    miningId: string
  ): Promise<{ id?: string; email?: string; tags: Tag[] }[]>;
  refine(userId: string): Promise<boolean>;
  SelectRecentEmailStatus(email: string): Promise<EmailStatus | null>;
  upsertEmailStatus(status: EmailStatus): Promise<boolean>;
  getPersonIdByEmail(
    email: string,
    userId: string
  ): Promise<string | null>;
  updateManyPersonsStatus(
    userId: string,
    statusUpdates: { status: Status; id: string }[]
  ): Promise<boolean>;
  getContacts(userId: string, ids?: string[]): Promise<Contact[]>;
  getUnverifiedContacts(userId: string, ids: string[]): Promise<Contact[]>;
  getExportedContacts(userId: string, ids?: string[]): Promise<Contact[]>;
  getNonExportedContacts(userId: string, ids?: string[]): Promise<Contact[]>;
  registerExportedContacts(
    personIds: string[],
    exportService: ExportService,
    userId: string
  ): Promise<void>;
  upsertGoogleContacts(
    contacts: Array<{ person: ContactFrontend; tags: string[] }>,
    userId: string,
    source: string,
    miningId: string
  ): Promise<number>;
}
