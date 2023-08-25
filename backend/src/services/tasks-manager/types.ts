import { Queue, QueueEvents, Worker } from 'bullmq';
import RealtimeSSE from '../../utils/helpers/sseHelpers';
import ImapEmailsFetcher from '../imap/ImapEmailsFetcher';

export interface TaskProgress {
  totalMessages: number;
  fetched: number;
  extracted: number;
  verified: number;
  toVerify: number;
  fetcherStatus?: TaskStatus;
  extractorStatus?: TaskStatus;
}
export interface Task {
  userId: string;
  miningId: string;
  stream: {
    streamName: string;
    consumerGroupName: string;
  };
  progress: TaskProgress;
  fetcher: ImapEmailsFetcher;
  progressHandlerSSE: RealtimeSSE;
  emailStatusVerifier: EmailStatusVerifier;
  startedAt: number;
}

export type TaskStatus = 'completed' | 'running';

export type ProgressType = 'fetched' | 'extracted' | 'verified' | 'toVerify';

export type RedisCommand = 'REGISTER' | 'DELETE';

export interface RedactedFetcherData {
  status: TaskStatus;
  folders: string[];
}

export interface EmailStatusVerifier {
  emailVerificationWorker: Worker;
  emailVerificationQueue: Queue;
  emailVerificationQueueEvents: QueueEvents;
}

export interface RedactedEmailStatusVerifierData {
  status: TaskStatus;
}

export interface RedactedTask {
  userId: string;
  miningId: string;
  progress: TaskProgress;
  fetcher: RedactedFetcherData;
}
