import type { MiningSource } from '~/types/mining';
import { SourceBadge, SourceHealthState, TaskStatus } from '~/types/enums';
import { deriveSourceState } from './miningSourceConfig';

export type BadgeSeverity = 'success' | 'info' | 'warn' | 'danger';

export interface SourceStatusBadge {
  labelKey: SourceBadge;
  severity: BadgeSeverity;
  icon?: string;
}

export interface ActiveMiningLike {
  email?: string;
  status?: TaskStatus | string;
}

export interface SourceStatus {
  health: SourceHealthState;
  badge: SourceStatusBadge;
  /** Only a re-auth is actionable from the source card. */
  showReconnect: boolean;
  isActiveMiningSource: boolean;
}

function activeBadge(miningStatus?: string): SourceStatusBadge {
  if (miningStatus === TaskStatus.Done) {
    return { labelKey: SourceBadge.MiningStatusDone, severity: 'info' };
  }
  if (miningStatus === TaskStatus.Canceled) {
    return { labelKey: SourceBadge.MiningStatusCanceled, severity: 'info' };
  }
  return {
    labelKey:
      miningStatus === TaskStatus.Running
        ? SourceBadge.MiningStatusRunning
        : SourceBadge.MiningInProgress,
    severity: 'info',
  };
}

/**
 * Single source of truth for a source's health badge.
 *
 * `health.state` (from the persisted config) wins; the sender's SMTP
 * availability (`isValid`) is deliberately NOT consulted here — it is a
 * separate concern and previously surfaced as a misleading
 * "credential expired" badge on healthy IMAP sources.
 */
export function deriveSourceStatus(
  source: MiningSource | undefined,
  activeMining?: ActiveMiningLike,
): SourceStatus {
  const health: SourceHealthState = source
    ? deriveSourceState(source).state
    : SourceHealthState.Active;

  const isActiveMiningSource = Boolean(
    source?.email && activeMining?.email === source.email,
  );

  if (health === SourceHealthState.NeedsReauth) {
    return {
      health,
      badge: {
        labelKey: SourceBadge.CredentialExpired,
        severity: 'danger',
        icon: 'pi pi-exclamation-triangle',
      },
      showReconnect: true,
      isActiveMiningSource,
    };
  }

  if (isActiveMiningSource) {
    return {
      health,
      badge: activeBadge(activeMining?.status),
      showReconnect: false,
      isActiveMiningSource,
    };
  }

  if (health === SourceHealthState.Error) {
    return {
      health,
      badge: {
        labelKey: SourceBadge.MiningStatusFailed,
        severity: 'danger',
        icon: 'pi pi-exclamation-triangle',
      },
      showReconnect: false,
      isActiveMiningSource,
    };
  }

  return {
    health,
    badge: { labelKey: SourceBadge.Connected, severity: 'success' },
    showReconnect: false,
    isActiveMiningSource,
  };
}

export default deriveSourceStatus;
