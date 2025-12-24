import { people_v1 } from 'googleapis';
import { ContactFrontend } from '../../../../db/types';
import logger from '../../../../utils/logger';

export default class GoogleContactsSession {
  private labelMap = new Map<string, string>();

  private service: people_v1.People;

  private appName: string;

  constructor(service: people_v1.People, appName: string) {
    this.service = service;
    this.appName = appName;
  }

  async run(contacts: ContactFrontend[], updateEmptyOnly: boolean) {
    // Sync and Create Labels (tags) once for this session
    try {
      await this.prepareLabels(contacts);
      await Promise.all(
        contacts.map(async (contact) => {
          const existing = await this.findExisting(contact);
          if (existing) {
            await this.update(existing, contact, updateEmptyOnly);
          } else {
            await this.create(contact);
          }
        })
      );
    } catch (err) {
      logger.error(`Error when running export: ${(err as Error).message}`, err);
      throw err;
    }
  }

  private async prepareLabels(contacts: ContactFrontend[]) {
    const res = await this.service.contactGroups.list({ groupFields: 'name' });
    (res.data.contactGroups || []).forEach((g) => {
      if (g.name && g.resourceName)
        this.labelMap.set(g.name.toLowerCase(), g.resourceName);
    });

    const tagsToEnsure = new Set<string>([this.appName]);
    contacts.forEach((c) => c.tags?.forEach((t) => tagsToEnsure.add(t)));

    await Promise.all(
      Array.from(tagsToEnsure.values()).map(async (tag) => {
        if (!this.labelMap.has(tag)) {
          try {
            const newGroup = await this.service.contactGroups.create({
              requestBody: { contactGroup: { name: tag } }
            });
            if (newGroup.data.resourceName)
              this.labelMap.set(tag, newGroup.data.resourceName);
          } catch (e: any) {
            if (e.code !== 409) logger.error(`Label creation error: ${tag}`, e);
          }
        }
      })
    );
  }

  private async findExisting(
    contact: ContactFrontend
  ): Promise<people_v1.Schema$Person | null> {
    const map = new Map<string, people_v1.Schema$Person>();
    const queries = [contact.email].concat(contact.telephone ?? []);

    const contacts = (
      await Promise.all(
        queries.map(async (query) => {
          const uniqueContacts = new Map<string, people_v1.Schema$Person>();
          const res = await this.service.people.searchContacts({
            query,
            readMask: 'names,emailAddresses,phoneNumbers,organizations,metadata'
          });

          for (const r of res?.data?.results ?? []) {
            const { person } = r;
            if (person?.resourceName) {
              uniqueContacts.set(person.resourceName, person);
            }
          }
          const person = uniqueContacts.values().next().value;
          return uniqueContacts.size === 1 && person ? person : undefined;
        })
      )
    ).filter((p): p is people_v1.Schema$Person => Boolean(p));

    for (const person of contacts) {
      if (person.resourceName) {
        map.set(person.resourceName, person);
      }
    }

    const merged = [...map.values()];

    return (
      merged.find((p) =>
        p.metadata?.sources?.some((s) => s.type === 'CONTACT')
      ) ?? null
    );
  }

  private async create(contact: ContactFrontend) {
    const person = this.mapToPerson(contact);
    try {
      await this.service.people.createContact({
        requestBody: person
      });
    } catch (err) {
      logger.error('Error creating Google contact', {
        error: (err as Error).message
      });
      throw err;
    }
  }

  private async update(
    existing: people_v1.Schema$Person,
    contact: ContactFrontend,
    updateEmptyOnly: boolean
  ) {
    const person = this.mapToPerson(contact, existing, updateEmptyOnly);

    if (Object.keys(person).length === 0) return;
    if (!existing.resourceName) return;

    try {
      await this.service.people.updateContact({
        resourceName: existing.resourceName,
        updatePersonFields: Object.keys(person).join(','),
        requestBody: {
          ...person,
          etag: existing.etag
        }
      });
    } catch (err) {
      logger.error('Error updating Google contact', {
        error: (err as Error).message
      });
      throw err;
    }
  }

  private mapToPerson(
    contact: ContactFrontend,
    existing?: people_v1.Schema$Person,
    updateEmptyOnly = false
  ): people_v1.Schema$Person {
    const person: Partial<people_v1.Schema$Person> = {};

    const existingName = existing?.names?.[0];

    // Check if we should update names:
    // 1. Not in "empty only" mode
    // 2. OR the whole name is missing
    // 3. OR the specific family name we have is missing from Google
    const shouldUpdateName =
      !updateEmptyOnly ||
      !existingName ||
      (contact.family_name && !existingName.familyName) ||
      (contact.given_name && !existingName.givenName);

    if (shouldUpdateName) {
      person.names = [
        {
          givenName: contact.given_name ?? existingName?.givenName ?? null,
          familyName: contact.family_name ?? existingName?.familyName ?? null,
          unstructuredName:
            contact.name ?? existingName?.unstructuredName ?? null
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

    if (!updateEmptyOnly || !existing?.memberships?.length) {
      const memberships: people_v1.Schema$Membership[] = [];
      const labels = [this.appName].concat(contact.tags ?? []).filter(Boolean);

      labels.forEach((l) => {
        const id = this.labelMap.get(l.toLowerCase());
        if (id)
          memberships.push({
            contactGroupMembership: { contactGroupResourceName: id }
          });
      });
      if (memberships.length > 0) person.memberships = memberships;
    }

    return person;
  }
}
