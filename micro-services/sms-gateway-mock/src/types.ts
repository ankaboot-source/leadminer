export interface StoredMessage {
  id: string;
  provider: string;
  campaignId?: string;
  phone: string;
  body: string;
  bodyLength: number;
  timestamp: string;
  success: boolean;
  providerMessageId?: string;
  httpStatus: number;
  durationMs?: number;
}

export interface ProviderOverride {
  successRate?: number;
  failStatusCode?: number;
  failMessage?: string;
  delayMs?: number;
}

export type ProviderName = 'simple-sms-gateway' | 'smsgate';

export interface GlobalConfig {
  successRate: number;
  delayMs: number;
  failMessage: string;
  failStatusCode: number;
  sequentialId: boolean;
  idPrefix: string;
}

export interface Config {
  global: GlobalConfig;
  providers: Record<ProviderName, ProviderOverride | undefined>;
}

export interface ProvidersConfig {
  smsgate?: ProviderOverride;
  'simple-sms-gateway'?: ProviderOverride;
}

export interface MockState {
  config: Config;
  sendSmsCounter: number;
  messageStore: Map<string, StoredMessage>;
  campaignIndex: Map<string, Set<string>>;
  messageOrder: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export interface ResetMockServerOptions {
  config?: DeepPartial<Config>;
}
