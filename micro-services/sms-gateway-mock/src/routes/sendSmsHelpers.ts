import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import type { ProviderName, StoredMessage } from '../types';
import { getEffectiveConfig } from '../store/messageStore';
import { parseBasicAuth } from '../utils/providerAuth';

export function validateProvider(
  provider: string | undefined
): ProviderName | null {
  const VALID_PROVIDERS: ProviderName[] = ['simple-sms-gateway', 'smsgate'];
  if (!provider || !VALID_PROVIDERS.includes(provider as ProviderName)) {
    return null;
  }
  return provider as ProviderName;
}

export function validateSmsgateAuth(
  authHeader: string | undefined
): { username: string; password: string } | null {
  return parseBasicAuth(authHeader ?? null);
}

export type PayloadExtraction =
  | { ok: true; phone: string; message: string }
  | { ok: false; error: { message: string; status: 400 } };

export function extractPayload(
  provider: ProviderName,
  body: unknown
): PayloadExtraction {
  if (provider === 'simple-sms-gateway') {
    const schema = z.object({
      phone: z.string().min(1, 'Phone number is required'),
      message: z.string().min(1, 'Message is required')
    });
    const result = schema.safeParse(body);
    if (!result.success) {
      return {
        ok: false,
        error: {
          message: 'Invalid request: phone and message are required',
          status: 400
        }
      };
    }
    return { ok: true, phone: result.data.phone, message: result.data.message };
  }

  // smsgate
  const schema = z.object({
    textMessage: z.object({
      text: z.string().min(1, 'Text message is required')
    }),
    phoneNumbers: z
      .array(z.string().min(1))
      .min(1, 'At least one phone number is required')
  });
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      ok: false,
      error: {
        message:
          'Invalid request: textMessage.text and phoneNumbers are required',
        status: 400
      }
    };
  }
  const [firstPhone] = result.data.phoneNumbers;
  return { ok: true, phone: firstPhone, message: result.data.textMessage.text };
}

export function recordSimulatedMessage(args: {
  provider: ProviderName;
  phone: string;
  message: string;
  messageLength: number;
  campaignId?: string;
  timestamp: string;
  durationMs: number;
  success: boolean;
  cfg: ReturnType<typeof getEffectiveConfig>;
  messageId?: string;
}): StoredMessage {
  const {
    provider,
    phone,
    message,
    messageLength,
    campaignId,
    timestamp,
    durationMs,
    success,
    cfg,
    messageId
  } = args;
  return {
    id: success && messageId ? messageId : randomUUID(),
    provider,
    campaignId,
    phone,
    body: message,
    bodyLength: messageLength,
    timestamp,
    success,
    providerMessageId: success && messageId ? messageId : undefined,
    httpStatus: success ? 200 : cfg.failStatusCode,
    durationMs
  };
}
