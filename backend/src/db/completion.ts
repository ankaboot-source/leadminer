import supabaseClient from '../utils/supabase';
import logger from '../utils/logger';

/**
 * Triggers the mining-completion edge function after extraction succeeds.
 *
 * The edge function reads the fetch task's persisted watermark and updates the
 * mining source (health + `mining.last`), so no watermark logic lives in the
 * backend. Failure is non-fatal: the source keeps its last good cursor and the
 * next cycle retries (at-least-once).
 */
export async function recordMiningCompletion(miningId: string): Promise<void> {
  const { error } = await supabaseClient.functions.invoke('mining-completion', {
    method: 'POST',
    body: { miningId }
  });

  if (error) {
    logger.error('[mining-completion] Failed to record mining completion', {
      miningId,
      error: error.message
    });
    return;
  }

  logger.info('[mining-completion] Recorded mining completion', { miningId });
}

export default recordMiningCompletion;
