import { people_v1 } from 'googleapis';
import { ContactFrontend } from '../../../../db/types';
import logger from '../../../../utils/logger';
import { Distribution, TokenBucketRateLimiter } from '../../../rate-limiter';
import ENV from '../../../../config';

export type QuotaType = 'criticalRead' | 'criticalWrite' | 'read' | 'write';

export default class GoogleContactsSession {
  private readonly PERSON_FIELDS =
    'names,emailAddresses,phoneNumbers,organizations,addresses,nicknames,urls,memberships';

  private readonly FULL_READ_MASK = `${this.PERSON_FIELDS},metadata`;

  private labelMap = new Map<string, string>();

  private service: people_v1.People;

  private limiters: Record<QuotaType, TokenBucketRateLimiter>;

  constructor(
    service: people_v1.People,
    private readonly appName: string,
    private readonly userId: string
  ) {
    this.service = service;

    const config = {
      criticalRead: {
        requests: ENV.GOOGLE_CONTACTS_CRITICAL_READ_REQUESTS,
        intervalSeconds: ENV.GOOGLE_CONTACTS_CRITICAL_READ_INTERVAL,
        uniqueKey: `crit-read-${this.userId}`,
        executeEvenly: true,
        distribution: Distribution.Memory
      }, // Limit is 90
      criticalWrite: {
        requests: ENV.GOOGLE_CONTACTS_CRITICAL_WRITE_REQUESTS,
        intervalSeconds: ENV.GOOGLE_CONTACTS_CRITICAL_WRITE_INTERVAL,
        uniqueKey: `crit-write-${this.userId}`,
        executeEvenly: true,
        distribution: Distribution.Memory
      }, // Limit is 90
      read: {
        requests: ENV.GOOGLE_CONTACTS_READ_REQUESTS,
        intervalSeconds: ENV.GOOGLE_CONTACTS_READ_INTERVAL,
        uniqueKey: `read-${this.userId}`,
        executeEvenly: true,
        distribution: Distribution.Memory
      }, // Limit is 120 (Groups)
      write: {
        requests: ENV.GOOGLE_CONTACTS_WRITE_REQUESTS,
        intervalSeconds: ENV.GOOGLE_CONTACTS_WRITE_INTERVAL,
        uniqueKey: `write-${this.userId}`,
        executeEvenly: true,
        distribution: Distribution.Memory
      } // Limit is 90 (Groups/Delete)
    };

    this.limiters = {
      criticalRead: new TokenBucketRateLimiter(config.criticalRead),
      criticalWrite: new TokenBucketRateLimiter(config.criticalWrite),
      read: new TokenBucketRateLimiter(config.read),
      write: new TokenBucketRateLimiter(config.write)
    };
  }

  private async useQuota<T>(
    requirements: { type: QuotaType; weight: number }[],
    callback: () => Promise<T>
  ): Promise<T> {
    await Promise.all(
      requirements.map((q) => this.limiters[q.type].removeTokens(q.weight))
    );
    return callback();
  }

  private static batchPerLimit<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  async run(contacts: ContactFrontend[], updateEmptyOnly: boolean) {
    try {
      logger.debug('GoogleContactsSession.run(): Starting sync process', {
        userId: this.userId,
        contactCount: contacts.length,
        updateEmptyOnly
      });

      const existingLabels = await this.listLabels();

      logger.debug('GoogleContactsSession.run(): Fetched labels fetched', {
        labelCount: existingLabels.size,
        labels: Array.from(existingLabels.keys())
      });

      const contactsLabels = [{ tags: [ENV.APP_NAME] }, ...contacts]
        .map(({ tags }) => tags)
        .flat()
        .filter((tag): tag is string => Boolean(tag));

      logger.debug('GoogleContactsSession.run(): Extracted contact tags', {
        uniqueTagCount: new Set(contactsLabels).size,
        tags: [...new Set(contactsLabels)]
      });

      const created = await this.createLabels(existingLabels, contactsLabels);

      this.labelMap = new Map([...existingLabels, ...created]);

      logger.debug(
        'GoogleContactsSession.run(): Created missing labels and build labelMap',
        {
          newLabelCount: created.size,
          newLabels: Array.from(created.keys()),
          totalLabels: this.labelMap.size
        }
      );

      const { create, update } = await this.contactsToCreateUpdate(contacts);

      const createBatches = GoogleContactsSession.batchPerLimit(
        Array.from(create.values()),
        200
      );
      const updateBatches = GoogleContactsSession.batchPerLimit(
        Array.from(update.values()),
        200
      );

      logger.debug('GoogleContactsSession.run(): Batches prepared', {
        createBatches: createBatches.length,
        updateBatches: updateBatches.length
      });

      /* eslint-disable no-await-in-loop */
      for (let i = 0; i < createBatches.length; i += 1) {
        const batch = createBatches[i];
        logger.debug(
          `GoogleContactsSession.run(): Processing create batch ${i + 1}/${createBatches.length}`,
          {
            batchSize: batch.length
          }
        );

        await this.useQuota(
          [
            { type: 'criticalRead', weight: 6 },
            { type: 'criticalWrite', weight: 6 }
          ],
          async () => {
            await this.executeBatchCreate(batch);
          }
        );

        logger.debug(
          `GoogleContactsSession.run(): Create batch ${i + 1}/${createBatches.length} completed`
        );
      }

      /* eslint-disable no-await-in-loop */
      for (let i = 0; i < updateBatches.length; i += 1) {
        const batch = updateBatches[i];
        logger.debug(
          `GoogleContactsSession.run(): Processing update batch ${i + 1}/${updateBatches.length}`,
          {
            batchSize: batch.length
          }
        );

        await this.useQuota(
          [
            { type: 'criticalRead', weight: 6 },
            { type: 'criticalWrite', weight: 6 }
          ],
          async () => {
            await this.executeBatchUpdate(batch, updateEmptyOnly);
          }
        );

        logger.debug(
          `GoogleContactsSession.run(): Update batch ${i + 1}/${updateBatches.length} completed`
        );
      }

      logger.info('GoogleContactsSession.run(): Sync completed successfully', {
        totalContacts: contacts.length,
        created: create.size,
        updated: update.size
      });
    } catch (err) {
      logger.error(
        `GoogleContactsSession.run(): Error during sync: ${(err as Error).message}`,
        err
      );
      throw err;
    }
  }

  private async contactsToCreateUpdate(contacts: ContactFrontend[]) {
    const create: Map<string, ContactFrontend> = new Map();
    const update: Map<
      string,
      { existing: people_v1.Schema$Person; incoming: ContactFrontend }
    > = new Map();

    const { emailMap, phoneMap } = await this.getUserContacts();

    for (const contact of contacts) {
      const potentialMatches = new Map<string, people_v1.Schema$Person>();

      const emailMatches = emailMap.get(contact.email.toLowerCase()) || [];
      emailMatches.forEach((p) => {
        if (p.resourceName) potentialMatches.set(p.resourceName, p);
      });

      if (!emailMatches.length && contact.telephone) {
        for (const phone of contact.telephone) {
          const normalizedPhone = phone.replace(/\s+/g, '');
          const phoneMatches = phoneMap.get(normalizedPhone) || [];
          phoneMatches.forEach((p) => {
            if (p.resourceName) potentialMatches.set(p.resourceName, p);
          });
        }
      }

      if (potentialMatches.size === 1) {
        const existing = Array.from(potentialMatches.values())[0];
        update.set(existing.resourceName as string, {
          existing,
          incoming: contact
        });
      } else {
        create.set(contact.email, contact);
        if (potentialMatches.size > 1) {
          logger.warn(
            `Ambiguous match for ${contact.email}: Found ${potentialMatches.size} contacts. Creating new record to avoid corruption.`
          );
        }
      }
    }
    return { create, update };
  }

  private async listLabels(): Promise<Map<string, string>> {
    const labels = new Map<string, string>();
    await this.useQuota([{ type: 'read', weight: 1 }], async () => {
      const res = await this.service.contactGroups.list({
        groupFields: 'name'
      });
      (res.data.contactGroups || []).forEach((g) => {
        if (g.name && g.resourceName)
          labels.set(g.name.toLowerCase(), g.resourceName);
      });
    });
    return labels;
  }

  private async createLabels(
    existing: Map<string, string>,
    labels: string[]
  ): Promise<Map<string, string>> {
    const labelsMap = new Map<string, string>();
    const toCreate = [...new Set(labels)].filter(
      (label) => !existing.has(label?.toLowerCase())
    );
    const tasks = toCreate.map(async (tag) => {
      await this.useQuota(
        [
          { type: 'write', weight: 1 },
          { type: 'read', weight: 1 }
        ],
        async () => {
          const newGroup = await this.service.contactGroups.create({
            requestBody: { contactGroup: { name: tag } }
          });

          if (newGroup.data.resourceName)
            labelsMap.set(tag.toLowerCase(), newGroup.data.resourceName);
        }
      );
    });

    await Promise.all(tasks);

    return labelsMap;
  }

  private async executeBatchUpdate(
    batch: { existing: people_v1.Schema$Person; incoming: ContactFrontend }[],
    updateEmptyOnly: boolean
  ) {
    const contactsMap: { [key: string]: people_v1.Schema$Person } = {};

    batch.forEach((item) => {
      const person = this.mapToPerson(
        item.incoming,
        item.existing,
        updateEmptyOnly
      );
      if (item.existing.resourceName) {
        contactsMap[item.existing.resourceName] = {
          ...person,
          etag: item.existing.etag
        };
      }
    });

    if (Object.keys(contactsMap).length === 0) return;

    await this.service.people.batchUpdateContacts({
      requestBody: {
        contacts: contactsMap,
        updateMask: this.PERSON_FIELDS
      }
    });
    logger.info(`Batch updated ${batch.length} contacts.`);
  }

  private async executeBatchCreate(batch: ContactFrontend[]) {
    const res = await this.service.people.batchCreateContacts({
      requestBody: {
        contacts: batch.map((c) => ({ contactPerson: this.mapToPerson(c) }))
      }
    });
    logger.info(`Batch created ${batch.length} contacts.`);
    return res.data;
  }

  private async getUserContacts(): Promise<{
    emailMap: Map<string, people_v1.Schema$Person[]>;
    phoneMap: Map<string, people_v1.Schema$Person[]>;
  }> {
    const emailMap = new Map<string, people_v1.Schema$Person[]>();
    const phoneMap = new Map<string, people_v1.Schema$Person[]>();
    let pageToken: string | undefined;

    do {
      const currentPageToken = pageToken;
      const res = await this.useQuota(
        [{ type: 'criticalRead', weight: 1 }],
        async () =>
          this.service.people.connections.list({
            resourceName: 'people/me',
            pageSize: 1000,
            pageToken: currentPageToken,
            personFields: this.FULL_READ_MASK
          })
      );

      const connections = (res.data.connections || []).filter((p) =>
        p.metadata?.sources?.some((s) => s.type === 'CONTACT')
      );

      for (const person of connections) {
        person.emailAddresses?.forEach((e) => {
          if (!e.value) return;
          const key = e.value.toLowerCase();
          const existing = emailMap.get(key) || [];
          emailMap.set(key, [...existing, person]);
        });

        person.phoneNumbers?.forEach((p) => {
          if (!p.value) return;
          const key = p.value.replace(/\s+/g, '');
          const existing = phoneMap.get(key) || [];
          phoneMap.set(key, [...existing, person]);
        });
      }

      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    return { emailMap, phoneMap };
  }

  private mapToPerson(
    contact: ContactFrontend,
    existing?: people_v1.Schema$Person,
    updateEmptyOnly = false
  ): people_v1.Schema$Person {
    const existingUrls = existing?.urls || [];
    const existingNames = existing?.names || [];
    const existingOrgs = existing?.organizations || [];
    const existingAddresses = existing?.addresses || [];
    const existingPhones = existing?.phoneNumbers || [];
    const existingEmails = existing?.emailAddresses || [];
    const existingMemberships = existing?.memberships || [];
    const labels = [this.appName, ...(contact.tags ?? [])].filter(Boolean);

    // Helper function to check if a field is empty
    const isEmpty = (val: string | null | undefined) =>
      val === null || val === undefined || val === '';

    let names: people_v1.Schema$Name[] = existingNames;
    if (!updateEmptyOnly || existingNames.length === 0) {
      const newName: people_v1.Schema$Name = {};
      if (!isEmpty(contact.given_name)) {
        newName.givenName = contact.given_name;
      }
      if (!isEmpty(contact.family_name)) {
        newName.familyName = contact.family_name;
      }
      if (!isEmpty(contact.name)) {
        newName.unstructuredName = contact.name;
      }

      if (newName.givenName || newName.familyName || newName.unstructuredName) {
        names = [newName];
      }
    }

    const emailAddresses =
      !updateEmptyOnly || existingEmails.length === 0
        ? [
            ...existingEmails.filter((e) => e.value !== contact.email),
            { value: contact.email }
          ]
        : existingEmails;

    let phoneNumbers: people_v1.Schema$PhoneNumber[] = existingPhones;
    const newPhones =
      contact.telephone
        ?.filter((tel) => !isEmpty(tel))
        .map((tel) => ({ value: tel })) || [];
    if (newPhones.length > 0) {
      const existingValues = new Set(existingPhones.map((p) => p.value));
      const uniqueNewPhones = newPhones.filter((p) => !existingValues.has(p.value));
      if (uniqueNewPhones.length > 0) {
        phoneNumbers = [...existingPhones, ...uniqueNewPhones];
      }
    }

    let organizations: people_v1.Schema$Organization[] = existingOrgs;
    const newOrg: people_v1.Schema$Organization = {};
    if (!isEmpty(contact.works_for)) {
      newOrg.name = contact.works_for;
    }
    if (!isEmpty(contact.job_title)) {
      newOrg.title = contact.job_title;
    }
    if (newOrg.name || newOrg.title) {
      const isDuplicate = existingOrgs.some(
        (o) => o.name === newOrg.name && o.title === newOrg.title
      );
      if (!isDuplicate) {
        organizations = [...existingOrgs, newOrg];
      }
    }

    let urls: people_v1.Schema$Url[] = existingUrls;
    const newUrls =
      contact.same_as
        ?.filter((url) => !isEmpty(url))
        .map((url) => ({ value: url })) || [];
    if (newUrls.length > 0) {
      const existingValues = new Set(existingUrls.map((u) => u.value));
      const uniqueNewUrls = newUrls.filter((u) => !existingValues.has(u.value));
      if (uniqueNewUrls.length > 0) {
        urls = [...existingUrls, ...uniqueNewUrls];
      }
    }

    let addresses: people_v1.Schema$Address[] = existingAddresses;
    if (!isEmpty(contact.location)) {
      const newAddress = { streetAddress: contact.location };
      const isDuplicate = existingAddresses.some(
        (a) => a.streetAddress === newAddress.streetAddress
      );
      if (!isDuplicate) {
        addresses = [...existingAddresses, newAddress];
      }
    }

    const person: people_v1.Schema$Person = {
      names,
      emailAddresses,
      phoneNumbers,
      organizations,
      urls,
      addresses,
      memberships: [
        ...existingMemberships.filter(
          (m) =>
            !labels.some(
              (l) =>
                this.labelMap.get(l.toLowerCase()) ===
                m.contactGroupMembership?.contactGroupResourceName
            )
        ),
        ...labels
          .map((l) => this.labelMap.get(l.toLowerCase()))
          .filter(Boolean)
          .map((groupResourceName) => ({
            contactGroupMembership: {
              contactGroupResourceName: groupResourceName
            }
          }))
      ]
    };

    return person;
  }
}
