/**
 * Header-action gating for the contacts table.
 *
 * While a foreground mining run is in progress the table is a live view of a
 * partially-mined list. Mutating or exporting from it acts on an incomplete
 * set, so those actions stay disabled until the run finishes. Read-only
 * affordances (filters, columns, pagination, search, fullscreen) are
 * deliberately NOT gated — the user still needs to inspect progress.
 */

export type ResolveMiningActionsDisabledInput = {
  /** True while a mining run is in progress. */
  miningActive: boolean;
  /** Contacts currently rendered by the table. */
  contactsCount: number;
  /** Contacts the actions would apply to (selection, else implicit filter). */
  selectedCount: number;
  /** True during the brief source-connection/DNS phase of starting a run. */
  connecting: boolean;
};

export function resolveMiningActionsDisabled({
  miningActive,
  contactsCount,
  selectedCount,
  connecting,
}: ResolveMiningActionsDisabledInput): boolean {
  if (miningActive || connecting) return true;
  return contactsCount === 0 || selectedCount === 0;
}
