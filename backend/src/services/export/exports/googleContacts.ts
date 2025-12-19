import { google, people_v1 } from 'googleapis';
import { Contact } from '../../../db/types';
import {
  ExportStrategy,
  ExportResult,
  ExportType,
  ExportOptions
} from '../types';
import ENV from '../../../config';
import googleOAuth2Client from '../../OAuth2/google';
import logger from '../../../utils/logger';

export default class GoogleContactsExport implements ExportStrategy<Contact> {
  readonly contentType = 'application/json';

  readonly type = ExportType.GOOGLE_CONTACTS;

  private static getPeopleService(accessToken: string, refreshToken?: string) {
    if (!accessToken) {
      throw new Error('Invalid credentials.');
    }

    const oauth2Client = new google.auth.OAuth2(
      ENV.GOOGLE_CLIENT_ID,
      ENV.GOOGLE_SECRET
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    return google.people({ version: 'v1', auth: oauth2Client });
  }

  private static validateCredentials(
    accessToken: string,
    refreshToken?: string
  ) {
    const token = googleOAuth2Client.createToken({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    if (token.expired(1000) && !refreshToken) {
      throw new Error('Invalid credentials.');
    }

    return {
      accessToken: token.token.access_token as string,
      refreshToken
    };
  }

  async export(
    contacts: Contact[],
    options: ExportOptions
  ): Promise<ExportResult> {
    if (!options.googleContactsOptions) {
      throw new Error('Invalid contact options.');
    }

    const {
      googleContactsOptions: {
        accessToken: at,
        refreshToken: rt,
        updateEmptyFieldsOnly
      }
    } = options;
    const { accessToken, refreshToken } =
      GoogleContactsExport.validateCredentials(at, rt);
    const peopleService = GoogleContactsExport.getPeopleService(
      accessToken,
      refreshToken
    );
    const updateEmptyOnly = updateEmptyFieldsOnly ?? false;

    contacts.forEach(async (contact) => {
      const existing = await GoogleContactsExport.fetchGoogleContacts(
        peopleService,
        contact
      );
      if (existing) {
        await GoogleContactsExport.updateContact(
          peopleService,
          existing,
          contact,
          updateEmptyOnly
        );
      } else {
        await GoogleContactsExport.createContact(peopleService, contact);
      }
    });

    return {
      content: '',
      contentType: this.contentType,
      charset: '',
      extension: ''
    };
  }

  private static async contactByEmail(
    peopleService: people_v1.People,
    email: string
  ): Promise<people_v1.Schema$Person[]> {
    const res = await peopleService.people.searchContacts({
      query: email,
      readMask: 'names,emailAddresses,phoneNumbers,organizations,metadata'
    });

    return (
      res.data.results
        ?.map((r) => r.person)
        .filter((p): p is people_v1.Schema$Person => Boolean(p)) ?? []
    );
  }

  private static async contactByPhone(
    peopleService: people_v1.People,
    phones: string[] = []
  ): Promise<people_v1.Schema$Person[]> {
    const uniqueContacts = new Map<string, people_v1.Schema$Person>();

    phones.forEach(async (phone) => {
      if (!phone) return;

      const res = await peopleService.people.searchContacts({
        query: phone,
        readMask: 'names,emailAddresses,phoneNumbers,organizations,metadata'
      });

      for (const r of res.data.results ?? []) {
        const { person } = r;
        if (person?.resourceName) {
          uniqueContacts.set(person.resourceName, person);
        }
      }
    });

    const contact = uniqueContacts.values().next().value;

    return uniqueContacts.size === 1 && contact ? [contact] : [];
  }

  private static async fetchGoogleContacts(
    peopleService: people_v1.People,
    contact: Contact
  ): Promise<people_v1.Schema$Person | null> {
    const map = new Map<string, people_v1.Schema$Person>();

    // Warmup query
    await peopleService.people.searchContacts({
      query: '',
      readMask: 'names,emailAddresses,phoneNumbers,organizations,metadata'
    });

    const byEmail = await GoogleContactsExport.contactByEmail(
      peopleService,
      contact.email
    );
    const byPhone = await GoogleContactsExport.contactByPhone(
      peopleService,
      contact.telephone ?? []
    );

    for (const p of [...byEmail, ...byPhone]) {
      if (p.resourceName) {
        map.set(p.resourceName, p);
      }
    }

    const merged = [...map.values()];

    return (
      merged.find((p) =>
        p.metadata?.sources?.some((s) => s.type === 'CONTACT')
      ) ?? null
    );
  }

  private static async createContact(
    peopleService: people_v1.People,
    contact: Contact
  ) {
    const person = GoogleContactsExport.mapContactToPerson(contact);
    try {
      await peopleService.people.createContact({
        requestBody: person
      });
    } catch (err) {
      logger.error('Error creating Google contact', err);
    }
  }

  private static async updateContact(
    peopleService: people_v1.People,
    existing: people_v1.Schema$Person,
    contact: Contact,
    updateEmptyOnly: boolean
  ) {
    const person = GoogleContactsExport.mapContactToPerson(
      contact,
      existing,
      updateEmptyOnly
    );

    if (Object.keys(person).length === 0) return;
    if (!existing.resourceName) return;

    try {
      await peopleService.people.updateContact({
        resourceName: existing.resourceName,
        updatePersonFields: Object.keys(person).join(','),
        requestBody: {
          ...person,
          etag: existing.etag
        }
      });
    } catch (err) {
      logger.error('Error updating Google contact', err);
    }
  }

  private static mapContactToPerson(
    contact: Contact,
    existing?: people_v1.Schema$Person,
    updateEmptyOnly = false
  ): Partial<people_v1.Schema$Person> {
    const person: Partial<people_v1.Schema$Person> = {};

    const existingName = existing?.names?.[0];
    if (!updateEmptyOnly || !existingName?.givenName) {
      person.names = [
        {
          givenName: contact.given_name ?? '',
          familyName: contact.family_name ?? '',
          displayName: contact.name ?? ''
        }
      ];
    }

    const existingEmail = existing?.emailAddresses?.[0];
    if (!updateEmptyOnly || !existingEmail?.value) {
      person.emailAddresses = [{ value: contact.email }];
    }

    if (!updateEmptyOnly || !existing?.phoneNumbers?.length) {
      if (contact.telephone?.length) {
        person.phoneNumbers = contact.telephone.map((tel) => ({ value: tel }));
      }
    }

    const existingOrg = existing?.organizations?.[0];
    if (!updateEmptyOnly || !existingOrg?.name) {
      person.organizations = [
        {
          name: contact.works_for ?? '',
          title: contact.job_title ?? ''
        }
      ];
    }

    const existingAddr = existing?.addresses?.[0];
    if (!updateEmptyOnly || !existingAddr?.streetAddress) {
      if (contact.location) {
        person.addresses = [{ streetAddress: contact.location }];
      }
    }

    const existingNicknames = existing?.nicknames?.map((n) => n.value) ?? [];
    if (!updateEmptyOnly || existingNicknames.length === 0) {
      if (contact.alternate_name?.length) {
        person.nicknames = contact.alternate_name.map((alt) => ({
          value: alt
        }));
      }
    }

    const existingURLs = existing?.urls?.map((u) => u.value) ?? [];
    if (!updateEmptyOnly || existingURLs.length === 0) {
      if (contact.same_as?.length) {
        person.urls = contact.same_as.map((url) => ({ value: url }));
      }
    }

    if (!updateEmptyOnly || !existing?.photos?.length) {
      if (contact.image) {
        person.photos = [{ url: contact.image }];
      }
    }

    return person;
  }
}
