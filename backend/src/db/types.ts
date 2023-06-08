import { ProviderName } from '../services/auth/Provider';

export interface Contact {
  message: Message;
  persons: PersonWithPocAndTag[];
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

export interface PersonWithPocAndTag {
  person: Person;
  pointOfContact: PointOfContact;
  tags: Tag[];
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

export interface Tag {
  name: string;
  reachable: number;
  source: string;
}

export interface OAuthSigninOptions {
  provider: ProviderName;
  options: {
    scopes?: string;
    redirectTo?: string;
    queryParams?: {};
  };
}

interface AuthUser {
  id: string | undefined;
  email: string | undefined;
  role: string | undefined;
}

interface AuthError extends Error {
  status?: number | undefined;
}

export type AuthResopnse = {
  url?: string | null;
  user?: AuthUser | null;
  error?: AuthError | null;
};
