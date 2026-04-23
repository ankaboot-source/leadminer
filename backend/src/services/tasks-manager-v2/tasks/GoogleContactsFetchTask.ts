import { Redis } from 'ioredis';
import { Task } from './Task';
import { TaskType, TaskCategory, TaskStatus, TaskId } from '../types';
import type { ProgressMessage } from '../types';
import { getPeopleService } from '../../OAuth2/googlePeopleClient';
import SupabaseTasks from '../../../db/supabase/tasks';

export interface GooglePeopleConfig {
  accessToken: string;
  refreshToken?: string;
}

export interface GoogleContactsFetchTaskConfig {
  id?: string;
  miningId: string;
  userId: string;
  outputStream: string;
  peopleConfig: GooglePeopleConfig;
}

export class GoogleContactsFetchTask extends Task {
  private peopleConfig: GooglePeopleConfig;
  private outputStream: string;
  private redisPublisher?: Redis;
  private canceled = false;

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

        for (const person of connections) {
          if (this.canceled) {
            break;
          }

          const message = {
            type: 'google-contacts',
            data: {
              resourceName: person.resourceName,
              names: person.names,
              emailAddresses: person.emailAddresses,
              phoneNumbers: person.phoneNumbers,
              organizations: person.organizations,
              addresses: person.addresses,
              urls: person.urls
            }
          };

          if (this.redisPublisher) {
            await this.redisPublisher.xadd(
              this.outputStream,
              '*',
              'message',
              JSON.stringify(message)
            );
          }

          totalContacts++;
          this.progress.processed = totalContacts;
          this.emitProgress('googleContactsFetched', totalContacts);
        }

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
    if (msg.progressType === 'googleContactsFetched') {
      this.progress.processed = msg.count;
      this.emitProgress('googleContactsFetched', this.progress.processed);
    }
  }

  isComplete(): boolean {
    return this.status !== TaskStatus.Running;
  }

  getProgressMap(): Record<string, number> {
    return {
      googleContactsFetched: this.progress.processed
    };
  }
}
