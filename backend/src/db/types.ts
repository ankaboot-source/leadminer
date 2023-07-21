export interface Contact {
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
