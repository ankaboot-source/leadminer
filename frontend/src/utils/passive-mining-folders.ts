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
