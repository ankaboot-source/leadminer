import { SupabaseClient } from '@supabase/supabase-js';
import { Contact } from '../../db/types';

export type NotificationType = 'enrich' | 'clean' | 'extract' | 'signature';

export interface NotificationPayload {
  userId: string;
  type: NotificationType;
  details: {
    signatures: number;
    extracted: Partial<Contact>[];
  };
}

/**
 * Push a new notification to the Supabase `notifications` table.
 */
export async function pushNotificationDB(
  supabase: SupabaseClient,
  { userId, type, details }: NotificationPayload
) {
  const { error } = await supabase
    .schema('private')
    .from('notifications')
    .insert([{ user_id: userId, type, details }]);

  if (error) throw error;
}

export function isUsefulSignatureContent(signature: string): boolean {
  const text = signature.trim();
  const words = text.split(/\s+/);
  const hasURL = /(https?:\/\/|www\.)\S+/i.test(text);
  const hasDigits = /\d{3,}/.test(text);
  const hasSymbols = /[@+]/.test(text);

  const wordsMinMax =
    words.length >= 5 && words.length <= 40 && text.length <= 300;

  // 2. At least one positive signal
  const positive = hasURL || hasDigits || hasSymbols;

  const blocks = [
    /^(Envoyé\s+à\s+partir\s+de|Sent\s+from)\s+(Outlook|Gmail|iPhone|Android)/i
  ];

  const isUseful =
    wordsMinMax && positive && !blocks.some((rx) => rx.test(text));

  return isUseful;
}
