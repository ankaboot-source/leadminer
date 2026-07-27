import type { StoredMessage } from '../types';

export function redactPhone(phone: string): string {
  if (phone.length <= 4) {
    return phone;
  }
  return phone.slice(0, 4) + '*'.repeat(6) + phone.slice(-2);
}

export function redactBody(body: string): string {
  if (body.length <= 50) {
    return body;
  }
  return `${body.slice(0, 50)}...`;
}

export function redactMessage(
  msg: StoredMessage,
  full: boolean
): StoredMessage {
  if (full) {
    return msg;
  }
  return {
    ...msg,
    phone: redactPhone(msg.phone),
    body: redactBody(msg.body)
  };
}
