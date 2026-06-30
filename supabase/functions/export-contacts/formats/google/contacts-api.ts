import { withRateLimit } from "../../../_shared/rate-limiter.ts";
import { createLogger } from "../../../_shared/logger.ts";
import type { ContactFrontend } from "../../types.ts";

const logger = createLogger("export-contacts:google");

const GOOGLE_PEOPLE_API = "https://people.googleapis.com/v1";

const PERSON_FIELDS =
  "names,emailAddresses,phoneNumbers,organizations,addresses,nicknames,urls,memberships";
const FULL_READ_MASK = `${PERSON_FIELDS},metadata`;

export default class GoogleContactsSession {
  private labelMap = new Map<string, string>();
  private appName: string;
  private userId: string;
  private accessToken: string;

  constructor(
    accessToken: string,
    appName: string,
    userId: string,
  ) {
    this.accessToken = accessToken;
    this.appName = appName;
    this.userId = userId;
  }

  private async apiFetch<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${GOOGLE_PEOPLE_API}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Invalid credentials.");
      }
      const body = await response.text();
      throw new Error(`Google API error (${response.status}): ${body}`);
    }

    return response.json();
  }

  async run(
    contacts: ContactFrontend[],
    updateEmptyOnly: boolean,
  ): Promise<{ labelId: string | null }> {
    try {
      logger.debug("Starting Google Contacts sync", {
        userId: this.userId,
        contactCount: contacts.length,
        updateEmptyOnly,
      });

      const existingLabels = await this.listLabels();

      const contactsLabels = [{ tags: [this.appName] }, ...contacts]
        .map(({ tags }) => tags)
        .flat()
        .filter((tag): tag is string => Boolean(tag));

      const created = await this.createLabels(existingLabels, contactsLabels);
      this.labelMap = new Map([...existingLabels, ...created]);

      const { create, update } = await this.contactsToCreateUpdate(contacts);

      const createBatches = batchPerLimit(
        Array.from(create.values()),
        200,
      );
      const updateBatches = batchPerLimit(
        Array.from(update.values()),
        200,
      );

      for (let i = 0; i < createBatches.length; i++) {
        const batch = createBatches[i];
        await withRateLimit(
          [
            { type: "criticalRead", weight: 6 },
            { type: "criticalWrite", weight: 6 },
          ],
          `google-${this.userId}`,
          async () => {
            await this.executeBatchCreate(batch);
          },
        );
        logger.debug(
          `Google sync: create batch ${i + 1}/${createBatches.length} completed`,
        );
      }

      for (let i = 0; i < updateBatches.length; i++) {
        const batch = updateBatches[i];
        await withRateLimit(
          [
            { type: "criticalRead", weight: 6 },
            { type: "criticalWrite", weight: 6 },
          ],
          `google-${this.userId}`,
          async () => {
            await this.executeBatchUpdate(batch, updateEmptyOnly);
          },
        );
        logger.debug(
          `Google sync: update batch ${i + 1}/${updateBatches.length} completed`,
        );
      }

      logger.info("Google Contacts sync completed", {
        totalContacts: contacts.length,
        created: create.size,
        updated: update.size,
      });

      const appLabelResourceName = this.labelMap.get(
        this.appName.toLowerCase(),
      );
      const labelId = appLabelResourceName
        ? appLabelResourceName.replace("contactGroups/", "")
        : null;

      return { labelId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Google Contacts sync error: ${msg}`, { error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  }

  private async listLabels(): Promise<Map<string, string>> {
    const labels = new Map<string, string>();
    const data = await withRateLimit(
      [{ type: "read", weight: 1 }],
      `google-${this.userId}`,
      async () =>
        this.apiFetch<{
          contactGroups?: { name?: string; resourceName?: string }[];
        }>("/contactGroups?groupFields=name"),
    );

    (data.contactGroups || []).forEach((g) => {
      if (g.name && g.resourceName) {
        labels.set(g.name.toLowerCase(), g.resourceName);
      }
    });

    return labels;
  }

  private async createLabels(
    existing: Map<string, string>,
    labels: string[],
  ): Promise<Map<string, string>> {
    const labelsMap = new Map<string, string>();
    const toCreate = [...new Set(labels)].filter(
      (label) => !existing.has(label?.toLowerCase()),
    );

    const tasks = toCreate.map(async (tag) => {
      await withRateLimit(
        [
          { type: "write", weight: 1 },
          { type: "read", weight: 1 },
        ],
        `google-${this.userId}`,
        async () => {
          const newGroup = await this.apiFetch<{ resourceName?: string }>(
            "/contactGroups",
            {
              method: "POST",
              body: JSON.stringify({ contactGroup: { name: tag } }),
            },
          );
          if (newGroup.resourceName) {
            labelsMap.set(tag.toLowerCase(), newGroup.resourceName);
          }
        },
      );
    });

    await Promise.all(tasks);
    return labelsMap;
  }

  private async executeBatchUpdate(
    batch: {
      existing: { resourceName?: string; etag?: string };
      incoming: ContactFrontend;
    }[],
    updateEmptyOnly: boolean,
  ) {
    const contactsMap: Record<string, Record<string, unknown>> = {};

    batch.forEach((item) => {
      const person = this.mapToPerson(
        item.incoming,
        item.existing,
      );
      if (item.existing.resourceName) {
        contactsMap[item.existing.resourceName] = {
          ...person,
          etag: item.existing.etag,
        };
      }
    });

    if (Object.keys(contactsMap).length === 0) return;

    await this.apiFetch("/people:batchUpdateContacts", {
      method: "POST",
      body: JSON.stringify({
        contacts: contactsMap,
        updateMask: PERSON_FIELDS,
      }),
    });
    logger.info(`Batch updated ${batch.length} contacts`);
  }

  private async executeBatchCreate(batch: ContactFrontend[]) {
    await this.apiFetch("/people:batchCreateContacts", {
      method: "POST",
      body: JSON.stringify({
        contacts: batch.map((c) => ({
          contactPerson: this.mapToPerson(c),
        })),
      }),
    });
    logger.info(`Batch created ${batch.length} contacts`);
  }

  private async getUserContacts(): Promise<{
    emailMap: Map<string, { resourceName?: string }[]>;
    phoneMap: Map<string, { resourceName?: string }[]>;
  }> {
    const emailMap = new Map<string, { resourceName?: string }[]>();
    const phoneMap = new Map<string, { resourceName?: string }[]>();
    let pageToken: string | undefined;

    do {
      const currentPageToken = pageToken;
      const params = new URLSearchParams({
        resourceName: "people/me",
        pageSize: "1000",
        personFields: FULL_READ_MASK,
      });
      if (currentPageToken) {
        params.set("pageToken", currentPageToken);
      }

      const data = await withRateLimit(
        [{ type: "criticalRead", weight: 1 }],
        `google-${this.userId}`,
        async () =>
          this.apiFetch<{
            connections?: {
              resourceName?: string;
              emailAddresses?: { value?: string }[];
              phoneNumbers?: { value?: string }[];
              metadata?: { sources?: { type?: string }[] };
            }[];
            nextPageToken?: string;
          }>(`/people/me/connections?${params.toString()}`),
      );

      const connections = (data.connections || []).filter((p) =>
        p.metadata?.sources?.some((s) => s.type === "CONTACT"),
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
          const key = p.value.replace(/\s+/g, "");
          const existing = phoneMap.get(key) || [];
          phoneMap.set(key, [...existing, person]);
        });
      }

      pageToken = data.nextPageToken ?? undefined;
    } while (pageToken);

    return { emailMap, phoneMap };
  }

  private async contactsToCreateUpdate(contacts: ContactFrontend[]) {
    const create: Map<string, ContactFrontend> = new Map();
    const update: Map<
      string,
      {
        existing: { resourceName?: string; etag?: string };
        incoming: ContactFrontend;
      }
    > = new Map();

    const { emailMap, phoneMap } = await this.getUserContacts();

    for (const contact of contacts) {
      const potentialMatches = new Map<
        string,
        { resourceName?: string; etag?: string }
      >();

      const emailMatches = contact.email
        ? emailMap.get(contact.email.toLowerCase()) || []
        : [];
      emailMatches.forEach((p) => {
        if (p.resourceName) potentialMatches.set(p.resourceName, p);
      });

      if (!emailMatches.length && contact.telephone) {
        for (const phone of contact.telephone) {
          const normalizedPhone = phone.replace(/\s+/g, "");
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
          incoming: contact,
        });
      } else {
        const key = contact.email ?? contact.telephone?.[0] ?? contact.id;
        if (key) {
          create.set(key, contact);
        }
        if (potentialMatches.size > 1) {
          logger.warn(
            `Ambiguous match for ${contact.email ?? contact.telephone?.[0]}`,
          );
        }
      }
    }

    return { create, update };
  }

  private mapToPerson(
    contact: ContactFrontend,
    existing?: { resourceName?: string; etag?: string },
  ): Record<string, unknown> {
    const labels = [this.appName, ...(contact.tags ?? [])].filter(Boolean);

    const isEmpty = (val: string | null | undefined) =>
      val === null || val === undefined || val === "";

    let names: Record<string, unknown>[] = [];
    const newName: Record<string, unknown> = {};
    if (!isEmpty(contact.given_name)) {
      newName.givenName = contact.given_name;
    }
    if (!isEmpty(contact.family_name)) {
      newName.familyName = contact.family_name;
    }
    if (!isEmpty(contact.name)) {
      newName.unstructuredName = contact.name;
    }
    if (Object.keys(newName).length > 0) {
      names = [newName];
    }

    const hasEmail = !isEmpty(contact.email);
    const emailAddresses = hasEmail
      ? [{ value: contact.email as string }]
      : [];

    let phoneNumbers: Record<string, unknown>[] = [];
    const newPhones =
      contact.telephone
        ?.filter((tel) => !isEmpty(tel))
        .map((tel) => ({ value: tel })) || [];
    if (newPhones.length > 0) {
      phoneNumbers = newPhones;
    }

    const newOrg: Record<string, unknown> = {};
    if (!isEmpty(contact.works_for)) {
      newOrg.name = contact.works_for;
    }
    if (!isEmpty(contact.job_title)) {
      newOrg.title = contact.job_title;
    }
    const organizations = Object.keys(newOrg).length > 0 ? [newOrg] : [];

    const newUrls =
      contact.same_as
        ?.filter((url) => !isEmpty(url))
        .map((url) => ({ value: url })) || [];
    const urls = newUrls;

    const addresses =
      !isEmpty(contact.location)
        ? [{ streetAddress: contact.location }]
        : [];

    const memberships = labels
      .map((l) => this.labelMap.get(l.toLowerCase()))
      .filter(Boolean)
      .map((groupResourceName) => ({
        contactGroupMembership: {
          contactGroupResourceName: groupResourceName,
        },
      }));

    return {
      names,
      emailAddresses,
      phoneNumbers,
      organizations,
      urls,
      addresses,
      memberships,
    };
  }
}

function batchPerLimit<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
