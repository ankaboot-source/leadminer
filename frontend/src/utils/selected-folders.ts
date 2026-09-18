import type { TreeSelectionKeys } from 'primevue/tree';

import { FolderStatus } from '~/types/enums';
import type { BoxNode } from '~/utils/boxes';

/**
 * Canonical set of folders selected for a mining run: checked, not in the
 * excluded set (e.g. \Noselect folders), and not the synthetic root key.
 * Every "selected folders" read in the app must go through this.
 */
export function getSelectedFolderKeys(
  selectedBoxes?: TreeSelectionKeys | null,
  excludedBoxes?: Set<string> | null,
): string[] {
  if (!selectedBoxes) return [];
  return Object.keys(selectedBoxes).filter(
    (key) =>
      key !== '' &&
      selectedBoxes[key]?.checked === true &&
      !excludedBoxes?.has(key),
  );
}

export function hasSelectedFolders(
  selectedBoxes?: TreeSelectionKeys | null,
  excludedBoxes?: Set<string> | null,
): boolean {
  return getSelectedFolderKeys(selectedBoxes, excludedBoxes).length > 0;
}

/**
 * Removes checked, already-mined folders from a Tree selection. Used when the
 * user chooses “mine new messages only”: the remaining checked folders are
 * then mined through the normal selection path.
 */
export function uncheckUpToDateFolders(
  selectedBoxes?: TreeSelectionKeys | null,
  nodes: BoxNode[] = [],
): TreeSelectionKeys {
  const upToDateKeys = new Set<string>();
  const collect = (list: BoxNode[]) => {
    for (const node of list) {
      if (node.status === FolderStatus.UpToDate) upToDateKeys.add(node.key);
      if (node.children?.length) collect(node.children);
    }
  };
  collect(nodes);

  const nextSelected: TreeSelectionKeys = {};
  for (const [key, value] of Object.entries(selectedBoxes ?? {})) {
    if (upToDateKeys.has(key)) continue;
    nextSelected[key] = value;
  }
  return nextSelected;
}

/**
 * Display name for a folder key. INBOX is protocol-reserved, never a real
 * mailbox label; other folders use the caller-provided fallback, else the
 * last path segment.
 */
export function folderDisplayName(
  key: string,
  inboxLabel: string,
  fallback?: string,
): string {
  if (key.toUpperCase() === 'INBOX') return inboxLabel;
  return fallback ?? key.split('/').pop() ?? key;
}
