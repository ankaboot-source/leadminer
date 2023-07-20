export interface Contact {
  message: Message;
  persons: PersonWithPocAndTag[];
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

export interface PersonWithPocAndTag {
  person: Person;
  pointOfContact: PointOfContact;
  tags: Tag[];
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
  name: string | null;
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
