import Redis from 'ioredis';
import {
  ContactFrontend,
  ExtractionResult,
  Person,
  Tag
} from '../../../db/types';
import { REACHABILITY } from '../../../utils/constants';
import { TaggingEngine } from '../../tagging/types';
import { DomainStatusVerificationFunction } from './EmailMessage';

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
    private userEmail: string,
    private readonly taggingEngine: TaggingEngine,
    private readonly redisClient: Redis,
    private readonly domainStatusVerification: DomainStatusVerificationFunction
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

    // Tag using the tagging engine with just email address info (no headers)
    let tags: Tag[] = [];

    const domain = contactFrontend.email?.split('@')[1];
    if (domain) {
      try {
        const [, domainType] = await this.domainStatusVerification(
          this.redisClient,
          domain
        );

        const engineTags = this.taggingEngine.getTags({
          header: {},
          email: { address: contactFrontend.email, name: '', domainType },
          field: undefined
        });

        tags = engineTags.map((tag) => ({
          name: tag.name,
          reachable: tag.reachable,
          source: 'google_contacts#email_address'
        }));
      } catch {
        // Leave tags empty if domain verification or tagging fails
      }
    }

    if (tags.length === 0) {
      if (contactFrontend.email) {
        tags = [
          {
            name: 'newsletter',
            reachable: REACHABILITY.NONE,
            source: 'google_contacts#email_address'
          }
        ];
      } else {
        tags = [
          {
            name: 'personal',
            reachable: REACHABILITY.NONE,
            source: 'google_contacts#phone_number'
          }
        ];
      }
    }

    const orgName = this.data.organizations?.[0]?.name;
    return {
      type: 'google-contacts',
      persons: [{ person, tags }],
      organizations: orgName ? [{ name: orgName }] : []
    };
  }
}
