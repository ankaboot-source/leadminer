import { Details, Status } from '../services/email-status/EmailStatusVerifier';

import { REACHABILITY } from '../utils/constants';

export interface EmailExtractionResult {
  type: 'email';
  message: Message;
  persons: Array<{
    person: Person;
    pointOfContact: PointOfContact;
    tags: Tag[];
  }>;
}

export interface FileExtractionResult {
  type: 'file';
  organizations: Organization[];
  persons: Array<{
    person: Person;
    tags: Tag[];
  }>;
}

export type ExtractionResult = EmailExtractionResult | FileExtractionResult;

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

export interface EmailStatus {
  email: string;
  userId: string;
  status: Status;
  verifiedOn: string;
  details?: Details;
  createdAt?: string;
  updatedAt?: string;
}

export interface Person {
  email: string;
  status?: Status;
  url?: string;
  name?: string;
  image?: string;
  location?: string[];
  jobTitle?: string;
  sameAs?: string[];
  givenName?: string;
  familyName?: string;
  identifiers?: string[];
  alternateName?: string[];
  alternateEmail?: string[];
  worksFor?: string;
  source: string;
}

export interface PointOfContact {
  name?: string;
  plusAddress?: string;
  to: boolean;
  cc: boolean;
  bcc: boolean;
  body: boolean;
  from: boolean;
  replyTo: boolean;
}

export interface Tag {
  name: string;
  reachable: REACHABILITY;
  source: string;
}

export interface Contact {
  id: string;
  user_id: string;
  email: string;
  engagement?: number;
  name?: string;
  sender?: string;
  recipient?: string;
  conversations?: number;
  replied_conversations?: number;
  status?: Status;
  occurrence?: number;
  personid?: string;
  recency?: Date;
  seniority?: Date;
  tags?: Tag[];
  given_name?: string;
  family_name?: string;
  alternate_name?: string[];
  location?: string[];
  works_for?: string;
  job_title?: string;
  same_as?: string[];
  image?: string;
  phone_numbers?: string[];
}

export interface Profile {
  email: string;
  name: string;
  credits: number;
  stripe_customer_id: string;
}
export enum TaskType {
  Fetch = 'fetch',
  Extract = 'extract',
  Clean = 'clean',
  Enrich = 'enrich'
}

export enum TaskCategory {
  Mining = 'mining',
  Enriching = 'enriching',
  Cleaning = 'cleaning'
}

export enum TaskStatus {
  Running = 'running',
  Canceled = 'canceled',
  Done = 'done'
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

export type Organization = {
  name: string;
  alternate_name?: string;
  location?: string[];
  id?: string;
  url?: string;
  legal_name?: string;
  telephone?: string;
  email?: string;
  image?: string;
  founder?: string;
  _domain?: string;
};
