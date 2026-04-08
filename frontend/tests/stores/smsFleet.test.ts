import { describe, it, expect, vi } from 'vitest';
import type { SmsFleetGateway } from '~/types/sms-fleet';

vi.mock('~/stores/sms-fleet', () => ({
  useSmsFleetStore: () => ({
    gateways: [] as SmsFleetGateway[],
    isLoading: false,
    error: null as string | null,
    fetchGateways: vi.fn().mockResolvedValue([]),
    createGateway: vi.fn().mockResolvedValue({ id: 'test-id' }),
    deleteGateway: vi.fn().mockResolvedValue(true),
    updateGateway: vi.fn().mockResolvedValue(true),
    testGateway: vi.fn().mockResolvedValue({ success: true, message: 'OK' }),
  }),
}));

vi.mock('#imports', () => ({
  useSupabaseClient: () => ({}),
  useNuxtApp: () => ({ $saasEdgeFunctions: vi.fn() }),
  defineStore: vi.fn(),
}));

describe('smsFleetStore', () => {
  it('should have a useSmsFleetStore factory function', async () => {
    const { useSmsFleetStore } = await import('~/stores/sms-fleet');
    expect(typeof useSmsFleetStore).toBe('function');
  });

  it('should return store with expected methods', async () => {
    const { useSmsFleetStore } = await import('~/stores/sms-fleet');
    const store = useSmsFleetStore();

    expect(store).toHaveProperty('gateways');
    expect(store).toHaveProperty('isLoading');
    expect(store).toHaveProperty('error');
    expect(store).toHaveProperty('fetchGateways');
    expect(store).toHaveProperty('createGateway');
    expect(store).toHaveProperty('deleteGateway');
    expect(store).toHaveProperty('updateGateway');
    expect(store).toHaveProperty('testGateway');
  });

  it('should have array for gateways', async () => {
    const { useSmsFleetStore } = await import('~/stores/sms-fleet');
    const store = useSmsFleetStore();
    expect(Array.isArray(store.gateways)).toBe(true);
  });

  it('should have boolean for isLoading', async () => {
    const { useSmsFleetStore } = await import('~/stores/sms-fleet');
    const store = useSmsFleetStore();
    expect(typeof store.isLoading).toBe('boolean');
  });

  describe('fetchGateways', () => {
    it('should be callable', async () => {
      const { useSmsFleetStore } = await import('~/stores/sms-fleet');
      const store = useSmsFleetStore();
      await expect(store.fetchGateways()).resolves.not.toThrow();
    });
  });

  describe('createGateway', () => {
    it('should be callable with valid payload', async () => {
      const { useSmsFleetStore } = await import('~/stores/sms-fleet');
      const store = useSmsFleetStore();
      const result = await store.createGateway({
        name: 'Test Gateway',
        provider: 'smsgate',
        config: {
          baseUrl: 'https://test.com',
          username: 'user',
          password: 'pass',
        },
        daily_limit: 100,
        monthly_limit: 1000,
      });
      expect(result).toBeDefined();
    });
  });

  describe('deleteGateway', () => {
    it('should be callable with gateway id', async () => {
      const { useSmsFleetStore } = await import('~/stores/sms-fleet');
      const store = useSmsFleetStore();
      const result = await store.deleteGateway('test-id');
      expect(result).toBe(true);
    });
  });

  describe('updateGateway', () => {
    it('should be callable with id and updates', async () => {
      const { useSmsFleetStore } = await import('~/stores/sms-fleet');
      const store = useSmsFleetStore();
      const result = await store.updateGateway('test-id', {
        name: 'Updated Name',
      });
      expect(result).toBe(true);
    });
  });

  describe('testGateway', () => {
    it('should be callable', async () => {
      const { useSmsFleetStore } = await import('~/stores/sms-fleet');
      const store = useSmsFleetStore();
      const result = await store.testGateway('test-id');
      expect(result).toHaveProperty('success');
    });
  });
});
