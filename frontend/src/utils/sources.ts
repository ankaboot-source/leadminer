import type { MiningSource } from '~/types/mining';
/**
 * Updates the validity of mining sources based on the provided active mining source.
 * @param miningSources - An array of mining sources.
 * @param activeMiningSource - The active mining source to be updated.
 * @param isValid - The validity status to set for the mining source.
 * @returns An updated array of mining sources with validity changes.
 */
export function updateMiningSourcesValidity(
  miningSources: MiningSource[],
  activeMiningSource: MiningSource,
  isValid: boolean,
) {
  /**
   * Updates the validity of mining sources based on the provided active mining source.
   * @param {MiningSource} current - The current mining source being processed.
   * @returns {MiningSource} The updated mining source.
   */
  function updateValidity(current: MiningSource): MiningSource {
    if (current.email === activeMiningSource?.email) {
      current.isValid = isValid;
    }
    return current;
  }

  return miningSources.map(updateValidity);
}

export async function getMiningSources(): Promise<MiningSource[]> {
  const { data, error } = await useSupabaseClient()
    // @ts-expect-error: Issue with nuxt/supabase
    .schema('private')
    .from('mining_sources')
    .select('*');

  if (error) {
    console.error('Error fetching mining sources:', error.message);
    throw error;
  }

  return data;
}
