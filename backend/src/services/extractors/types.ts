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
  date: string | null;
  listId: string | null;
  conversation: boolean;
  references: string[] | null;
}

export interface Person {
  email: string;
  url: string | null;
  name: string | null;
  image: string | null;
  address: string | null;
  jobTitle: string | null;
  sameAs: string[] | null;
  givenName: string | null;
  familyName: string | null;
  identifiers: string[] | null;
  alternateNames: string[] | null;
}

export interface PointOfContact {
  to: boolean;
  cc: boolean;
  bcc: boolean;
  from: boolean;
  body: boolean;
  replyTo: boolean;
  name: string | null;
}

export interface RegexContact {
  domain: string;
  address: string;
  identifier: string;
  name: string | null;
}

export interface ContactLead {
  name: string | null;
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
