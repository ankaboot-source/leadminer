import type { MiningSource } from '~/types/mining';
import type { MiningSourceConfigFlags } from '~/utils/miningSourceConfig';
import { deriveSourceConfig } from '~/utils/miningSourceConfig';
import { updatePassiveMining } from '~/utils/sources';

/**
 * Single write path for enabling/updating passive mining. Shared by the
 * post-run prompt and the /sources toggle so both stay in sync with the
 * persisted source config and the reactive sources list.
 */
export function useEnablePassiveMining() {
  const $leadminerStore = useLeadminerStore();
  const $toast = useToast();
  const isSaving = ref(false);

  async function enablePassiveMining(
    source: MiningSource,
    folders: string[],
    flags: MiningSourceConfigFlags,
  ): Promise<boolean> {
    if (folders.length === 0) return false;

    isSaving.value = true;
    try {
      const mergedConfig = await updatePassiveMining(
        source.email,
        source.type,
        true,
        { flags: { ...flags }, folders: [...folders] },
      );

      const listEntry = $leadminerStore.miningSources.find(
        (entry) => entry.email === source.email && entry.type === source.type,
      );
      if (listEntry) {
        listEntry.passive_mining = true;
        listEntry.config = mergedConfig;
      } else {
        await $leadminerStore.fetchMiningSources();
      }

      const active = $leadminerStore.activeMiningSource;
      if (
        active &&
        active.email === source.email &&
        active.type === source.type
      ) {
        active.config = mergedConfig;
        $leadminerStore.sourceConfig = deriveSourceConfig(mergedConfig);
      }

      return true;
    } catch (error) {
      $toast.add({
        severity: 'error',
        summary: 'Error',
        detail:
          (error as Error).message || 'Failed to enable continuous mining',
        life: 5000,
      });
      return false;
    } finally {
      isSaving.value = false;
    }
  }

  return { isSaving, enablePassiveMining };
}
