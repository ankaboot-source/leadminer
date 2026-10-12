import { defineStore } from 'pinia';
import { createContactTableSetup } from './contact-table-factory';

/**
 * The `/mine` table: the live view of a running extraction. Its realtime
 * policy (INSERT + UPDATE streaming straight into the cache) comes from the
 * `'mine'` origin captured below. It shares the contact-table setup body with
 * the contacts store so `MiningTable.vue` keeps a single public surface, but
 * the two stores hold fully independent channels and caches.
 */
export const useMiningTableStore = defineStore('mining-table-store', () =>
  createContactTableSetup('mine'),
);
