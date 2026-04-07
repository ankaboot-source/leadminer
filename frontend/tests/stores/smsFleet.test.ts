import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { ref, computed } from 'vue';
import type { SmsFleetGateway } from '~/types/sms-fleet';

// Mock the composable functions and modules BEFORE importing store
const mockFrom = vi.fn();
const mockSchema = vi.fn();
const mockEdgeFn = vi.fn();

vi.mock('#imports', () => ({
  useSupabaseClient: () => mockSupabase,
  useNuxtApp: () => ({ $saasEdgeFunctions: mockEdgeFn }),
  defineStore: (id: string, setup: Function) => setup,
  ref: ref,
  computed: computed,
}));

// Global mock supabase client
const mockSupabase = {
  schema: mockSchema,
};

describe('smsFleetStore', () => {
  let store: any;

  beforeEach(async () => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockSchema.mockReset();
    mockFrom.mockReset();
    mockEdgeFn.mockReset();

    // Import store fresh for each test
    const { useSmsFleetStore } = await import('~/stores/sms-fleet');
    store = useSmsFleetStore();
  });

  describe('fetchGateways', () => {
    it('fetches gateways and updates state', async () => {
      const mockGateways: SmsFleetGateway[] = [
        {
          id: 'gateway-1',
          user_id: 'user-1',
          name: 'Primary SMSGate',
          provider: 'smsgate',
          config: {
            baseUrl: 'https://api.smsgate.com',
            username: 'user',
            password: 'pass',
          },
          is_active: true,
          daily_limit: 1000,
          monthly_limit: 10000,
          sent_today: 0,
          sent_this_month: 0,
          last_reset_at: '2024-01-01T00:00:00Z',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];

      mockSchema.mockReturnValue({
        from: mockFrom,
      });

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockGateways,
            error: null,
          }),
        }),
      });

      await store.fetchGateways();

      expect(store.gateways).toEqual(mockGateways);
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
      expect(mockSchema).toHaveBeenCalledWith('private');
      expect(mockFrom).toHaveBeenCalledWith('sms_fleet_gateways');
    });

    it('handles fetch errors and sets error state', async () => {
      mockSchema.mockReturnValue({
        from: mockFrom,
      });

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database connection failed' },
          }),
        }),
      });

      await store.fetchGateways();

      expect(store.gateways).toEqual([]);
      expect(store.error).toBe('Database connection failed');
      expect(store.isLoading).toBe(false);
    });
  });

  describe('createGateway', () => {
    it('creates gateway and adds to state', async () => {
      const newGatewayData = {
        name: 'New Gateway',
        provider: 'smsgate' as const,
        config: {
          baseUrl: 'https://api.test.com',
          username: 'test',
          password: 'test',
        },
        daily_limit: 500,
        monthly_limit: 5000,
      };

      const createdGateway: SmsFleetGateway = {
        id: 'gateway-new',
        user_id: 'user-1',
        name: newGatewayData.name,
        provider: newGatewayData.provider,
        config: newGatewayData.config,
        is_active: true,
        daily_limit: newGatewayData.daily_limit,
        monthly_limit: newGatewayData.monthly_limit,
        sent_today: 0,
        sent_this_month: 0,
        last_reset_at: '2024-01-01T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockSchema.mockReturnValue({
        from: mockFrom,
      });

      mockFrom.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: createdGateway,
              error: null,
            }),
          }),
        }),
      });

      store.gateways = [];

      const result = await store.createGateway(newGatewayData);

      expect(result).toEqual(createdGateway);
      expect(store.gateways[0]).toEqual(createdGateway);
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
      expect(mockFrom).toHaveBeenCalledWith('sms_fleet_gateways');
    });

    it('handles create errors and returns null', async () => {
      mockSchema.mockReturnValue({
        from: mockFrom,
      });

      mockFrom.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Duplicate gateway name' },
            }),
          }),
        }),
      });

      const result = await store.createGateway({
        name: 'Test',
        provider: 'smsgate',
        config: {},
      });

      expect(result).toBeNull();
      expect(store.error).toBe('Duplicate gateway name');
    });
  });

  describe('updateGateway', () => {
    it('updates gateway configuration in database and state', async () => {
      const existingGateway: SmsFleetGateway = {
        id: 'gateway-1',
        user_id: 'user-1',
        name: 'Old Name',
        provider: 'smsgate',
        config: { baseUrl: 'https://old.com' },
        is_active: true,
        daily_limit: 1000,
        monthly_limit: 10000,
        sent_today: 50,
        sent_this_month: 250,
        last_reset_at: '2024-01-01T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockSchema.mockReturnValue({
        from: mockFrom,
      });

      mockFrom.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: null,
          }),
        }),
      });

      store.gateways = [existingGateway];

      const result = await store.updateGateway('gateway-1', {
        name: 'New Name',
        daily_limit: 2000,
      });

      expect(result).toBe(true);
      expect(store.gateways[0].name).toBe('New Name');
      expect(store.gateways[0].daily_limit).toBe(2000);
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('handles update errors', async () => {
      mockSchema.mockReturnValue({
        from: mockFrom,
      });

      mockFrom.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: { message: 'Update failed' },
          }),
        }),
      });

      store.gateways = [];

      const result = await store.updateGateway('gateway-1', {
        name: 'Test',
      });

      expect(result).toBe(false);
      expect(store.error).toBe('Update failed');
    });
  });

  describe('deleteGateway', () => {
    it('deletes gateway from database and state', async () => {
      const gateway: SmsFleetGateway = {
        id: 'gateway-1',
        user_id: 'user-1',
        name: 'Test Gateway',
        provider: 'smsgate',
        config: {},
        is_active: true,
        daily_limit: 1000,
        monthly_limit: 10000,
        sent_today: 0,
        sent_this_month: 0,
        last_reset_at: '2024-01-01T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockSchema.mockReturnValue({
        from: mockFrom,
      });

      mockFrom.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: null,
          }),
        }),
      });

      store.gateways = [gateway];

      const result = await store.deleteGateway('gateway-1');

      expect(result).toBe(true);
      expect(store.gateways).toHaveLength(0);
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('handles delete errors', async () => {
      mockSchema.mockReturnValue({
        from: mockFrom,
      });

      mockFrom.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: { message: 'Delete failed' },
          }),
        }),
      });

      const result = await store.deleteGateway('gateway-1');

      expect(result).toBe(false);
      expect(store.error).toBe('Delete failed');
    });
  });

  describe('$reset', () => {
    it('resets all store state to initial values', () => {
      store.gateways = [{ id: 'test' } as SmsFleetGateway];
      store.isLoading = true;
      store.error = 'Some error';

      store.$reset();

      expect(store.gateways).toEqual([]);
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });
  });
});
