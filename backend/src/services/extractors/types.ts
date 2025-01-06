import Redis from 'ioredis';
import { Message, Person, PointOfContact } from '../../db/types';
import { REACHABILITY } from '../../utils/constants';

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

export type MessageField = (typeof MESSAGING_FIELDS)[number];

export interface EmailSendersRecipients {
  to: MessageField;
  from: MessageField;
  cc: MessageField;
  bcc: MessageField;
  'reply-to'?: MessageField;
  reply_to?: MessageField;
  'list-post'?: MessageField;
}

export interface RegexContact {
  domain: string;
  address: string;
  plusAddress?: string;
  identifier: string;
  name?: string;
}

export interface ContactLead {
  name?: string;
  email: {
    address: string;
    plusAddress?: string;
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
