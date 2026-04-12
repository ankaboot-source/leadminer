export { TaskType, TaskCategory, TaskStatus } from '../../db/types';

export const TaskId = {
  Fetch: 'fetch',
  Extract: 'extract',
  Clean: 'clean',
  Signature: 'signature'
} as const;

export type TaskIdValue = (typeof TaskId)[keyof typeof TaskId];

export type StreamRole = Exclude<TaskIdValue, 'fetch'>;

export interface TaskProgress {
  total: number;
  processed: number;
}

export interface StreamPipe {
  streamName: string;
  consumerGroup?: string;
  role?: string;
}

export interface ProgressMessage {
  miningId: string;
  progressType: string;
  count: number;
  isCompleted?: boolean;
  isCanceled?: boolean;
}

export interface MiningSource {
  type: 'email' | 'file' | 'pst' | 'google';
  source: string;
}

export interface StreamInfo {
  streamName: string;
  consumerGroup?: string;
  role: StreamRole;
}

export interface StreamCommand {
  miningId: string;
  command: 'REGISTER' | 'DELETE';
  streams: StreamInfo[];
}

export interface ProgressLink {
  upstreamIds: string[];
  totalFrom?: string;
  skipTotal?: boolean;
}

export interface RedactedTask {
  userId: string;
  miningId: string;
  miningSource: MiningSource;
  progress: Record<string, number>;
  processes: Record<string, string | undefined>;
}
