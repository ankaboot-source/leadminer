import type { CampaignOverview } from '@/types/campaign';

export const useCampaignsStore = defineStore('campaigns-store', () => {
  const $supabase = useSupabaseClient();

  const campaigns = ref<CampaignOverview[]>([]);
  const isLoading = ref(false);
  const errorMessage = ref<string | null>(null);
  let pollingInterval: ReturnType<typeof setInterval> | null = null;

  async function fetchCampaigns() {
    isLoading.value = true;
    errorMessage.value = null;

    const { data, error } = await $supabase
      .schema('private')
      // @ts-expect-error rpc typing from private schema function
      .rpc('get_campaigns_overview');

    if (error) {
      errorMessage.value = error.message;
      isLoading.value = false;
      throw error;
    }

    campaigns.value = (data ?? []) as CampaignOverview[];
    isLoading.value = false;
  }

  function startPolling() {
    stopPolling();
    pollingInterval = setInterval(() => {
      fetchCampaigns().catch(() => undefined);
    }, 60000);
  }

  function stopPolling() {
    if (!pollingInterval) return;
    clearInterval(pollingInterval);
    pollingInterval = null;
  }

  function $reset() {
    stopPolling();
    campaigns.value = [];
    isLoading.value = false;
    errorMessage.value = null;
  }

  return {
    campaigns,
    isLoading,
    errorMessage,
    fetchCampaigns,
    startPolling,
    stopPolling,
    $reset,
  };
});
