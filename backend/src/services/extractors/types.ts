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
  folderPath: string;
  date: string;
  messageId: string;
  references: string[];
  listId: string;
  conversation: boolean;
}

export interface Person {
  name: string;
  email: string;
  url: string;
  image: string;
  address: string;
  alternateNames: string[];
  sameAs: string[];
  givenName: string;
  familyName: string;
  jobTitle: string;
  identifiers: string[];
}

export interface PointOfContact {
  name: string;
  from: boolean;
  replyTo: boolean;
  to: boolean;
  cc: boolean;
  bcc: boolean;
  body: boolean;
}

export interface RegexContact {
  name: string;
  address: string;
  identifier: string;
  domain: string;
}

export interface ContactLead {
  name: string;
  email: {
    address: string;
    identifier: string;
    domain: string;
    domainType?: string;
  };
  sourceField: MessageField | 'body';
  source: 'header' | 'body';
}

export interface MessageDetails {
  references: string[];
  channel: string;
  date: string | null;
  listId: string;
  folderPath: string;
  messageId: string;
  conversation: boolean;
}

export interface ContactTag {
  name: string;
  reachable: number;
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
