import { MiningSourceType } from '../task/types';

export interface FetchStartPayload {
  userId: string;
  miningId: string;
  email?: string;
  boxes?: string[];
  extractSignatures: boolean;
  contactStream: string;
  signatureStream: string;
  since?: string;
  sourceType?: MiningSourceType;
}

export interface FetchStopPayload {
  miningId: string;
  canceled: boolean;
}

export interface FetcherAdapter {
  readonly sourceType: MiningSourceType;
  start(payload: FetchStartPayload): Promise<{ totalMessages: number }>;
  stop(payload: FetchStopPayload): Promise<void>;
  isCompleted: boolean;
  onComplete?: () => void;
}
