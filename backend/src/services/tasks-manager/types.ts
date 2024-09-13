import RealtimeSSE from '../../utils/helpers/sseHelpers';
import ImapEmailsFetcher from '../imap/ImapEmailsFetcher';

export type RedisCommand = 'REGISTER' | 'DELETE';
export type TaskProgressType =
  | 'fetched'
  | 'extracted'
  | 'createdContacts'
  | 'verifiedContacts';

export enum TaskType {
  Fetch = 'fetch',
  Extract = 'extract',
  Enrich = 'enrich'
}

export enum TaskCategory {
  Mining = 'mining',
  Enrich = 'enrich',
  Activate = 'activate'
}

export enum TaskStatus {
  Running = 'running',
  Canceled = 'canceled',
  Done = 'done'
}

export interface EmailStatusVerifier {
  running: boolean;
}

export interface StreamInfo {
  messagesStreamName: string;
  messagesConsumerGroupName: string;
  emailsStreamName: string;
  emailsConsumerGroupName: string;
}

export interface TaskProgress {
  totalMessages: number;
  fetched: number;
  extracted: number;
  verifiedContacts: number;
  createdContacts: number;
}

export interface Task {
  id?: string;
  userId: string;
  type: TaskType;
  category: TaskCategory;
  status: TaskStatus;
  // skipcq: JS-0323 - details can contain any values
  details: Record<string, any>;
  duration?: number;
  startedAt?: string;
  stoppedAt?: string;
}

export interface TaskFetch extends Task {
  category: TaskCategory.Mining;
  type: TaskType.Fetch;
  instance: ImapEmailsFetcher;
  details: {
    miningId: string;
    stream: StreamInfo;
    progress: {
      totalMessages: number;
      fetched: number;
      folders: string[];
    };
  };
}

export interface TaskExtract extends Task {
  category: TaskCategory.Mining;
  type: TaskType.Extract;
  details: {
    miningId: string;
    stream: StreamInfo;
    progress: {
      extracted: number;
    };
  };
}

export interface TaskVerify extends Task {
  category: TaskCategory.Enrich;
  type: TaskType.Enrich;
  details: {
    miningId: string;
    stream: StreamInfo;
    progress: {
      verifiedContacts: number;
      createdContacts: number;
    };
  };
}

export interface MiningTask {
  userId: string;
  miningId: string;
  process: {
    fetch: TaskFetch;
    extract: TaskExtract;
    enrich: TaskVerify;
  };
  stream: StreamInfo;
  progress: TaskProgress;
  progressHandlerSSE: RealtimeSSE;
  startedAt: number;
}

export interface RedactedTask {
  userId: string;
  miningId: string;
  progress: TaskProgress;
}
