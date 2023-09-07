import RealtimeSSE from '../../utils/helpers/sseHelpers';
import ImapEmailsFetcher from '../imap/ImapEmailsFetcher';

export interface TaskProgress {
  totalMessages: number;
  fetched: number;
  extracted: number;
  verifiedContacts: number;
  createdContacts: number;
  fetcherStatus?: FetcherStatus;
}

export interface StreamInfo {
  messagesStreamName: string;
  messagesConsumerGroupName: string;
  emailsStreamName: string;
  emailsConsumerGroupName: string;
}
export interface Task {
  userId: string;
  miningId: string;
  stream: StreamInfo;
  progress: TaskProgress;
  fetcher: ImapEmailsFetcher;
  progressHandlerSSE: RealtimeSSE;
  startedAt: number;
}

export type FetcherStatus = 'completed' | 'running';

export type ProgressType =
  | 'fetched'
  | 'extracted'
  | 'createdContacts'
  | 'verifiedContacts';

export type RedisCommand = 'REGISTER' | 'DELETE';

export interface RedactedFetcherData {
  status: FetcherStatus;
  folders: string[];
}

export interface EmailStatusVerifier {
  running: boolean;
}

export interface RedactedTask {
  userId: string;
  miningId: string;
  progress: TaskProgress;
  fetcher: RedactedFetcherData;
}
