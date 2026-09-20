/**
 * Folders mined in this run that are not yet registered for passive mining.
 * Pure: order-stable, deduped, no store access.
 */
export function diffUnregisteredFolders(
  mined: string[],
  registered: string[],
): string[] {
  const known = new Set(registered.filter((key) => key !== ''));
  const unseen: string[] = [];
  for (const key of mined) {
    if (key === '' || known.has(key)) continue;
    known.add(key);
    unseen.push(key);
  }
  return unseen;
}

export interface PassiveFolderRow {
  key: string;
  label: string;
  checked: boolean;
  isNew: boolean;
  unavailable: boolean;
}

export interface PassiveFolderListOptions {
  /** Folders mined by the run/source that are candidates for passive mining. */
  mined: string[];
  /** Folders already registered for passive mining (drives the "New" badge). */
  registered: string[];
  /** Folders that still exist and can be mined (drives availability/pruning). */
  available: string[] | Set<string>;
  labelFor: (key: string) => string;
  /**
   * Which keys become rows. `union` (default) keeps registered + mined;
   * `mined` shows only the recently-mined folders.
   */
  keysFrom?: 'union' | 'mined';
  /** Pre-checked keys. Defaults to every available row. */
  checked?: string[] | Set<string>;
}

const toSet = (value: string[] | Set<string>): Set<string> =>
  value instanceof Set ? value : new Set(value);

/**
 * Builds the folder rows shown by the passive-mining confirmation dialog.
 * Unavailable rows come back unchecked so confirming prunes them.
 */
export function buildPassiveFolderList(
  options: PassiveFolderListOptions,
): PassiveFolderRow[] {
  const {
    mined,
    registered,
    available,
    labelFor,
    keysFrom = 'union',
    checked,
  } = options;
  const availableSet = toSet(available);
  const registeredSet = new Set(registered.filter((key) => key !== ''));
  const checkedSet = checked ? toSet(checked) : null;
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const key of keysFrom === 'mined' ? mined : [...registered, ...mined]) {
    if (key === '' || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys.map((key) => {
    const isAvailable = availableSet.has(key);
    return {
      key,
      label: labelFor(key),
      // Unavailable rows always come back unchecked so confirming prunes them.
      checked: isAvailable && (checkedSet ? checkedSet.has(key) : true),
      isNew: !registeredSet.has(key),
      unavailable: !isAvailable,
    };
  });
}

/**
 * Decides whether the post-run passive-mining prompt should open:
 * `first-time` when passive is off, `update` when the run mined folders that
 * are not registered yet, `null` when there is nothing to ask.
 */
export function resolvePassiveMiningPrompt(options: {
  passiveEnabled: boolean;
  minedFolders: string[];
  registeredFolders: string[];
}): 'first-time' | 'update' | null {
  if (!options.passiveEnabled) return 'first-time';
  return diffUnregisteredFolders(
    options.minedFolders,
    options.registeredFolders,
  ).length > 0
    ? 'update'
    : null;
}
