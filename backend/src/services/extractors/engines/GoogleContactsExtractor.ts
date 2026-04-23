import { ContactFrontend, ExtractionResult } from '../../../db/types';

export interface GoogleContactsFormat {
  source: string;
  contacts: Array<{
    person: ContactFrontend;
    tags: string[];
  }>;
}

export class GoogleContactsExtractor {
  constructor(private data: GoogleContactsFormat) {}

  async getContacts(): Promise<ExtractionResult> {
    return {
      type: 'google-contacts',
      persons: this.data.contacts as any,
      organizations: []
    };
  }
}
