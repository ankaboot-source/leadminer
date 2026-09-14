import supabaseClient from '../utils/supabase';
import logger from '../utils/logger';

// Fail with a clear error before Kong's ~60s upstream read timeout.
const REFINE_CONTACTS_TIMEOUT_MS = 55_000;

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
 * Refine a user's contacts, racing a timeout so failures surface before Kong's
 * ~60s upstream read timeout (instead of a generic gateway error).
 */
export async function refineContacts(userId: string) {
  const refine = supabaseClient
    .schema('private')
    .rpc('refine_persons', { p_user_id: userId })
    .then(({ error }) => {
      if (error) throw error;
    });

  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(
          `Refine contacts for user ${userId} timed out after ${REFINE_CONTACTS_TIMEOUT_MS}ms`
        )
      );
    }, REFINE_CONTACTS_TIMEOUT_MS);
  });

  try {
    await Promise.race([refine, timeout]);
  } catch (error) {
    logger.error('Failed to refine contacts', {
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
