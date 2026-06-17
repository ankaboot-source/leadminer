import supabaseClient from '../utils/supabase';

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
    throw error;
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
