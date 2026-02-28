import type { MiningTask } from '~/types/mining';

type SourceStatusLabelKey =
  | 'connected'
  | 'credential_expired'
  | 'mining_status_running'
  | 'mining_status_done'
  | 'mining_status_canceled'
  | 'mining_in_progress';

export interface SourceStatusBadge {
  labelKey: SourceStatusLabelKey;
  severity: 'success' | 'warn' | 'info';
  icon?: string;
}

interface ResolveSourceStatusBadgeInput {
  isValid: boolean;
  isActiveMiningSource: boolean;
  miningStatus?: MiningTask['status'];
}

export function resolveSourceStatusBadge(
  input: ResolveSourceStatusBadgeInput,
): SourceStatusBadge {
  if (!input.isValid) {
    return {
      labelKey: 'credential_expired',
      severity: 'warn',
      icon: 'pi pi-exclamation-triangle',
    };
  }

  if (input.isActiveMiningSource) {
    if (input.miningStatus === 'done') {
      return {
        labelKey: 'mining_status_done',
        severity: 'info',
      };
    }

    if (input.miningStatus === 'canceled') {
      return {
        labelKey: 'mining_status_canceled',
        severity: 'info',
      };
    }

    return {
      labelKey:
        input.miningStatus === 'running'
          ? 'mining_status_running'
          : 'mining_in_progress',
      severity: 'info',
    };
  }

  return {
    labelKey: 'connected',
    severity: 'success',
  };
}
