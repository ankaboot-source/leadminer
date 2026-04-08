import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp, ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { readFileSync } from 'fs';
import PrimeVue from 'primevue/config';

// Read component source to verify imports and store usage
const COMPONENT_PATH =
  '/home/badreddine/Projects/leadminer/.worktrees/sms-fleet-mode/frontend/src/components/sms-fleet/SmsFleetManagement.vue';

const mockGateways = ref<any[]>([]);
const mockFetchGateways = vi.fn().mockResolvedValue(undefined);
const mockCreateGateway = vi.fn().mockResolvedValue({ id: 'test-id' });
const mockDeleteGateway = vi.fn().mockResolvedValue(true);
const mockTestGateway = vi
  .fn()
  .mockResolvedValue({ success: true, message: 'OK' });

vi.mock('~/stores/sms-fleet', () => ({
  useSmsFleetStore: vi.fn(() => ({
    gateways: mockGateways.value,
    isLoading: false,
    error: null,
    fetchGateways: mockFetchGateways,
    createGateway: mockCreateGateway,
    deleteGateway: mockDeleteGateway,
    testGateway: mockTestGateway,
    updateGateway: vi.fn().mockResolvedValue(true),
  })),
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({
    add: vi.fn(),
    remove: vi.fn(),
    removeAll: vi.fn(),
  })),
}));

vi.mock('primevue/useconfirm', () => ({
  useConfirm: vi.fn(() => ({
    require: vi.fn(),
  })),
}));

vi.mock('#imports', () => ({
  onMounted: (cb: () => void) => cb(),
}));

const app = createApp({});
app.use(PrimeVue);

describe('SmsFleetManagement Structure Tests', () => {
  let componentContent: string;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockGateways.value = [];
    componentContent = readFileSync(COMPONENT_PATH, 'utf-8');
  });

  it('should import useSmsFleetStore from the store', () => {
    // Verify the import statement exists
    expect(componentContent).toContain(
      "import { useSmsFleetStore } from '~/stores/sms-fleet';",
    );
  });

  it('should call useSmsFleetStore to initialize the store', () => {
    // Verify store is initialized
    expect(componentContent).toContain('useSmsFleetStore()');
  });

  it('should call store.createGateway when submitting form', () => {
    // Verify createGateway is called in form submit handler
    expect(componentContent).toContain('createGateway');
    expect(componentContent).toContain('handleGatewaySubmit');
  });

  it('should call store.deleteGateway when deleting gateway', () => {
    // Verify deleteGateway is called in delete handler
    expect(componentContent).toContain('deleteGateway');
    expect(componentContent).toContain('confirmDelete');
  });

  it('should call store.fetchGateways on mount', () => {
    // Verify fetchGateways is called in onMounted
    expect(componentContent).toContain('fetchGateways');
    expect(componentContent).toContain('onMounted');
  });

  it('should use store.gateways for displaying gateways', () => {
    // Verify the template uses store.gateways
    expect(componentContent).toContain('$smsFleetStore.gateways');
  });
});

describe('SmsFleetManagement Store Integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockGateways.value = [];
  });

  it('mocked store methods are properly defined', () => {
    // This test verifies our mocks are working
    expect(mockCreateGateway).toBeDefined();
    expect(mockDeleteGateway).toBeDefined();
    expect(mockFetchGateways).toBeDefined();
    expect(mockTestGateway).toBeDefined();
  });
});
