import RealtimeSSE from '../../utils/helpers/sseHelpers';
import ImapEmailsFetcher from '../imap/ImapEmailsFetcher';

/**
 * Represents a mining task.
 */
export interface Task {
  userId: string;
  miningId: string;
  stream: {
    streamName: string;
    consumerGroupName: string;
  };
  progress: {
    totalMessages: number;
    fetched: number;
    extracted: number;
  };
  fetcher: ImapEmailsFetcher;
  progressHandlerSSE: RealtimeSSE;
}
