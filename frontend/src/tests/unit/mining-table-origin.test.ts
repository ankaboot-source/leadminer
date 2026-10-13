import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';

function readFrontendSource(relativePath: string) {
  const absolutePath = path.resolve(__dirname, '../../..', relativePath);
  return fs.readFileSync(absolutePath, 'utf-8');
}

describe('mining table origin plumbing', () => {
  // Source-level assertions: mounting MiningTable.vue (PrimeVue DataTable +
  // async children + stores + i18n) is impractical in a unit test, while the
  // failure mode is a silently-dropped template binding that compiles fine
  // and falls back to the wrong store. Asserting the bindings directly pins
  // the wiring (same approach as mobile-ui-regressions.test.ts).
  it('threads origin from MiningTable down to every origin-aware child', () => {
    const miningTable = readFrontendSource(
      'src/components/mining/table/MiningTable.vue',
    );

    expect(miningTable).toMatch(
      /<ContactInformationSidebar[\s\S]*?:origin="origin"/,
    );
    expect(miningTable).toMatch(/<EnrichButton[\s\S]*?:origin="origin"/);
    expect(miningTable).toMatch(/<RemoveContactButton[\s\S]*?:origin="origin"/);
    // Exactly the three known children: a fourth binding (or a dropped one)
    // means the wiring changed and this test needs a conscious update.
    expect(miningTable.match(/:origin="origin"/g)).toHaveLength(3);
  });

  it('forwards origin from the sidebar to its enrich button', () => {
    const sidebar = readFrontendSource(
      'src/components/mining/ContactInformationSidebar.vue',
    );

    expect(sidebar).toMatch(/<EnrichButton[\s\S]*?:origin="origin"/);
  });

  // `origin` is required everywhere (no silent 'contacts' fallback): a future
  // caller that forgets the prop must fail loudly instead of pruning or
  // enriching through the wrong store.
  it('requires origin on every origin-aware component and helper', () => {
    const removeButton = readFrontendSource(
      'src/components/mining/buttons/RemoveContactButton.vue',
    );
    const enrichButton = readFrontendSource(
      'src/components/mining/enrich/EnrichButton.vue',
    );
    const sidebar = readFrontendSource(
      'src/components/mining/ContactInformationSidebar.vue',
    );
    const contactTableStore = readFrontendSource('src/stores/contact-table.ts');

    expect(removeButton).toContain('origin: TableOrigin;');
    expect(removeButton).not.toContain('origin?:');
    expect(removeButton).not.toContain("?? 'contacts'");

    expect(enrichButton).toContain('origin: TableOrigin;');
    expect(enrichButton).not.toContain('origin?:');
    expect(enrichButton).not.toContain("?? 'contacts'");

    expect(sidebar).toContain('defineProps<{ origin: TableOrigin }>()');
    expect(sidebar).not.toContain('origin?:');
    expect(sidebar).not.toContain("origin: 'contacts'");

    expect(contactTableStore).toMatch(/origin: TableOrigin,/);
    expect(contactTableStore).not.toContain("origin: TableOrigin = 'contacts'");
  });
});

const supabaseUser = ref<{ id: string } | null>({ id: 'user-1' });

const supabaseRpc = vi.fn(() => Promise.resolve({ data: [], error: null }));
const eqMiningId = vi.fn(() => Promise.resolve({ data: [], error: null }));
const eqUserId = vi.fn(() => ({ eq: eqMiningId }));
const selectAll = vi.fn(() => ({ eq: eqUserId }));
const fromPersons = vi.fn(() => ({ select: selectAll }));
const schemaPrivate = vi.fn(() => ({ rpc: supabaseRpc, from: fromPersons }));

const supabaseClient = {
  channel: vi.fn(),
  removeChannel: vi.fn(() => Promise.resolve()),
  schema: schemaPrivate,
};

// The contact-table stores rely on Nuxt auto-imports that resolve to these
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
    useSupabaseClient: () => supabaseClient,
  }),
);

vi.stubGlobal('useSupabaseUser', () => supabaseUser);
vi.stubGlobal('useSupabaseClient', () => supabaseClient);
vi.stubGlobal('getOrganizationName', (org: unknown) => Promise.resolve(org));

vi.mock('~/stores/leadminer', () => ({
  useLeadminerStore: () => ({ activeMiningTask: undefined }),
}));

import { useMiningTableStore } from '@/stores/contact-table';

describe('mine backfill stays light', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
  });

  it('loads /mine from private.persons without touching the contacts RPC', async () => {
    // The whole reason the two tables were separated: /mine rebuilds from the
    // run's own persons rows, never via get_contacts_table (which only
    // surfaces refined contacts and drops everything mined so far mid-run).
    const store = useMiningTableStore();
    await store.loadMinedPersons('mining-1');

    expect(schemaPrivate).toHaveBeenCalledWith('private');
    expect(fromPersons).toHaveBeenCalledWith('persons');
    expect(selectAll).toHaveBeenCalledWith('*');
    expect(eqUserId).toHaveBeenCalledWith('user_id', 'user-1');
    expect(eqMiningId).toHaveBeenCalledWith('mining_id', 'mining-1');
    expect(supabaseRpc).not.toHaveBeenCalled();
  });
});
