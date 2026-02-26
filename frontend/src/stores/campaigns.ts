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

    campaigns.value = ((data ?? []) as Partial<CampaignOverview>[]).map(
      (campaign) => ({
        ...campaign,
        attempted: Number(campaign.attempted || 0),
        delivered: Number(campaign.delivered || 0),
        hard_bounced: Number(campaign.hard_bounced || 0),
        soft_bounced: Number(campaign.soft_bounced || 0),
        failed_other: Number(campaign.failed_other || 0),
        opened: Number(campaign.opened || 0),
        clicked: Number(campaign.clicked || 0),
        unsubscribed: Number(campaign.unsubscribed || 0),
        delivery_rate: Number(campaign.delivery_rate || 0),
        opening_rate: Number(campaign.opening_rate || 0),
        clicking_rate: Number(campaign.clicking_rate || 0),
        unsubscribe_rate: Number(campaign.unsubscribe_rate || 0),
        track_open: Boolean(campaign.track_open),
        track_click: Boolean(campaign.track_click),
        link_clicks: Array.isArray(campaign.link_clicks)
          ? campaign.link_clicks
          : [],
      }),
    ) as CampaignOverview[];
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
