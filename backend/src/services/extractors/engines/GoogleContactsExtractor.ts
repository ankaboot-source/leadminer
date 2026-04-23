import {
  ContactFrontend,
  ExtractionResult,
  Person,
  Tag
} from '../../../db/types';
import { REACHABILITY } from '../../../utils/constants';

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
    const persons = this.data.contacts.map((contactData) => {
      const p = contactData.person;
      const person: Person = {
        email: p.email,
        status: p.status,
        name: p.name,
        image: p.image,
        location: p.location,
        jobTitle: p.job_title,
        sameAs: p.same_as,
        givenName: p.given_name,
        familyName: p.family_name,
        alternateName: p.alternate_name,
        alternateEmail: p.alternate_email,
        worksFor: p.works_for,
        telephone: p.telephone,
        source: this.data.source
      };

      const tags: Tag[] = (contactData.tags || []).map((tag) => ({
        name: tag,
        reachable: REACHABILITY.UNSURE,
        source: this.data.source
      }));

      return {
        person,
        tags
      };
    });

    return {
      type: 'google-contacts',
      persons,
      organizations: []
    };
  }
}
