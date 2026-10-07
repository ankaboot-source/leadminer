import supabaseClient from '../utils/supabase';
import { edgeFunctionError } from '../utils/edgeFunctionError';

export async function mailMiningComplete(miningId: string) {
  const { error } = await supabaseClient.functions.invoke(
    'mail/mining-complete',
    {
      method: 'POST',
      body: {
        miningId
      }
    }
  );

  if (error) {
    throw edgeFunctionError('mail/mining-complete', error);
  }
}

/**
 * Refines contacts in database.
 */
export async function refineContacts(userId: string) {
  const { error } = await supabaseClient
    .schema('private')
    .rpc('refine_persons', { p_user_id: userId });
  if (error) throw error;
}
