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

/**
 * Union list for the dialog: registered folders plus folders mined in this
 * run. Pre-checked = registered or newly mined. Registered-but-unavailable
 * rows come back unchecked so confirming prunes them.
 */
export function buildPassiveFolderList(options: {
  mined: string[];
  registered: string[];
  available: string[] | Set<string>;
  labelFor: (key: string) => string;
}): PassiveFolderRow[] {
  const { mined, registered, available, labelFor } = options;
  const availableSet =
    available instanceof Set ? available : new Set(available);
  const registeredSet = new Set(registered.filter((key) => key !== ''));
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const key of [...registered, ...mined]) {
    if (key === '' || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys.map((key) => {
    const isRegistered = registeredSet.has(key);
    const isAvailable = availableSet.has(key);
    return {
      key,
      label: labelFor(key),
      // Available rows stay/go checked; registered-but-unavailable rows come back unchecked so confirming prunes them.
      checked: isAvailable,
      isNew: !isRegistered,
      unavailable: !isAvailable,
    };
  });
}
