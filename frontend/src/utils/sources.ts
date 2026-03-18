import type { MiningSource } from '~/types/mining';

interface MiningSourceOverview {
  source_email: string;
  total_contacts: number;
  last_mining_date: string;
  total_from_last_mining: number;
}

export function updateMiningSourcesValidity(
  miningSources: MiningSource[],
  activeMiningSource: MiningSource,
  isValid: boolean,
) {
  function updateValidity(current: MiningSource): MiningSource {
    if (current.email === activeMiningSource?.email) {
      current.isValid = isValid;
    }
    return current;
  }

  return miningSources.map(updateValidity);
}

export function updateMiningSourcesValidityFromUnavailable(
  miningSources: MiningSource[],
  unavailableEmails: string[],
) {
  const unavailableSet = new Set(
    unavailableEmails.map((email) => email.toLowerCase()),
  );

  return miningSources.map((source) => ({
    ...source,
    isValid: !unavailableSet.has(source.email.toLowerCase()),
  }));
}

export async function getMiningSources(): Promise<MiningSource[]> {
  const supabase = useSupabaseClient();
  const user = useSupabaseUser();

  if (!user.value) {
    throw new Error('User not authenticated');
  }

  const userId = user.value.id || (user.value as { sub?: string } | null)?.sub;

  const { data: miningSources, error } = await supabase
    // @ts-expect-error: Issue with nuxt/supabase
    .schema('private')
    .from('mining_sources')
    .select('*');

  if (error) {
    console.error('Error fetching mining sources:', error.message);
    throw error;
  }

  let overviewData: MiningSourceOverview[] | null = null;
  let overviewError: Error | null = null;

  if (userId) {
    const overviewResponse = await supabase
      // @ts-expect-error: Issue with nuxt/supabase
      .schema('private')
      .rpc('get_mining_source_overview', { user_id: userId });

    overviewData = (overviewResponse.data as MiningSourceOverview[]) ?? null;
    overviewError = overviewResponse.error;
  }

  if (overviewError) {
    console.error(
      'Error fetching mining source overview:',
      overviewError.message,
    );
  }

  const overviewMap = new Map<string, MiningSourceOverview>();
  if (overviewData) {
    for (const row of overviewData as MiningSourceOverview[]) {
      overviewMap.set(row.source_email, row);
    }
  }

  const sourcesWithStats: MiningSource[] = (miningSources || []).map(
    (source) => {
      const overview = overviewMap.get(source.email);
      return {
        ...source,
        totalContacts: overview?.total_contacts ?? 0,
        totalFromLastMining: overview?.total_from_last_mining ?? 0,
        lastMiningDate: overview?.last_mining_date ?? undefined,
      };
    },
  );

  return sourcesWithStats;
}

export async function updatePassiveMining(
  email: string,
  type: string,
  value: boolean,
): Promise<void> {
  const { error } = await useSupabaseClient()
    // @ts-expect-error: Issue with nuxt/supabase
    .schema('private')
    .from('mining_sources')
    .update({ passive_mining: value })
    .eq('email', email)
    .eq('type', type);

  if (error) {
    console.error('Error updating passive mining status:', error.message);
    throw error;
  }
}
