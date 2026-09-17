import type { EnrichmentTask } from '@/types/enrichment';

export const ENRICHMENT_CATEGORY = 'enriching';

/**
 * PostgREST projection that fetches only the counters the UI needs, instead of
 * the full `details.result` payload (which can reach hundreds of KB).
 */
export const ENRICHMENT_TASK_SELECT =
  'id,status,total_enriched:details->total_enriched,total_to_enrich:details->total_to_enrich';

/**
 * A `private.tasks` row can arrive either projected (flat counters) from our
 * select or full (nested `details`) from a realtime payload. Normalize both.
 */
export interface TaskRow {
  id?: string | null;
  status?: EnrichmentTask['status'] | null;
  details?: Partial<EnrichmentTask['details']> | null;
  total_enriched?: number | null;
  total_to_enrich?: number | null;
}

export function normalizeTask(
  row: TaskRow | null | undefined,
): EnrichmentTask | null {
  if (!row?.id || !row.status) return null;
  return {
    id: row.id,
    status: row.status,
    details: {
      total_enriched: row.total_enriched ?? row.details?.total_enriched ?? 0,
      total_to_enrich: row.total_to_enrich ?? row.details?.total_to_enrich ?? 0,
    },
  };
}

/** First running task in a recency-ordered list, else null. */
export function pickRunningTask(
  rows: TaskRow[] | null | undefined,
): EnrichmentTask | null {
  for (const row of rows ?? []) {
    const task = normalizeTask(row);
    if (task?.status === 'running') return task;
  }
  return null;
}

export function isTaskRunning(
  task: EnrichmentTask | null | undefined,
): boolean {
  return task?.status === 'running';
}

export function isTerminalStatus(
  status: EnrichmentTask['status'] | undefined,
): boolean {
  return Boolean(status) && status !== 'running';
}

export function taskProgress(task: EnrichmentTask | null | undefined): {
  done: number;
  total: number;
} {
  return {
    done: task?.details.total_enriched ?? 0,
    total: task?.details.total_to_enrich ?? 0,
  };
}
