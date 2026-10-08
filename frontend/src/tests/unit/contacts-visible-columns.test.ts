import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';

const supabaseUser = ref<{ id: string } | null>({ id: 'user-1' });

// The contacts store relies on Nuxt auto-imports that resolve to these
// @nuxtjs/supabase runtime composables (the package only exports ".").
vi.mock(
  '/node_modules/@nuxtjs/supabase/dist/runtime/composables/useSupabaseUser.js',
  () => ({
    useSupabaseUser: () => supabaseUser,
  }),
);

vi.mock(
  '/node_modules/@nuxtjs/supabase/dist/runtime/composables/useSupabaseClient.js',
  () => ({
    useSupabaseClient: () => ({}),
  }),
);

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

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
});

describe('initializeVisibleColumns', () => {
  it('shows the declared defaults when nothing is stored', () => {
    const store = useContactsStore();
    store.initializeVisibleColumns(CONTACTS_DEFAULTS, 'contacts');

    expect(store.visibleColumns).toEqual(CONTACTS_DEFAULTS);
  });

  it('falls back to defaults when the stored selection is empty', () => {
    localStorage.setItem(columnsKey, '[]');

    const store = useContactsStore();
    store.initializeVisibleColumns(CONTACTS_DEFAULTS, 'contacts');

    expect(store.visibleColumns).toEqual(CONTACTS_DEFAULTS);
  });

  it('honors a stored non-empty selection', () => {
    localStorage.setItem(columnsKey, JSON.stringify(['contacts', 'telephone']));

    const store = useContactsStore();
    store.initializeVisibleColumns(CONTACTS_DEFAULTS, 'contacts');

    expect(store.visibleColumns).toEqual(['contacts', 'telephone', 'name']);
  });

  it('does not widen the defaults from stored data', () => {
    localStorage.setItem(columnsKey, JSON.stringify(['contacts']));

    const store = useContactsStore();
    store.initializeVisibleColumns(CONTACTS_DEFAULTS, 'contacts');

    // Only the user picks extra fields; the store never adds them on its own.
    expect(store.visibleColumns).toEqual(['contacts', 'name']);
  });
});
