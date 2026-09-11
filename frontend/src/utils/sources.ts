import type { MiningSource, MiningSourceConfig } from '~/types/mining';

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

  const { data: rawSources, error } = await supabase
    .schema('private')
    .from('mining_sources')
    .select('*');

  if (error) {
    console.error('Error fetching mining sources:', error.message);
    throw error;
  }

  const miningSources = (rawSources ?? []) as MiningSource[];

  let overviewData: MiningSourceOverview[] | null = null;
  let overviewError: Error | null = null;

  if (userId) {
    const overviewResponse = await supabase
      .schema('private')
      .rpc('get_mining_source_overview', { p_user_id: userId });

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

/**
 * Applies a namespace-scoped patch through the authenticated, row-locked
 * mining-sources writer. The endpoint returns the canonical persisted config.
 */
export async function updateMiningSourceConfig(
  email: string,
  type: string,
  patch: MiningSourceConfig | Record<string, unknown>,
): Promise<MiningSourceConfig> {
  const { $saasEdgeFunctions } = useNuxtApp();
  const source = await findSourceByEmail(email, type);
  if (!source?.id) {
    throw new Error('Mining source not found');
  }

  const response = await $saasEdgeFunctions<{ config: MiningSourceConfig }>(
    `mining-sources/${encodeURIComponent(source.id)}/config`,
    {
      method: 'PATCH',
      body: patch,
    },
  );

  return response.config;
}

async function findSourceByEmail(email: string, type: string) {
  const supabase = useSupabaseClient();
  const { data, error } = await supabase
    .schema('private')
    .from('mining_sources')
    .select('id, email, type')
    .eq('email', email)
    .eq('type', type)
    .maybeSingle();
  if (error) throw error;
  return data as { id?: string; email: string; type: string } | null;
}

export async function updatePassiveMining(
  email: string,
  type: string,
  value: boolean,
  patch: MiningSourceConfig | Record<string, unknown> = {},
): Promise<MiningSourceConfig> {
  const source = await findSourceByEmail(email, type);
  if (!source?.id) throw new Error('Mining source not found');

  // Send params only; mining-sources merges them and owns the column update.
  const params: Record<string, unknown> = { passive_mining: value };
  if (patch.folders !== undefined) params.folders = patch.folders;
  if (patch.flags !== undefined) params.mining_flags = patch.flags;

  const { $saasEdgeFunctions } = useNuxtApp();
  const response = await $saasEdgeFunctions<{ config: MiningSourceConfig }>(
    `mining-sources/${encodeURIComponent(source.id)}/config`,
    {
      method: 'PATCH',
      body: params,
    },
  );

  return response.config;
}
