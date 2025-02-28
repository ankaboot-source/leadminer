import assert from 'assert';
import Redis from 'ioredis';
import { Organization, Person, Tag } from '../../../db/types';
import { undefinedIfEmpty, undefinedIfFalsy } from '../../enrichment/utils';
import { TaggingEngine } from '../../tagging/types';
import { DomainStatusVerificationFunction } from './EmailMessage';

export interface ContactFormat {
  email: string;
  name: string | null;
  given_name: string | null;
  family_name: string | null;
  alternate_name: string | null;
  location: string | null;
  works_for: string | null;
  job_title: string | null;
  same_as: string | null;
  image: string | null;
}
export interface FileFormat {
  fileName: string;
  contacts: ContactFormat[];
}

export interface ExtractedContacts {
  type: 'file';
  organizations: Organization[];
  persons: {
    person: Person;
    tags: Tag[];
  }[];
}

/**
 * Engine for extracting contacts from CSV or XLSX files.
 */
export class CsvXlsxContactEngine {
  constructor(
    private readonly taggingEngine: TaggingEngine,
    private readonly redisClientForNormalMode: Redis,
    private readonly domainStatusVerification: DomainStatusVerificationFunction,
    private readonly contacts: FileFormat
  ) {}

  /**
   * Extracts organization details from the contact data.
   */
  private static extractOrganization(contact: ContactFormat): {
    name: string | undefined;
  } {
    return {
      name: contact.works_for ?? undefined
    };
  }

  /**
   * Extracts person details from the contact data.
   */
  private extractPerson(contact: ContactFormat): Person {
    const {
      email,
      name,
      given_name: givenName,
      family_name: familyName,
      alternate_name: alternateName,
      location,
      job_title: jobTitle,
      same_as: sameAs,
      works_for: worksFor,
      image
    } = contact;

    assert(Boolean(email), '<email> is required');

    return {
      email,
      source: this.contacts.fileName,
      name: undefinedIfFalsy(name ?? ''),
      givenName: undefinedIfFalsy(givenName ?? ''),
      familyName: undefinedIfFalsy(familyName ?? ''),
      jobTitle: undefinedIfFalsy(jobTitle ?? ''),
      image: undefinedIfFalsy(image ?? ''),
      location: undefinedIfEmpty(location?.split(',') ?? []),
      sameAs: undefinedIfEmpty(sameAs?.split(',') ?? []),
      worksFor: undefinedIfFalsy(worksFor ?? ''),
      alternateName: undefinedIfEmpty(alternateName?.split(',') ?? [])
    };
  }

  /**
   * Extracts contacts from the FileFormat data.
   */
  async getContacts(): Promise<ExtractedContacts> {
    const organizations = [
      ...new Set(
        this.contacts.contacts
          .map(
            (details) => CsvXlsxContactEngine.extractOrganization(details).name
          )
          .filter((name): name is string => Boolean(name))
      )
    ].map((name) => ({ name }));

    const persons: {
      person: Person;
      tags: Tag[];
    }[] = [];

    await Promise.allSettled(
      this.contacts.contacts.map(async (details) => {
        const person = this.extractPerson(details);

        const { email } = person;
        const [identifier, domain] = email.split('@');

        const [domainIsValid, domainType] = await this.domainStatusVerification(
          this.redisClientForNormalMode,
          domain.toLowerCase()
        );

        if (domainIsValid) {
          persons.push({
            person,
            tags: this.taggingEngine.getTags({
              email: {
                address: email,
                name: identifier,
                domainType
              }
            })
          });
        }
      })
    );

    return {
      type: 'file',
      persons,
      organizations
    };
  }
}
