import { randomUUID } from 'node:crypto';
import type {
  Config,
  DeepPartial,
  GlobalConfig,
  MockState,
  ProviderName,
  ProviderOverride,
  StoredMessage
} from '../types';
import ENV from '../config';

export const defaultGlobalConfig: GlobalConfig = {
  successRate: 1.0,
  delayMs: 0,
  failMessage: 'Mock gateway error',
  failStatusCode: 500,
  sequentialId: true,
  idPrefix: 'mock_'
};

export const defaultProvidersConfig: Record<
  ProviderName,
  ProviderOverride | undefined
> = {
  smsgate: undefined,
  'simple-sms-gateway': undefined
};

const MAX_MESSAGES = ENV.SMS_GATEWAY_MOCK_MAX_MESSAGES;

const state: MockState = {
  config: {
    global: { ...defaultGlobalConfig },
    providers: { ...defaultProvidersConfig }
  },
  sendSmsCounter: 0,
  messageStore: new Map<string, StoredMessage>(),
  campaignIndex: new Map<string, Set<string>>(),
  messageOrder: []
};

export function addMessage(message: StoredMessage): void {
  // Ring buffer: drop oldest when full
  if (state.messageStore.size >= MAX_MESSAGES) {
    const oldestId = state.messageOrder.shift();
    if (oldestId) {
      const oldest = state.messageStore.get(oldestId);
      state.messageStore.delete(oldestId);
      if (oldest?.campaignId) {
        const idx = state.campaignIndex.get(oldest.campaignId);
        if (idx) {
          idx.delete(oldestId);
          if (idx.size === 0) {
            state.campaignIndex.delete(oldest.campaignId);
          }
        }
      }
    }
  }

  state.messageStore.set(message.id, message);
  state.messageOrder.push(message.id);

  if (message.campaignId) {
    if (!state.campaignIndex.has(message.campaignId)) {
      state.campaignIndex.set(message.campaignId, new Set());
    }
    const ids = state.campaignIndex.get(message.campaignId);
    if (ids) {
      ids.add(message.id);
    }
  }
}

export function clearMessageStore(): void {
  state.messageStore.clear();
  state.campaignIndex.clear();
  state.messageOrder = [];
}

export function getState(): MockState {
  return state;
}

export function peekMessage(id: string): StoredMessage | undefined {
  return state.messageStore.get(id);
}

export function getMessagesByCampaign(campaignId: string): StoredMessage[] {
  const ids = state.campaignIndex.get(campaignId);
  if (!ids) return [];
  return [...ids]
    .map((id) => state.messageStore.get(id))
    .filter((m): m is StoredMessage => m !== undefined);
}

export function getMessageCount(): number {
  return state.messageStore.size;
}

export function resetState(): void {
  state.config = {
    global: { ...defaultGlobalConfig },
    providers: { ...defaultProvidersConfig }
  };
  state.sendSmsCounter = 0;
  clearMessageStore();
}

export function updateConfig(partial: DeepPartial<Config>): Config {
  if (partial.global) {
    state.config.global = {
      ...state.config.global,
      ...partial.global
    };
  }

  if (partial.providers) {
    state.config.providers = {
      ...state.config.providers,
      ...partial.providers
    };
  }

  return state.config;
}

export function getEffectiveConfig(provider?: string): {
  successRate: number;
  delayMs: number;
  failMessage: string;
  failStatusCode: number;
  sequentialId: boolean;
  idPrefix: string;
} {
  const { global } = state.config;
  if (
    !provider ||
    !(provider in state.config.providers) ||
    !state.config.providers[provider as keyof typeof state.config.providers]
  ) {
    return global;
  }
  const override =
    state.config.providers[provider as keyof typeof state.config.providers];
  if (!override) {
    return global;
  }
  return {
    successRate: override.successRate ?? global.successRate,
    delayMs: override.delayMs ?? global.delayMs,
    failMessage: override.failMessage ?? global.failMessage,
    failStatusCode: override.failStatusCode ?? global.failStatusCode,
    sequentialId: global.sequentialId,
    idPrefix: global.idPrefix
  };
}

export function generateMessageId(
  cfg: ReturnType<typeof getEffectiveConfig>
): string {
  state.sendSmsCounter += 1;
  if (cfg.sequentialId) {
    return `${cfg.idPrefix}${state.sendSmsCounter}`;
  }
  return `${cfg.idPrefix}${randomUUID()}`;
}
