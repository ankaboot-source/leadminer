import { Details, Status } from '../services/email-status/EmailStatusVerifier';
import {
  TaskCategory,
  TaskStatus,
  TaskType
} from '../services/tasks-manager/types';

export interface ExtractionResult {
  message: Message;
  persons: PersonWithPocAndTag[];
}

export interface Message {
  channel: string;
  messageId: string;
  folderPath: string;
  date?: string;
  listId?: string;
  conversation: boolean;
  references?: string[];
}

export interface PersonWithPocAndTag {
  person: Person;
  pointOfContact: PointOfContact;
  tags: Tag[];
}

export interface Person {
  email: string;
  status?: Status;
  verificationDetails?: Details;
  url?: string;
  name?: string;
  image?: string;
  address?: string;
  jobTitle?: string;
  sameAs?: string[];
  givenName?: string;
  familyName?: string;
  identifiers?: string[];
  alternateNames?: string[];
}

export interface PointOfContact {
  name?: string;
  to: boolean;
  cc: boolean;
  bcc: boolean;
  body: boolean;
  from: boolean;
  replyTo: boolean;
}

export interface Tag {
  name: string;
  reachable: number;
  source: string;
}

export type EmailStatus = 'UNKNOWN' | 'RISKY' | 'VALID' | 'INVALID';

export interface Contact {
  id: string;
  userid: string;
  email: string;
  engagement?: number;
  name?: string;
  sender?: string;
  recipient?: string;
  conversations?: number;
  replied_conversations?: number;
  status?: EmailStatus;
  occurrence?: number;
  personid?: string;
  recency?: Date;
  seniority?: Date;
  alternate_names?: string[];
  tags?: Tag[];
}

export interface Profile {
  email: string;
  name: string;
  credits: number;
  stripe_customer_id: string;
}
export interface SupabaseTask {
  id?: string;
  user_id: string;
  type: TaskType;
  category: TaskCategory;
  status: TaskStatus;
  // skipcq: JS-0323 - details can contain any values
  details: Record<string, any>;
  started_at?: string;
  stopped_at?: string;
  duration?: number;
}
