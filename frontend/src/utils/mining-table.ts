import type { Contact } from '@/types/contact';

type ResolveMiningTableRowsInput = {
  hardFilter: boolean;
  contacts: Contact[] | undefined;
  jobDetailsContacts: Contact[];
};

type ResolveContactsLoadingStrategyInput = {
  showTable: boolean;
};

export function resolveMiningTableRows({
  hardFilter,
  contacts,
  jobDetailsContacts,
}: ResolveMiningTableRowsInput) {
  if (hardFilter) {
    return jobDetailsContacts;
  }

  return contacts ?? [];
}

export function resolveContactsLoadingStrategy({
  showTable,
}: ResolveContactsLoadingStrategyInput) {
  return showTable ? 'immediate' : 'idle';
}
