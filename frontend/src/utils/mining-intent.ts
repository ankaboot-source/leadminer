import type { AlreadyMinedFolder } from '~/types/mining';
import { FolderStatus, MiningRunMode } from '~/types/enums';
import type { BoxNode } from '~/utils/boxes';

/**
 * What a "start mining" click should do for a given selection. Centralizes the
 * resume / mixed / all-mined / run decision so the panel is a thin switch.
 */
export type MiningIntent =
  | { kind: 'resume'; folders: string[] }
  | { kind: 'mixed'; folders: AlreadyMinedFolder[] }
  | { kind: 'all-mined' }
  | { kind: 'run'; mode: MiningRunMode };

/** Incremental when any selected folder has a persisted watermark, else full. */
export function resolveRunMode(nodes: BoxNode[]): MiningRunMode {
  return nodes.some((node) => node.watermark)
    ? MiningRunMode.Incremental
    : MiningRunMode.Full;
}

/**
 * Precedence mirrors the historical behavior:
 *   1. folders with new messages -> confirm a resume scoped to those folders
 *   2. some (not all) already up to date -> mixed choice
 *   3. all already up to date -> all-mined choice
 *   4. otherwise -> run directly with the resolved mode
 */
export function resolveMiningIntent(nodes: BoxNode[]): MiningIntent {
  const newMessageFolders = nodes
    .filter((node) => node.status === FolderStatus.NewMessages)
    .map((node) => node.key);

  if (newMessageFolders.length > 0) {
    return { kind: 'resume', folders: newMessageFolders };
  }

  const upToDateCount = nodes.filter(
    (node) => node.status === FolderStatus.UpToDate,
  ).length;

  if (upToDateCount > 0 && upToDateCount < nodes.length) {
    return {
      kind: 'mixed',
      folders: nodes.map((node) => ({
        key: node.key,
        label: node.label,
        status: node.status === FolderStatus.UpToDate ? 'up_to_date' : 'new',
      })),
    };
  }

  if (nodes.length > 0 && upToDateCount === nodes.length) {
    return { kind: 'all-mined' };
  }

  return { kind: 'run', mode: resolveRunMode(nodes) };
}
