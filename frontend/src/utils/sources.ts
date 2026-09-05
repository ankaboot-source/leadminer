import type { MiningSource, MiningSourceConfig } from '~/types/mining';
import { readSourceConfig } from './miningSourceConfig';

interface MiningSourceOverview {
  source_email: string;
  total_contacts: number;
  last_mining_date: string;
  total_from_last_mining: number;
}

/** Recursively merges `patch` into `target` (returns a new object). */
function deepMerge(
  target: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...target };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete out[key];
    } else if (
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof out[key] === 'object' &&
      !Array.isArray(out[key])
    ) {
      out[key] = deepMerge(
        out[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      out[key] = value;
    }
  }
  return out;
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

async function readConfigForSource(
  email: string,
  type: string,
): Promise<MiningSourceConfig> {
  const supabase = useSupabaseClient();
  const { data, error } = await supabase
    .schema('private')
    .from('mining_sources')
    .select('config')
    .eq('email', email)
    .eq('type', type)
    .maybeSingle();

  if (error) {
    console.error('Error reading mining source config:', error.message);
    throw error;
  }
  return readSourceConfig(
    (data as { config?: MiningSourceConfig } | null)?.config,
  );
}

/**
 * Atomically-ish patched update of a source config: reads the persisted row,
 * deep-merges the patch on top (typed), and writes back. Fixes the historical
 * wholesale-replace bug that wiped sibling keys on every write.
 */
export async function updateMiningSourceConfig(
  email: string,
  type: string,
  patch: MiningSourceConfig | Record<string, unknown>,
): Promise<void> {
  const current = await readConfigForSource(email, type);
  const merged = deepMerge(current, patch as Record<string, unknown>);

  const { error } = await useSupabaseClient()
    .schema('private')
    .from('mining_sources')
    // @ts-expect-error: Issue with nuxt/supabase
    .update({ config: merged })
    .eq('email', email)
    .eq('type', type);

  if (error) {
    console.error('Error updating mining source config:', error.message);
    throw error;
  }
}

export async function updatePassiveMining(
  email: string,
  type: string,
  value: boolean,
  existingConfig: MiningSourceConfig | Record<string, unknown> = {},
): Promise<void> {
  const update: Record<string, unknown> = { passive_mining: value };

  const current = {
    ...existingConfig,
    ...(await readConfigForSource(email, type)),
  };

  if (value) {
    // Enable continuous mining: reset health to active (clear any stale
    // needs_reauth / error), persist the user's folders, and keep everything
    // else (flags, watermark) intact.
    const merge: Record<string, unknown> = {
      health: { state: 'active', last_error: null },
    };
    // Only override folders when the caller explicitly supplies them; an
    // `undefined` here would drop the persisted folder selection on write.
    if (Array.isArray(existingConfig.folders)) {
      merge.folders = existingConfig.folders;
    }
    const merged = deepMerge(current, merge);
    update.config = merged;
  } else {
    // Disabling passive mining should only flip the toggle, keep config.
    update.config = {
      ...current,
      passive_mining_toggled_off_at: new Date().toISOString(),
    };
  }

  const { error } = await useSupabaseClient()
    .schema('private')
    .from('mining_sources')
    .update(update)
    .eq('email', email)
    .eq('type', type);

  if (error) {
    console.error('Error updating passive mining status:', error.message);
    throw error;
  }
}
