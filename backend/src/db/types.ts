import { Details, Status } from '../services/email-status/EmailStatusVerifier';
import {
  TaskCategory,
  TaskStatus,
  TaskType
} from '../services/tasks-manager/types';
import { REACHABILITY } from '../utils/constants';

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
  alternateNames?: string[];
  source: string;
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
  status: Status;
  occurrence?: number;
  personid?: string;
  recency?: Date;
  seniority?: Date;
  tags?: Tag[];
  given_name?: string;
  family_name?: string;
  alternate_names?: string[];
  location?: string[];
  works_for?: string;
  job_title?: string;
  same_as?: string[];
  image?: string;
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
