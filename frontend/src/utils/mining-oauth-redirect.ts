import type { MiningSource } from '@/types/mining';

type PostOauthSourceSelectionInput = {
  querySource?: string;
  miningSources: MiningSource[];
  isLoadingMiningSources: boolean;
};

type PostOauthSourceSelectionResult =
  | { status: 'wait' }
  | { status: 'fallback' }
  | { status: 'select'; source: MiningSource };

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function findMiningSourceByEmail(
  miningSources: MiningSource[],
  email: string,
) {
  const normalizedEmail = normalizeEmail(email);

  return miningSources.find(
    (source) => normalizeEmail(source.email) === normalizedEmail,
  );
}

export function resolvePostOauthSourceSelection({
  querySource,
  miningSources,
  isLoadingMiningSources,
}: PostOauthSourceSelectionInput): PostOauthSourceSelectionResult {
  if (!querySource) {
    return { status: 'fallback' };
  }

  const selectedSource = findMiningSourceByEmail(miningSources, querySource);

  if (selectedSource) {
    return {
      status: 'select',
      source: selectedSource,
    };
  }

  if (isLoadingMiningSources) {
    return { status: 'wait' };
  }

  return { status: 'fallback' };
}
