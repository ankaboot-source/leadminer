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
  givenName?: string;
  familyName?: string;
  emailAddresses?: Array<{ value?: string }>;
  phoneNumbers?: Array<{ value?: string }>;
  organizations?: Array<{ name?: string; title?: string }>;
  urls?: Array<{ value?: string }>;
  addresses?: Array<{ formattedValue?: string }>;
}

export class GoogleContactsExtractor {
  constructor(
    private data: GoogleContactsFormat,
    private userEmail: string
  ) {}

  // skipcq: JS-0116 - Must remain async to satisfy ExtractionResult interface
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
      location: this.data.addresses?.[0]?.formattedValue || '',
      job_title: this.data.organizations?.[0]?.title || '',
      works_for: this.data.organizations?.[0]?.name || ''
    };

    const alternateEmail =
      this.data.emailAddresses
        ?.slice(1)
        .map((e) => e.value)
        .filter((v): v is string => v != null) || [];

    const person: Person = {
      email: contactFrontend.email,
      name: contactFrontend.name,
      givenName: this.data.givenName,
      familyName: this.data.familyName,
      jobTitle: contactFrontend.job_title,
      sameAs: contactFrontend.same_as,
      telephone: contactFrontend.telephone,
      worksFor: contactFrontend.works_for,
      location: contactFrontend.location,
      alternateEmail: alternateEmail.length > 0 ? alternateEmail : undefined,
      source: `google-contacts:${this.userEmail}`
    };

    const tags: Tag[] = [
      {
        name: 'contact',
        reachable: REACHABILITY.DIRECT_PERSON,
        source: `google-contacts:${this.userEmail}`
      }
    ];

    const orgName = this.data.organizations?.[0]?.name;
    return {
      type: 'google-contacts',
      persons: [{ person, tags }],
      organizations: orgName ? [{ name: orgName }] : []
    };
  }
}
