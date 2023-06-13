import RealtimeSSE from '../../utils/helpers/sseHelpers';
import ImapEmailsFetcher from '../imap/ImapEmailsFetcher';

export interface TaskProgress {
  totalMessages: number;
  fetched: number;
  extracted: number;
  fetcherStatus?: FetcherStatus;
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
  startedAt: number;
}

export type FetcherStatus = 'completed' | 'running';

export type ProgressType = 'fetched' | 'extracted';

export type RedisCommand = 'REGISTER' | 'DELETE';

export interface RedactedFetcherData {
  status: FetcherStatus;
  folders: string[];
}

export interface RedactedTask {
  userId: string;
  miningId: string;
  progress: TaskProgress;
  fetcher: RedactedFetcherData;
}
