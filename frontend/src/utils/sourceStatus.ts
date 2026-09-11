import type { MiningSource } from '~/types/mining';
import { deriveSourceState } from './miningSourceConfig';

export type SourceHealthState = 'active' | 'needs_reauth' | 'error';
export type BadgeSeverity = 'success' | 'info' | 'warn' | 'danger';

export interface SourceStatusBadge {
  labelKey: string;
  severity: BadgeSeverity;
  icon?: string;
}

export interface ActiveMiningLike {
  email?: string;
  status?: string;
}

export interface SourceStatus {
  health: SourceHealthState;
  badge: SourceStatusBadge;
  /** Only a re-auth is actionable from the source card. */
  showReconnect: boolean;
  isActiveMiningSource: boolean;
}

function activeBadge(miningStatus?: string): SourceStatusBadge {
  if (miningStatus === 'done') {
    return { labelKey: 'mining_status_done', severity: 'info' };
  }
  if (miningStatus === 'canceled') {
    return { labelKey: 'mining_status_canceled', severity: 'info' };
  }
  return {
    labelKey:
      miningStatus === 'running' ? 'mining_status_running' : 'mining_in_progress',
    severity: 'info'
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
  activeMining?: ActiveMiningLike
): SourceStatus {
  const health: SourceHealthState = source
    ? deriveSourceState(source).state
    : 'active';

  const isActiveMiningSource = Boolean(
    source?.email && activeMining?.email === source.email
  );

  if (health === 'needs_reauth') {
    return {
      health,
      badge: {
        labelKey: 'credential_expired',
        severity: 'danger',
        icon: 'pi pi-exclamation-triangle'
      },
      showReconnect: true,
      isActiveMiningSource
    };
  }

  if (isActiveMiningSource) {
    return {
      health,
      badge: activeBadge(activeMining?.status),
      showReconnect: false,
      isActiveMiningSource
    };
  }

  if (health === 'error') {
    return {
      health,
      badge: {
        labelKey: 'mining_status_failed',
        severity: 'danger',
        icon: 'pi pi-exclamation-triangle'
      },
      showReconnect: false,
      isActiveMiningSource
    };
  }

  return {
    health,
    badge: { labelKey: 'connected', severity: 'success' },
    showReconnect: false,
    isActiveMiningSource
  };
}

export default deriveSourceStatus;
