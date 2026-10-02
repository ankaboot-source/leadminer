import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';

const supabaseUser = ref<{ id: string } | null>({ id: 'user-1' });

// The contacts store relies on Nuxt auto-imports that resolve to these
// @nuxtjs/supabase runtime composables (the package only exports ".").
vi.mock('/node_modules/@nuxtjs/supabase/dist/runtime/composables/useSupabaseUser.js', () => ({
  useSupabaseUser: () => supabaseUser,
}));

vi.mock('/node_modules/@nuxtjs/supabase/dist/runtime/composables/useSupabaseClient.js', () => ({
  useSupabaseClient: () => ({}),
}));

vi.stubGlobal('useSupabaseUser', () => supabaseUser);
vi.stubGlobal('useSupabaseClient', () => ({}));

vi.mock('~/stores/leadminer', () => ({
  useLeadminerStore: () => ({ activeMiningTask: undefined }),
}));

import { useContactsStore } from '@/stores/contacts';

const CONTACTS_DEFAULTS = [
  'contacts',
  'name',
  'location',
  'works_for',
  'job_title',
];

const columnsKey = 'leadminer:v1:table:columns:user-1:contacts';

const emailOnlyContact = {
  id: 'c1',
  email: 'a@example.com',
} as never;

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
});

describe('initializeVisibleColumns stored-empty fallback', () => {
  it('falls back to defaults when the stored selection is empty', () => {
    localStorage.setItem(columnsKey, '[]');

    const store = useContactsStore();
    store.initializeVisibleColumns(CONTACTS_DEFAULTS, 'contacts', []);

    expect(store.visibleColumns).toEqual(CONTACTS_DEFAULTS);
  });

  it('falls back to data-driven columns when stored is empty and contacts exist', () => {
    localStorage.setItem(columnsKey, '[]');

    const store = useContactsStore();
    store.initializeVisibleColumns(CONTACTS_DEFAULTS, 'contacts', [
      emailOnlyContact,
    ]);

    // Email-only contact: checkbox + rescued name column, never an empty table.
    expect(store.visibleColumns).toEqual(['contacts', 'name']);
  });

  it('honors a stored non-empty selection', () => {
    localStorage.setItem(columnsKey, JSON.stringify(['contacts', 'telephone']));

    const store = useContactsStore();
    store.initializeVisibleColumns(CONTACTS_DEFAULTS, 'contacts', []);

    expect(store.visibleColumns).toEqual(['contacts', 'telephone', 'name']);
  });

  it('falls back to defaults when nothing is stored and no contacts exist', () => {
    const store = useContactsStore();
    store.initializeVisibleColumns(CONTACTS_DEFAULTS, 'contacts', []);

    expect(store.visibleColumns).toEqual(CONTACTS_DEFAULTS);
  });
});
