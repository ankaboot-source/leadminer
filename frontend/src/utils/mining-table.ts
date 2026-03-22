import type { Contact } from '@/types/contact';

type ResolveMiningTableRowsInput = {
  hardFilter: boolean;
  contacts: Contact[] | undefined;
  jobDetailsContacts: Contact[];
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
