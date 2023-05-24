import { Contact } from './types';

export interface Contacts {
  create(contact: Contact, userId: string): Promise<void>;
  refine(userId: string): Promise<boolean>;
  populate(userId: string): Promise<boolean>;
}
