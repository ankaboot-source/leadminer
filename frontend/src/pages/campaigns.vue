<template>
  <div class="flex flex-col grow border border-surface-200 rounded-md p-4 gap-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">{{ t('campaigns') }}</h1>
      <Button
        icon="pi pi-refresh"
        :label="t('refresh')"
        :loading="$campaignsStore.isLoading"
        outlined
        @click="refresh"
      />
    </div>

    <DataView :value="$campaignsStore.campaigns" data-key="id" :paginator="true" :rows="10">
      <template #empty>
        <div class="text-center py-8 text-surface-500">{{ t('no_campaigns') }}</div>
      </template>
      <template #list="slotProps">
        <div class="grid gap-3">
          <div
            v-for="campaign in slotProps.items"
            :key="campaign.id"
            class="border border-surface-200 rounded-md p-4"
          >
            <div class="flex items-center justify-between gap-2">
              <div>
                <div class="font-medium">{{ campaign.subject }}</div>
                <div class="text-sm text-surface-500">
                  {{ campaign.sender_name }} - {{ campaign.sender_email }}
                </div>
              </div>
              <Tag :value="campaign.status" :severity="statusSeverity(campaign.status)" />
            </div>

            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 text-sm">
              <div class="p-2 rounded bg-surface-50">
                <div class="text-surface-500">{{ t('delivery') }}</div>
                <div class="font-semibold">
                  {{ campaign.delivered }}/{{ campaign.attempted }}
                </div>
                <div>{{ formatRate(campaign.delivery_rate) }}</div>
              </div>

              <div class="p-2 rounded bg-surface-50">
                <div class="text-surface-500">{{ t('opens') }}</div>
                <div class="font-semibold">{{ campaign.opened }}</div>
                <div>{{ formatRate(campaign.opening_rate) }}</div>
              </div>

              <div class="p-2 rounded bg-surface-50">
                <div class="text-surface-500">{{ t('clicks') }}</div>
                <div class="font-semibold">{{ campaign.clicked }}</div>
                <div>{{ formatRate(campaign.clicking_rate) }}</div>
              </div>

              <div class="p-2 rounded bg-surface-50">
                <div class="text-surface-500">{{ t('recipients') }}</div>
                <div class="font-semibold">{{ campaign.total_recipients }}</div>
                <div>{{ formatDate(campaign.created_at) }}</div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </DataView>
  </div>
</template>

<script setup lang="ts">
import type { CampaignStatus } from '@/types/campaign';

const $campaignsStore = useCampaignsStore();
const { t } = useI18n({ useScope: 'local' });
const $toast = useToast();
const completedToasts = useState<Record<string, boolean>>(
  'campaign-completed-toasts',
  () => ({}),
);

function statusSeverity(status: CampaignStatus) {
  if (status === 'completed') return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'processing') return 'info';
  return 'secondary';
}

function formatRate(value: number) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function notifyCompletedCampaigns() {
  $campaignsStore.campaigns.forEach((campaign) => {
    if (campaign.status !== 'completed' || completedToasts.value[campaign.id]) {
      return;
    }

    completedToasts.value[campaign.id] = true;
    $toast.add({
      group: 'has-links',
      severity: 'success',
      summary: t('campaign_sent'),
      detail: {
        message: t('campaign_sent_detail'),
        button: {
          text: t('see_results'),
          action: () => navigateTo('/campaigns'),
        },
      },
      life: 12000,
    });
  });
}

async function refresh() {
  try {
    await $campaignsStore.fetchCampaigns();
    notifyCompletedCampaigns();
  } catch {
    $toast.add({
      severity: 'error',
      summary: t('campaigns'),
      detail: t('load_failed'),
      life: 4000,
    });
  }
}

onMounted(async () => {
  await refresh();
  $campaignsStore.startPolling();
});

onBeforeUnmount(() => {
  $campaignsStore.stopPolling();
});
</script>

<i18n lang="json">
{
  "en": {
    "campaigns": "Campaigns",
    "refresh": "Refresh",
    "no_campaigns": "No campaigns yet",
    "delivery": "Delivery",
    "opens": "Opens",
    "clicks": "Clicks",
    "recipients": "Recipients",
    "campaign_sent": "Campaign sent",
    "campaign_sent_detail": "Your campaign has been fully sent.",
    "see_results": "See results",
    "load_failed": "Unable to load campaigns"
  },
  "fr": {
    "campaigns": "Campagnes",
    "refresh": "Rafraichir",
    "no_campaigns": "Aucune campagne",
    "delivery": "Livraison",
    "opens": "Ouvertures",
    "clicks": "Clics",
    "recipients": "Destinataires",
    "campaign_sent": "Campagne envoyee",
    "campaign_sent_detail": "Votre campagne a ete entierement envoyee.",
    "see_results": "Voir les resultats",
    "load_failed": "Impossible de charger les campagnes"
  }
}
</i18n>
