import { people_v1 } from 'googleapis';
import logger from '../../utils/logger';
import redis from '../../utils/redis';
import { getPeopleService } from './googlePeopleClient';

const redisClient = redis.getClient();

interface GoogleContactData {
  resourceName: string;
  displayName?: string;
  givenName?: string;
  familyName?: string;
  emailAddresses?: Array<{ value?: string | null }>;
  phoneNumbers?: Array<{ value?: string | null }>;
  organizations?: Array<{ name?: string | null; title?: string | null }>;
  addresses?: Array<{ formattedValue?: string | null }>;
  urls?: Array<{ value?: string | null }>;
}

interface ContactToStream {
  miningId: string;
  type: 'google-contacts';
  data: GoogleContactData;
  isLast: boolean;
  userId: string;
  userEmail: string;
}

interface PersonContact {
  resourceName: string;
  displayName?: string;
  givenName?: string;
  familyName?: string;
  emailAddresses?: Array<{ value?: string | null }>;
  phoneNumbers?: Array<{ value?: string | null }>;
  organizations?: Array<{ name?: string | null; title?: string | null }>;
  addresses?: Array<{ formattedValue?: string | null }>;
  urls?: Array<{ value?: string | null }>;
}

async function publishFetchingProgress(
  miningId: string,
  fetchedContactsCount: number,
  isCanceled: boolean,
  isCompleted: boolean
) {
  const progress = {
    miningId,
    count: fetchedContactsCount,
    progressType: 'google-contacts-fetched',
    isCompleted,
    isCanceled
  };

  await redisClient.publish(miningId, JSON.stringify(progress));
}

async function publishToStream(stream: string, data: ContactToStream) {
  try {
    await redisClient.xadd(stream, '*', 'message', JSON.stringify(data));
  } catch (err) {
    logger.error('Error when publishing to streams');
    throw err;
  }
}

export default class GoogleContactsFetcher {
  public isCanceled: boolean = false;

  public isCompleted: boolean = false;

  private fetchedCount: number = 0;

  private readonly miningId: string;

  private readonly accessToken: string;

  private readonly refreshToken: string;

  private readonly streamName: string;

  private readonly userId: string;

  private readonly userEmail: string;

  constructor(options: {
    miningId: string;
    accessToken: string;
    refreshToken: string;
    streamName: string;
    userId: string;
    userEmail: string;
  }) {
    this.miningId = options.miningId;
    this.accessToken = options.accessToken;
    this.refreshToken = options.refreshToken;
    this.streamName = options.streamName;
    this.userId = options.userId;
    this.userEmail = options.userEmail;
  }

  async getTotalContacts(): Promise<number> {
    const peopleService = await getPeopleService({
      accessToken: this.accessToken,
      refreshToken: this.refreshToken
    });

    const response = await peopleService.people.connections.list({
      resourceName: 'people/me',
      pageSize: 1,
      personFields:
        'metadata,names,emailAddresses,phoneNumbers,organizations,addresses,urls'
    });

    return response.data.totalPeople ?? response.data.connections?.length ?? 0;
  }

  async *streamPages(): AsyncGenerator<PersonContact[], void, unknown> {
    const peopleService = await getPeopleService({
      accessToken: this.accessToken,
      refreshToken: this.refreshToken
    });

    let nextPageToken: string | undefined;
    const pageSize = 100;

    do {
      if (this.isCanceled) {
        break;
      }

      const response = await peopleService.people.connections.list({
        resourceName: 'people/me',
        pageSize,
        pageToken: nextPageToken,
        personFields:
          'names,emailAddresses,phoneNumbers,organizations,addresses,urls,metadata'
      });

      const connections = response.data.connections ?? [];

      if (connections.length > 0) {
        yield connections.map((person: people_v1.Schema$Person) => ({
          resourceName: person.resourceName || '',
          displayName: person.names?.[0]?.displayName || undefined,
          givenName: person.names?.[0]?.givenName || undefined,
          familyName: person.names?.[0]?.familyName || undefined,
          emailAddresses: person.emailAddresses,
          phoneNumbers: person.phoneNumbers,
          organizations: person.organizations,
          addresses: person.addresses,
          urls: person.urls
        }));
      }

      nextPageToken = response.data.nextPageToken || undefined;

      if (connections.length > 0) {
        this.fetchedCount += connections.length;
        await publishFetchingProgress(
          this.miningId,
          this.fetchedCount,
          this.isCanceled,
          this.isCompleted
        );
      }
    } while (nextPageToken);
  }

  async fetchAllContacts() {
    let lastBatchPublished = 0;

    for await (const contactsBatch of await this.streamPages()) {
      if (this.isCanceled) {
        break;
      }

      for (const contact of contactsBatch) {
        if (this.isCanceled) {
          break;
        }

        const contactData: GoogleContactData = {
          resourceName: contact.resourceName,
          displayName: contact.displayName,
          givenName: contact.givenName,
          familyName: contact.familyName,
          emailAddresses: contact.emailAddresses,
          phoneNumbers: contact.phoneNumbers,
          organizations: contact.organizations,
          addresses: contact.addresses,
          urls: contact.urls
        };

        await publishToStream(this.streamName, {
          miningId: this.miningId,
          type: 'google-contacts',
          data: contactData,
          isLast: false,
          userId: this.userId,
          userEmail: this.userEmail
        });

        lastBatchPublished += 1;

        if (lastBatchPublished >= 500) {
          await publishFetchingProgress(
            this.miningId,
            this.fetchedCount,
            this.isCanceled,
            this.isCompleted
          );
          lastBatchPublished = 0;
        }
      }
    }

    this.isCompleted = true;

    await publishToStream(this.streamName, {
      miningId: this.miningId,
      type: 'google-contacts',
      data: {
        resourceName: ''
      },
      isLast: true,
      userId: this.userId,
      userEmail: this.userEmail
    });

    await publishFetchingProgress(
      this.miningId,
      this.fetchedCount,
      this.isCanceled,
      this.isCompleted
    );

    logger.info(
      `[${this.miningId}] Completed fetching ${this.fetchedCount} Google contacts`
    );
  }

  start() {
    return this.fetchAllContacts();
  }

  async stop(cancel: boolean) {
    if (cancel) {
      this.isCanceled = true;
      logger.debug(`[${this.miningId}] Triggered cancel`);
    }

    try {
      await publishFetchingProgress(
        this.miningId,
        this.fetchedCount,
        this.isCanceled,
        this.isCompleted
      );

      logger.info(
        `[${this.miningId}] Stopped Google contacts fetch: canceled=${cancel}, total=${this.fetchedCount}`
      );
    } catch (error) {
      logger.error(`[${this.miningId}] Error during stop process:`, error);
      throw error;
    }
  }
}
