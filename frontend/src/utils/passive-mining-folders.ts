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
