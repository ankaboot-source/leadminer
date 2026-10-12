import { useContactsStore } from '~/stores/contacts';
import { useMiningStore } from '~/stores/mining';
import type { TableOrigin } from '~/utils/table-preferences';

/**
 * Resolves the contact-table store for a table origin.
 *
 * `/contacts` and `/mine` render through the same `MiningTable.vue` but own
 * independent channels and caches: `contacts` reconciles refined contacts
 * (never streams INSERTs), while `mine` streams the live extraction. Reading
 * the wrong store reintroduces the mid-run leak where `/contacts` displayed
 * `/mine` rows, so every shared call site resolves its store from `origin`
 * instead of importing one store directly.
 */
export function useContactTableStore(origin: TableOrigin) {
  return origin === 'mine' ? useMiningStore() : useContactsStore();
}
