import { defineStore } from 'pinia';
import { createContactTableSetup } from './contact-table-factory';

/**
 * The `/contacts` table: refined contacts only. Its realtime policy
 * (UPDATE + DELETE → debounced reconcile, never INSERT streaming) comes from
 * the `'contacts'` origin captured below, so an in-flight mining can no
 * longer leak raw `persons` rows into this view.
 *
 * The store ID stays `'contacts-store'` — existing tests and call sites
 * reference it.
 */
export const useContactsStore = defineStore('contacts-store', () =>
  createContactTableSetup('contacts'),
);
