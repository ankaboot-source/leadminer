import { defineStore } from 'pinia';
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';

import type { Contact } from '@/types/contact';
import type { EnrichContactResponse, EnrichmentTask } from '@/types/enrichment';
import {
  ENRICHMENT_CATEGORY,
  ENRICHMENT_TASK_SELECT,
  isTaskRunning,
  isTerminalStatus,
  normalizeTask,
  pickRunningTask,
  taskProgress,
  type TaskRow,
} from '@/utils/enrichment';

export type EnrichmentStartOutcome =
  | { status: 'started' }
  | { status: 'no-credits'; total: number; available: number }
  | { status: 'unavailable' }
  | { status: 'failed' };

/**
 * Single source of truth for the user's current enrichment task.
 *
 * - Hydrates from `private.tasks` on demand so a running task survives reloads
 *   and navigation.
 * - Owns exactly one realtime channel, created lazily and reused by every
 *   `EnrichButton` instance.
 * - Emits terminal notifications once per task, even if the button unmounted.
 */
export const useEnrichmentStore = defineStore('enrichment-store', () => {
  const { $api, $i18n } = useNuxtApp();
  const { t } = $i18n;
  const $supabase = useSupabaseClient();
  const $user = useSupabaseUser();
  const $toast = useToast();

  const task = ref<EnrichmentTask | null>(null);
  const isStarting = ref(false);

  const isRunning = computed(() => isTaskRunning(task.value));
  const isActive = computed(() => isStarting.value || isRunning.value);
  const progress = computed(() => taskProgress(task.value));

  let channel: RealtimeChannel | null = null;
  let channelUserId: string | null = null;
  let initInFlight: Promise<void> | null = null;
  const notifiedTaskIds = new Set<string>();

  function getCurrentUserId() {
    const user = $user.value;
    return user?.id || (user as { sub?: string } | null)?.sub;
  }

  function showNotification(
    severity: 'info' | 'error' | 'success',
    detail: string,
    group: 'achievement' | 'enrich-info',
  ) {
    $toast.add({ severity, summary: '', detail, group, life: 5000 });
  }

  function notifyTaskEnded(ended: EnrichmentTask) {
    if (notifiedTaskIds.has(ended.id)) return;
    notifiedTaskIds.add(ended.id);

    const { total_enriched: totalEnriched } = ended.details;
    if (ended.status === 'canceled') {
      showNotification('error', t('enrichment.canceled'), 'achievement');
    } else if (totalEnriched > 0) {
      showNotification(
        'success',
        t('enrichment.completed', {
          n: totalEnriched,
          enriched: totalEnriched.toLocaleString(),
        }),
        'achievement',
      );
    } else {
      showNotification(
        'info',
        t('enrichment.no_additional_info'),
        'enrich-info',
      );
    }
  }

  async function handleTaskUpdate(
    payload: RealtimePostgresChangesPayload<TaskRow>,
  ) {
    const incoming = normalizeTask(payload.new as TaskRow);
    if (!incoming || incoming.id !== task.value?.id) return;

    task.value = incoming;
    if (isTerminalStatus(incoming.status)) {
      notifyTaskEnded(incoming);
      await unsubscribe();
    }
  }

  async function unsubscribe() {
    if (!channel) return;
    await channel.unsubscribe();
    await $supabase.removeChannel(channel);
    channel = null;
    channelUserId = null;
  }

  /** Idempotent: one channel per user, reused across components. */
  async function subscribe() {
    const userId = getCurrentUserId();
    if (!userId) return;
    if (channel && channelUserId === userId) return;
    if (channel && channelUserId !== userId) {
      await $supabase.removeChannel(channel);
      channel = null;
      channelUserId = null;
    }

    channel = $supabase
      .channel(`enrichment-tracker-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'private',
          table: 'tasks',
          filter: `category=eq.${ENRICHMENT_CATEGORY}`,
        },
        handleTaskUpdate,
      )
      .on('system', { event: 'reconnected' }, () => init());
    channelUserId = userId;
    channel.subscribe();
  }

  async function loadActive(userId: string) {
    const { data, error } = await $supabase
      .schema('private')
      .from('tasks')
      .select(ENRICHMENT_TASK_SELECT)
      .eq('user_id', userId)
      .eq('category', ENRICHMENT_CATEGORY)
      .eq('status', 'running')
      .order('started_at', { ascending: false })
      .limit(1);

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[enrichment] failed to load active task', error);
      return;
    }

    const active = pickRunningTask(data as TaskRow[] | null);
    task.value = active;
    if (active) await subscribe();
  }

  /** Fetch the running task (if any) and start observing it. */
  function init(): Promise<void> {
    const userId = getCurrentUserId();
    if (!userId) return Promise.resolve();
    if (initInFlight) return initInFlight;

    initInFlight = loadActive(userId).finally(() => {
      initInFlight = null;
    });
    return initInFlight;
  }

  /** Adopt a task returned by a start request or a realtime payload. */
  async function track(next: EnrichmentTask | null) {
    task.value = next;
    if (isTaskRunning(next)) await subscribe();
  }

  async function start(
    url: string,
    body: Record<string, unknown>,
  ): Promise<EnrichmentStartOutcome> {
    isStarting.value = true;
    try {
      const response = await $api.raw<EnrichContactResponse>(url, {
        method: 'POST',
        body,
        ignoreResponseError: true,
      });
      const data = response._data;

      if (response.status === 402 && data?.total && data?.available) {
        return {
          status: 'no-credits',
          total: data.total,
          available: data.available,
        };
      }
      if (response.status === 503) return { status: 'unavailable' };

      const started = normalizeTask(data?.task as TaskRow | undefined);
      if (response.status === 200 && started) {
        await track(started);
        if (isTerminalStatus(started.status)) {
          // Sync-only run already finished within the request.
          notifyTaskEnded(started);
        } else {
          showNotification(
            'info',
            t('enrichment.started_message'),
            'enrich-info',
          );
        }
        return { status: 'started' };
      }
      return { status: 'failed' };
    } finally {
      isStarting.value = false;
    }
  }

  function startSingle(
    updateEmptyFieldsOnly: boolean,
    contact: Partial<Contact>,
  ) {
    return start('/enrich/person/', {
      updateEmptyFieldsOnly,
      enrichAllContacts: false,
      contact,
    });
  }

  function startBulk(
    updateEmptyFieldsOnly: boolean,
    enrichAll: boolean,
    contacts?: Partial<Contact>[],
  ) {
    return start('/enrich/person/bulk', {
      updateEmptyFieldsOnly,
      enrichAllContacts: enrichAll,
      contacts: enrichAll ? undefined : contacts,
    });
  }

  async function reset() {
    await unsubscribe();
    task.value = null;
    isStarting.value = false;
    notifiedTaskIds.clear();
  }

  return {
    task,
    isStarting,
    isRunning,
    isActive,
    progress,
    init,
    track,
    startSingle,
    startBulk,
    subscribe,
    unsubscribe,
    reset,
  };
});
