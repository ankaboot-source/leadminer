import Redis from 'ioredis';
import { REACHABILITY } from '../../utils/constants';
import { Details, Status } from '../email-status/EmailStatusVerifier';

export const IGNORED_MESSAGE_TAGS: ReadonlyArray<string> = [
  'transactional',
  'no-reply'
] as const;

export const MESSAGING_FIELDS = [
  'to',
  'from',
  'cc',
  'bcc',
  'reply-to',
  'reply_to',
  'list-post'
] as const;

export type MessageField = typeof MESSAGING_FIELDS[number];

export interface EmailSendersRecipients {
  to: MessageField;
  from: MessageField;
  cc: MessageField;
  bcc: MessageField;
  'reply-to'?: MessageField;
  reply_to?: MessageField;
  'list-post'?: MessageField;
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

export interface Person {
  email: string;
  status?: Status;
  verificationDetails?: Details;
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
  to: boolean;
  cc: boolean;
  bcc: boolean;
  from: boolean;
  body: boolean;
  replyTo: boolean;
  name?: string;
}

export interface RegexContact {
  domain: string;
  address: string;
  identifier: string;
  name?: string;
}

export interface ContactLead {
  name?: string;
  email: {
    address: string;
    identifier: string;
    domain: string;
    domainType?: string;
  };
  sourceField: MessageField | 'body';
  source: 'header' | 'body';
}

export interface ContactTag {
  name: string;
  reachable: REACHABILITY;
  source: string;
}

export interface Contact {
  message: Message;
  persons: {
    person: Person;
    pointOfContact: PointOfContact;
    tags: ContactTag[];
  }[];
}

export type DomainStatusVerificationFunction = (
  redisClient: Redis,
  domain: string
) => Promise<
  [boolean, 'provider' | 'disposable' | 'custom' | 'invalid', string]
>;
