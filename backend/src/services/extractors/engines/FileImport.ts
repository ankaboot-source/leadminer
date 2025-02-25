import assert from 'assert';
import { Person } from '../../../db/types';
import { undefinedIfEmpty, undefinedIfFalsy } from '../../enrichment/utils';

export interface FileFormat {
  email: string;
  name: string | null;
  given_name: string | null;
  family_name: string | null;
  alternate_name: string[] | null;
  location: string[] | null;
  works_for: string | null;
  job_title: string | null;
  same_as: string[] | null;
  image: string | null;
}

export interface ExtractedContacts {
  organizations: { name: string | undefined }[];
  persons: Person[];
}

/**
 * Engine for extracting contacts from CSV or XLSX files.
 */
export class CsvXlsxContactEngine {
  constructor(
    private readonly userId: string,
    private readonly userEmail: string,
    private readonly contacts: unknown[]
  ) {}

  /**
   * Extracts organization details from the contact data.
   */
  private extractOrganization(contact: FileFormat): {
    name: string | undefined;
  } {
    return {
      name: contact.works_for ?? undefined
    };
  }

  /**
   * Extracts person details from the contact data.
   */
  private extractPerson(contact: FileFormat): Person {
    const {
      email,
      name,
      given_name,
      family_name,
      alternate_name,
      location,
      job_title,
      same_as,
      image
    } = contact;

    assert(Boolean(email), '<email> is required');

    return {
      email: email,
      source: this.userEmail,
      name: undefinedIfFalsy(name ?? ''),
      givenName: undefinedIfFalsy(given_name ?? ''),
      familyName: undefinedIfFalsy(family_name ?? ''),
      jobTitle: undefinedIfFalsy(job_title ?? ''),
      image: undefinedIfFalsy(image ?? ''),
      location: undefinedIfEmpty(location ?? []),
      sameAs: undefinedIfEmpty(same_as ?? []),
      alternateName: undefinedIfEmpty(alternate_name ?? [])
    };
  }

  /**
   * Extracts contacts from the FileFormat data.
   */
  getContacts() {
    const organizations = [
      ...new Set(
        this.contacts
          .map(
            (details) => this.extractOrganization(details as FileFormat).name
          )
          .filter(Boolean)
      )
    ].map((name) => ({ name }));

    const persons = this.contacts.map((details) =>
      this.extractPerson(details as FileFormat)
    );

    return Promise.resolve({
      persons,
      organizations
    });
  }
}
