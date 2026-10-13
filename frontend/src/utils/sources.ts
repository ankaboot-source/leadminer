import type { MiningSource, MiningSourceConfig } from '~/types/mining';
import type { BoxNode } from '~/utils/boxes';

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

/**
 * List-only fetch: the mining_sources rows WITHOUT the per-source stats
 * RPC. Used by pages that only need the source list (/mine, dialogs).
 *
 * Narrow select: only the columns the app reads (id, email, type,
 * passive_mining, config). Verified no other column (credentials bytea,
 * user_id, created_at, config_revision) is read anywhere in frontend/src.
 */
export async function getMiningSourcesList(): Promise<MiningSource[]> {
  const supabase = useSupabaseClient();
  const user = useSupabaseUser();

  if (!user.value) {
    throw new Error('User not authenticated');
  }

  const { data: rawSources, error } = await supabase
    .schema('private')
    .from('mining_sources')
    .select('id, email, type, passive_mining, config');

  if (error) {
    console.error('Error fetching mining sources:', error.message);
    throw error;
  }

  return (rawSources ?? []) as MiningSource[];
}

/**
 * Overview-only fetch: the per-source stats RPC (total contacts, last
 * mining date). Only /sources renders these; every other consumer uses
 * the list-only fetch above.
 */
export async function getMiningSourceOverview(): Promise<
  Map<string, MiningSourceOverview>
> {
  const supabase = useSupabaseClient();
  const user = useSupabaseUser();
  const overviewMap = new Map<string, MiningSourceOverview>();

  const userId = user.value?.id || (user.value as { sub?: string } | null)?.sub;
  if (!userId) {
    return overviewMap;
  }

  const { data: overviewData, error: overviewError } = await supabase
    .schema('private')
    .rpc('get_mining_source_overview', { p_user_id: userId });

  if (overviewError) {
    console.error(
      'Error fetching mining source overview:',
      overviewError.message,
    );
    return overviewMap;
  }

  for (const row of (overviewData as MiningSourceOverview[] | null) ?? []) {
    overviewMap.set(row.source_email, row);
  }

  return overviewMap;
}

function applyOverviewToSources(
  miningSources: MiningSource[],
  overviewMap: Map<string, MiningSourceOverview>,
): MiningSource[] {
  return (miningSources || []).map((source) => {
    const overview = overviewMap.get(source.email);
    return {
      ...source,
      totalContacts: overview?.total_contacts ?? 0,
      totalFromLastMining: overview?.total_from_last_mining ?? 0,
      lastMiningDate: overview?.last_mining_date ?? undefined,
    };
  });
}

/**
 * Combined fetch: source list + overview stats. Prefer
 * getMiningSourcesList() unless the caller renders the stats (only
 * /sources does).
 */
export async function getMiningSources(): Promise<MiningSource[]> {
  const [miningSources, overviewMap] = await Promise.all([
    getMiningSourcesList(),
    getMiningSourceOverview(),
  ]);

  return applyOverviewToSources(miningSources, overviewMap);
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

/**
 * Fetches the IMAP folder tree for a specific source. Used when a source has
 * no recently-mined folders yet, so the passive-mining dialog can still offer
 * a folder list. Resolves credentials by email server-side, so it works for
 * non-active sources, and never touches the active tree in the store.
 */
export async function fetchSourceFolders(
  source: Pick<MiningSource, 'email' | 'type'>,
): Promise<BoxNode[]> {
  const { $api } = useNuxtApp();
  const { data } = await $api<{ data: { folders: BoxNode[] } }>('/imap/boxes', {
    method: 'POST',
    body: { email: source.email, type: source.type },
  });
  return data?.folders ?? [];
}
