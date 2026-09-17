import type { TreeSelectionKeys } from 'primevue/tree';

/**
 * Canonical set of folders selected for a mining run: checked, not in the
 * excluded set (e.g. \Noselect folders), and not the synthetic root key.
 * Every "selected folders" read in the app must go through this.
 */
export function getSelectedFolderKeys(
  selectedBoxes: TreeSelectionKeys | null | undefined,
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
  selectedBoxes: TreeSelectionKeys | null | undefined,
  excludedBoxes?: Set<string> | null,
): boolean {
  return getSelectedFolderKeys(selectedBoxes, excludedBoxes).length > 0;
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
