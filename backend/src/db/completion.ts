import ENV from '../config';
import logger from '../utils/logger';

export interface PassiveCompletionPayload {
  mining_id: string;
  mined_count: number;
  folders_mined: string[];
  watermark: {
    folders: Record<
      string,
      { uidvalidity: string; last_uid: number; updated_at: string }
    >;
  } | null;
}

/**
 * Records a successful passive-mining run's watermark + summary on the mining
 * source, via the centralized mining-sources edge function (PATCH /:id/config).
 *
 * Called from Pipeline.complete() only (success path). The edge function does
 * the atomic, row-locked deep merge so concurrent writers never lose keys.
 *
 * Failure here is non-fatal to the mining run itself — the watermark simply
 * stays at the last good run and the next cycle re-attempts it (at-least-once).
 */
export async function recordPassiveCompletion(
  sourceId: string,
  payload: PassiveCompletionPayload
): Promise<void> {
  try {
    if (!payload.watermark) {
      logger.info(
        `[passive-completion] No watermark for ${sourceId}, skipping record-completion`,
        { mining_id: payload.mining_id }
      );
      return;
    }

    const url = `${ENV.SUPABASE_PROJECT_URL.replace(/\/$/, '')}/functions/v1/mining-sources/${encodeURIComponent(sourceId)}/config`;

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ENV.SUPABASE_SECRET_PROJECT_TOKEN}`
      },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        health: {
          state: 'active',
          last_run_at: new Date().toISOString(),
          last_error: null
        },
        mining: {
          last: {
            mining_id: payload.mining_id,
            mined_count: payload.mined_count,
            folders_mined: payload.folders_mined,
            updated_at: new Date().toISOString(),
            folders: payload.watermark.folders
          }
        }
      })
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      logger.error('Failed to record passive completion', {
        sourceId,
        mining_id: payload.mining_id,
        status: response.status,
        body
      });
      return;
    }

    logger.info('[passive-completion] Recorded passive completion', {
      sourceId,
      mining_id: payload.mining_id,
      folders: payload.folders_mined
    });
  } catch (err) {
    logger.error('Failed to record passive completion', {
      sourceId,
      mining_id: payload.mining_id,
      error: err instanceof Error ? err.message : String(err)
    });
  }
}
