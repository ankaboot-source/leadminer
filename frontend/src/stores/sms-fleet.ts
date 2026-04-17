import type {
  SmsFleetGateway,
  SmsGatewayCreatePayload,
  SmsGatewayProvider,
  SmsGatewayTestResult,
} from '@/types/sms-fleet';

export const useSmsFleetStore = defineStore('sms-fleet', () => {
  const { $saasEdgeFunctions } = useNuxtApp();

  const gateways = ref<SmsFleetGateway[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function fetchGateways() {
    isLoading.value = true;
    error.value = null;

    try {
      const response = (await $saasEdgeFunctions(
        'sms-campaigns/fleet/gateways',
        {
          method: 'GET',
        },
      )) as { gateways: SmsFleetGateway[] };

      if (!response?.gateways || !Array.isArray(response.gateways)) {
        throw new Error('Failed to fetch gateways');
      }

      gateways.value = response.gateways;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Failed to fetch gateways';
      console.error('Error fetching SMS fleet gateways:', err);
    } finally {
      isLoading.value = false;
    }
  }

  async function createGateway(
    payload: SmsGatewayCreatePayload,
  ): Promise<SmsFleetGateway | null> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = (await $saasEdgeFunctions(
        'sms-campaigns/fleet/gateways',
        {
          method: 'POST',
          body: {
            name: payload.name,
            provider: payload.provider,
            config: payload.config,
            daily_limit: payload.daily_limit ?? 200,
            monthly_limit: payload.monthly_limit ?? 200,
            is_active: true,
          },
        },
      )) as { gateway: SmsFleetGateway };

      if (!response?.gateway?.id) {
        throw new Error('Failed to create gateway');
      }

      const result = response.gateway;
      gateways.value.unshift(result);
      return result;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Failed to create gateway';
      console.error('Error creating SMS fleet gateway:', err);
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  async function updateGateway(
    gatewayId: string,
    updates: Partial<SmsGatewayCreatePayload>,
  ): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await $saasEdgeFunctions(
        `sms-campaigns/fleet/gateways/${gatewayId}`,
        {
          method: 'PUT',
          body: {
            ...updates,
            updated_at: new Date().toISOString(),
          },
        },
      );

      const result = response as { success?: boolean; error?: string };
      if (!result?.success) {
        throw new Error(result?.error ?? 'Failed to update gateway');
      }

      const index = gateways.value.findIndex((g) => g.id === gatewayId);
      if (index !== -1) {
        gateways.value[index] = {
          ...gateways.value[index],
          ...updates,
        } as SmsFleetGateway;
      }

      return true;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Failed to update gateway';
      console.error('Error updating SMS fleet gateway:', err);
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function deleteGateway(gatewayId: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = (await $saasEdgeFunctions(
        `sms-campaigns/fleet/gateways/${gatewayId}`,
        {
          method: 'DELETE',
        },
      )) as { success?: boolean };

      if (!response?.success) {
        throw new Error('Failed to delete gateway');
      }

      gateways.value = gateways.value.filter((g) => g.id !== gatewayId);
      return true;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Failed to delete gateway';
      console.error('Error deleting SMS fleet gateway:', err);
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function testGateway(gatewayId: string): Promise<SmsGatewayTestResult> {
    try {
      const result = await $saasEdgeFunctions(
        `sms-campaigns/fleet/gateways/${gatewayId}/test`,
        {
          method: 'POST',
        },
      );
      return result as SmsGatewayTestResult;
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Test failed',
      };
    }
  }

  const activeGateways = computed(() =>
    gateways.value.filter((g) => g.is_active),
  );

  const gatewaysByProvider = computed(() => {
    const grouped: Record<SmsGatewayProvider, SmsFleetGateway[]> = {
      smsgate: [],
      'simple-sms-gateway': [],
      twilio: [],
    };
    gateways.value.forEach((g) => {
      grouped[g.provider].push(g);
    });
    return grouped;
  });

  function $reset() {
    gateways.value = [];
    isLoading.value = false;
    error.value = null;
  }

  return {
    gateways,
    isLoading,
    error,
    activeGateways,
    gatewaysByProvider,
    fetchGateways,
    createGateway,
    updateGateway,
    deleteGateway,
    testGateway,
    $reset,
  };
});
