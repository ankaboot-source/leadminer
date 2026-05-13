import { Redis } from 'ioredis';
import { Task } from './Task';
import { TaskType, TaskCategory, TaskStatus, TaskId } from '../types';
import type { ProgressMessage } from '../types';
import SupabaseTasks from '../../../db/supabase/tasks';

export interface GoogleContactsFetcherClient {
  startGoogleContactsSync(opts: {
    miningId: string;
    contactStream: string;
    userId: string;
    userEmail: string;
    accessToken: string;
    refreshToken: string;
  }): Promise<{ data: { totalContacts: number } }>;
  stopGoogleContactsSync(opts: {
    miningId: string;
    canceled: boolean;
  }): Promise<void>;
}

export interface GoogleContactsFetchTaskConfig {
  id?: string;
  miningId: string;
  userId: string;
  userEmail: string;
  outputStream: string;
  fetcherClient: GoogleContactsFetcherClient;
  accessToken: string;
  refreshToken?: string;
}

export class GoogleContactsFetchTask extends Task {
  private fetcherClient: GoogleContactsFetcherClient;

  private outputStream: string;

  private canceled = false;

  private userEmail: string;

  private accessToken: string;

  private refreshToken?: string;

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
    this.fetcherClient = config.fetcherClient;
    this.outputStream = config.outputStream;
    this.userEmail = config.userEmail;
    this.accessToken = config.accessToken;
    this.refreshToken = config.refreshToken;
    this.upstreamDone = true;
  }

  async start(
    tasksResolver: SupabaseTasks,
    redisPublisher?: Redis
  ): Promise<void> {
    await super.start(tasksResolver);

    try {
      const result = await this.fetcherClient.startGoogleContactsSync({
        miningId: this.miningId,
        contactStream: this.outputStream,
        userId: this.userId,
        userEmail: this.userEmail,
        accessToken: this.accessToken,
        refreshToken: this.refreshToken ?? ''
      });

      this.progress.total = result.data.totalContacts;
      this.emitProgress('totalMessages', this.progress.total);
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
    await this.fetcherClient.stopGoogleContactsSync({
      miningId: this.miningId,
      canceled
    });
  }

  onMessage(msg: ProgressMessage): void {
    if (msg.progressType === 'google-contacts-fetched') {
      this.progress.processed = msg.count;
      this.emitProgress('google-contacts-fetched', this.progress.processed);

      if (msg.isCompleted || msg.isCanceled) {
        this.status = msg.isCanceled ? TaskStatus.Canceled : TaskStatus.Done;
      }
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
