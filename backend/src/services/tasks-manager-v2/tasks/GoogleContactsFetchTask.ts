import { Redis } from 'ioredis';
import { Task } from './Task';
import { TaskType, TaskCategory, TaskStatus, TaskId } from '../types';
import type { ProgressMessage } from '../types';
import { getPeopleService } from '../../OAuth2/googlePeopleClient';
import SupabaseTasks from '../../../db/supabase/tasks';
import type { ContactFrontend } from '../../../db/types';

export interface GooglePeopleConfig {
  accessToken: string;
  refreshToken?: string;
  userEmail?: string;
}

export interface GoogleContactsFetchTaskConfig {
  id?: string;
  miningId: string;
  userId: string;
  userEmail: string;
  outputStream: string;
  peopleConfig: GooglePeopleConfig;
}

interface GooglePersonApiResponse {
  resourceName?: string;
  names?: Array<{
    displayName?: string;
    givenName?: string;
    familyName?: string;
  }>;
  emailAddresses?: Array<{ value?: string }>;
  phoneNumbers?: Array<{ value?: string }>;
  organizations?: Array<{ name?: string; title?: string }>;
  urls?: Array<{ value?: string }>;
}

function transformGooglePersonToContactFrontend(
  person: GooglePersonApiResponse,
  userId: string
): ContactFrontend {
  return {
    id: person.resourceName || '',
    user_id: userId,
    email: person.emailAddresses?.[0]?.value || '',
    name: person.names?.[0]?.displayName || '',
    given_name: person.names?.[0]?.givenName || '',
    family_name: person.names?.[0]?.familyName || '',
    job_title: person.organizations?.[0]?.title || '',
    works_for: person.organizations?.[0]?.name || '',
    telephone: (person.phoneNumbers
      ?.map((p) => p.value)
      .filter((v): v is string => v != null) || []) as string[],
    same_as: (person.urls
      ?.map((u) => u.value)
      .filter((v): v is string => v != null) || []) as string[]
  };
}

export class GoogleContactsFetchTask extends Task {
  private peopleConfig: GooglePeopleConfig;

  private outputStream: string;

  private redisPublisher?: Redis;

  private canceled = false;

  private userEmail: string;

  constructor(config: GoogleContactsFetchTaskConfig) {
    super({
      id: config.id ?? TaskId.GoogleContactsFetch,
      type: TaskType.GoogleContactsFetch,
      category: TaskCategory.Mining,
      miningId: config.miningId,
      userId: config.userId,
      streams: undefined,
      config: {
        outputStream: config.outputStream
      }
    });
    this.peopleConfig = config.peopleConfig;
    this.outputStream = config.outputStream;
    this.userEmail = config.userEmail;
    this.upstreamDone = true;
  }

  async start(
    tasksResolver: SupabaseTasks,
    redisPublisher?: Redis
  ): Promise<void> {
    await super.start(tasksResolver);
    this.redisPublisher = redisPublisher;

    try {
      const service = await getPeopleService({
        accessToken: this.peopleConfig.accessToken,
        refreshToken: this.peopleConfig.refreshToken
      });

      let pageToken: string | undefined;
      let totalContacts = 0;

      do {
        // eslint-disable-next-line no-await-in-loop
        const response = await service.people.connections.list({
          resourceName: 'people/me',
          pageSize: 100,
          personFields:
            'names,emailAddresses,phoneNumbers,organizations,addresses,urls',
          pageToken
        });

        const connections = response.data.connections || [];
        if (connections.length === 0) {
          break;
        }

        const transformedContacts: ContactFrontend[] = [];

        for (const person of connections) {
          if (this.canceled) {
            break;
          }

          const contact = transformGooglePersonToContactFrontend(
            person as unknown as GooglePersonApiResponse,
            this.userId
          );
          transformedContacts.push(contact);
          totalContacts += 1;
        }

        if (transformedContacts.length > 0 && this.redisPublisher) {
          const message = {
            type: 'google-contacts',
            userIdentifier: this.userId,
            userId: this.userId,
            userEmail: this.userEmail,
            miningId: this.miningId,
            data: {
              source: `google-contacts:${this.userEmail}`,
              contacts: transformedContacts.map((c) => ({
                person: c,
                tags: ['contact']
              }))
            }
          };

          // eslint-disable-next-line no-await-in-loop
          await this.redisPublisher.xadd(
            this.outputStream,
            '*',
            'message',
            JSON.stringify(message)
          );
        }

        this.progress.processed = totalContacts;
        this.emitProgress('google-contacts-fetched', totalContacts);

        if (this.canceled) {
          break;
        }

        pageToken = response.data.nextPageToken ?? undefined;
      } while (pageToken);

      this.progress.total = totalContacts;
    } catch (error) {
      this.status = TaskStatus.Canceled;
      this.stoppedAt = new Date().toUTCString();
      if (this.dbId) {
        try {
          await tasksResolver.update({
            id: this.dbId,
            userId: this.userId,
            type: this.type,
            category: this.category,
            status: this.status,
            details: this.toDetails() as unknown as Record<string, never>
          });
        } catch {
          // Best effort — the main error is the fetcher failure
        }
      }
      throw error;
    }
  }

  async stop(canceled = false, tasksResolver?: SupabaseTasks): Promise<void> {
    await super.stop(canceled, tasksResolver);
    this.canceled = true;
  }

  onMessage(msg: ProgressMessage): void {
    if (msg.progressType === 'google-contacts-fetched') {
      this.progress.processed = msg.count;
      this.emitProgress('google-contacts-fetched', this.progress.processed);
    }
  }

  isComplete(): boolean {
    return this.status !== TaskStatus.Running;
  }

  getProgressMap(): Record<string, number> {
    return {
      'google-contacts-fetched': this.progress.processed
    };
  }
}
