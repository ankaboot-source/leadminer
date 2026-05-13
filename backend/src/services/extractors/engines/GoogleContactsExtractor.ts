import {
  ContactFrontend,
  ExtractionResult,
  Person,
  Tag
} from '../../../db/types';
import { REACHABILITY } from '../../../utils/constants';

export interface GoogleContactsFormat {
  resourceName?: string;
  displayName?: string;
  emailAddresses?: Array<{ value?: string }>;
  phoneNumbers?: Array<{ value?: string }>;
  organizations?: Array<{ name?: string; title?: string }>;
  urls?: Array<{ value?: string }>;
}

export class GoogleContactsExtractor {
  constructor(private data: GoogleContactsFormat) {}

  async getContacts(): Promise<ExtractionResult> {
    if (!this.data.resourceName) {
      return {
        type: 'google-contacts',
        persons: [],
        organizations: []
      };
    }

    const contactFrontend: ContactFrontend = {
      id: this.data.resourceName || '',
      user_id: '',
      email: this.data.emailAddresses?.[0]?.value || '',
      name: this.data.displayName || '',
      telephone: (this.data.phoneNumbers
        ?.map((p) => p.value)
        .filter((v): v is string => v != null) || []) as string[],
      same_as: (this.data.urls
        ?.map((u) => u.value)
        .filter((v): v is string => v != null) || []) as string[],
      job_title: this.data.organizations?.[0]?.title || '',
      works_for: this.data.organizations?.[0]?.name || ''
    };

    const person: Person = {
      email: contactFrontend.email,
      name: contactFrontend.name,
      jobTitle: contactFrontend.job_title,
      sameAs: contactFrontend.same_as,
      telephone: contactFrontend.telephone,
      worksFor: contactFrontend.works_for,
      source: 'google-contacts'
    };

    const tags: Tag[] = [
      {
        name: 'contact',
        reachable: REACHABILITY.DIRECT_PERSON,
        source: 'google-contacts'
      }
    ];

    return {
      type: 'google-contacts',
      persons: [{ person, tags }],
      organizations: []
    };
  }
}
