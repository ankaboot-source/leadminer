import type { MiningType } from '~/types/mining';

export function requiresActiveMiningSource(miningType: MiningType): boolean {
  return miningType === 'email';
}
