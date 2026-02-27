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

export async function getMiningSources(): Promise<MiningSource[]> {
  const supabase = useSupabaseClient();
  const user = useSupabaseUser();

  if (!user.value) {
    throw new Error('User not authenticated');
  }

  const { data: miningSources, error } = await supabase
    .schema('private')
    .from('mining_sources')
    .select('*');

  if (error) {
    console.error('Error fetching mining sources:', error.message);
    throw error;
  }

  const { data: overviewData, error: overviewError } = await supabase
    .schema('private')
    .rpc('get_mining_source_overview', { user_id: user.value.sub });

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
