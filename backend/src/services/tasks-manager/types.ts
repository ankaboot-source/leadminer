import { Contact, TaskCategory, TaskStatus, TaskType } from '../../db/types';

import RealtimeSSE from '../../utils/helpers/sseHelpers';

export type RedisCommand = 'REGISTER' | 'DELETE';
export type TaskProgressType =
  | 'fetched'
  | 'extracted'
  | 'createdContacts'
  | 'verifiedContacts'
  | 'signatures';

export interface EmailStatusVerifier {
  running: boolean;
}

export interface TaskFetchStreamInfo {
  messagesStream: string;
}

export interface TaskExtractStreamInfo {
  messagesStream: string;
  messagesConsumerGroup: string;
  emailsVerificationStream: string;
}

export interface TaskCleanStreamInfo {
  emailsStream: string;
  emailsConsumerGroup: string;
}

export interface StreamInfo
  extends TaskExtractStreamInfo,
    TaskCleanStreamInfo {}

export interface TaskProgress {
  totalMessages: number;
  fetched: number;
  extracted: number;
  verifiedContacts: number;
  createdContacts: number;
  signatures: number;
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
  details: {
    miningId: string;
    stream: TaskFetchStreamInfo;
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
    stream: TaskExtractStreamInfo;
    progress: {
      extracted: number;
    };
  };
}

export interface TaskClean extends Task {
  category: TaskCategory.Cleaning;
  type: TaskType.Clean;
  details: {
    miningId: string;
    stream: TaskCleanStreamInfo;
    progress: {
      verifiedContacts: number;
      createdContacts: number;
    };
  };
}

export interface TaskEnrich extends Task {
  category: TaskCategory.Enriching;
  type: TaskType.Enrich;
  details: {
    total_enriched: number;
    total_to_enrich: number;
    update_empty_fields_only: boolean;
    error?: string;
    result: {
      token?: string;
      engine: string;
      data: Array<Partial<Contact>>;
      raw_data: Array<unknown>;
    }[];
  };
}

export interface MiningSource {
  source: string;
  type: 'email' | 'file';
}

export interface MiningTask {
  userId: string;
  miningId: string;
  miningSource: MiningSource;
  process: {
    fetch: TaskFetch;
    extract: TaskExtract;
    clean: TaskClean;
    // Temp solution to track signature extraction progress
    signature: Task;
  };
  progress: TaskProgress;
  progressHandlerSSE: RealtimeSSE;
  startedAt: number;
}

/**
 * Represents a task with sensitive data removed.
 */
export interface RedactedTask {
  userId: string;
  miningId: string;
  miningSource: MiningSource;
  processes: {
    [K in TaskType]?: string;
  };
  progress: TaskProgress;
}
