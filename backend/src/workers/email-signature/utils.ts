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

  const hasURL = /(https?:\/\/|www\.)\S+/i.test(text);
  const hasDigits = /\d{3,}/.test(text);
  const hasMultipleWords = text.split(/\s+/).length >= 5;
  const hasSymbols = /[@+:]/.test(text); // Common in phone/email/title formats

  const useful = hasURL || hasDigits || hasSymbols || hasMultipleWords;

  return useful;
}
