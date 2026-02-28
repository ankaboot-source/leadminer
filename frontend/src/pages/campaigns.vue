<template>
  <div
    class="flex flex-col grow border border-surface-200 rounded-md p-4 gap-4"
  >
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

    <div
      v-if="$campaignsStore.isLoading && !$campaignsStore.campaigns.length"
      class="grid gap-3"
    >
      <CampaignsSkeleton />
    </div>

    <DataView
      v-else
      :value="$campaignsStore.campaigns"
      data-key="id"
      :paginator="true"
      :rows="10"
    >
      <template #empty>
        <div class="text-center py-8 text-surface-500">
          {{ t('no_campaigns') }}
        </div>
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
              <div class="flex items-center gap-2">
                <Button
                  v-if="canStopCampaign(campaign)"
                  size="small"
                  outlined
                  severity="warning"
                  icon="pi pi-stop"
                  :label="t('stop_campaign')"
                  :loading="isActionLoading(campaign.id, 'stop')"
                  @click="openStopDialog(campaign)"
                />
                <Button
                  v-if="canDeleteCampaign(campaign)"
                  size="small"
                  outlined
                  severity="danger"
                  icon="pi pi-trash"
                  :label="t('delete_campaign')"
                  :loading="isActionLoading(campaign.id, 'delete')"
                  @click="openDeleteDialog(campaign)"
                />
                <Tag
                  :value="statusLabel(campaign.status)"
                  :severity="statusSeverity(campaign.status)"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-4 text-sm">
              <div class="p-2 rounded bg-surface-50">
                <div class="text-surface-500 flex items-center gap-1">
                  <span>{{ t('delivery') }}</span>
                  <i
                    v-tooltip.top="deliveryTooltip(campaign)"
                    class="pi pi-info-circle text-xs text-surface-500 cursor-help"
                    tabindex="0"
                  />
                </div>
                <div class="font-semibold">
                  {{ campaign.delivered }}/{{ campaign.attempted }}
                </div>
                <div>{{ formatRate(campaign.delivery_rate) }}</div>
              </div>

              <div class="p-2 rounded bg-surface-50">
                <div class="text-surface-500 flex items-center gap-1">
                  <span>{{ t('opens') }}</span>
                  <i
                    v-tooltip.top="opensTooltip(campaign)"
                    class="pi pi-info-circle text-xs text-surface-500 cursor-help"
                    tabindex="0"
                  />
                </div>
                <div class="font-semibold">{{ campaign.opened }}</div>
                <div>{{ formatRate(campaign.opening_rate) }}</div>
              </div>

              <div class="p-2 rounded bg-surface-50">
                <div class="text-surface-500 flex items-center gap-1">
                  <span>{{ t('clicks') }}</span>
                  <i
                    v-tooltip.top="clicksTooltip(campaign)"
                    class="pi pi-info-circle text-xs text-surface-500 cursor-help"
                    tabindex="0"
                  />
                </div>
                <div class="font-semibold">{{ campaign.clicked }}</div>
                <div>{{ formatRate(campaign.clicking_rate) }}</div>
              </div>

              <div class="p-2 rounded bg-surface-50">
                <div class="text-surface-500 flex items-center gap-1">
                  <span>{{ t('unsubscribes') }}</span>
                  <i
                    v-tooltip.top="unsubscribeTooltip(campaign)"
                    class="pi pi-info-circle text-xs text-surface-500 cursor-help"
                    tabindex="0"
                  />
                </div>
                <div class="font-semibold">{{ campaign.unsubscribed }}</div>
                <div>{{ formatRate(campaign.unsubscribe_rate) }}</div>
              </div>

              <div class="p-2 rounded bg-surface-50">
                <div class="text-surface-500">{{ t('recipients') }}</div>
                <div class="font-semibold">{{ campaign.total_recipients }}</div>
                <div>{{ formatDate(campaign.created_at) }}</div>
              </div>
            </div>

            <div v-if="campaign.link_clicks?.length" class="mt-4">
              <div
                class="text-sm font-medium text-surface-600 mb-2 flex items-center gap-1"
              >
                <span>{{ t('top_clicked_links') }}</span>
                <i
                  v-tooltip.top="t('top_clicked_links_tooltip')"
                  class="pi pi-info-circle text-xs text-surface-500 cursor-help"
                  tabindex="0"
                />
              </div>
              <div class="flex flex-col gap-1 text-sm">
                <div
                  v-for="link in campaign.link_clicks"
                  :key="`${campaign.id}:${link.url}`"
                  class="flex items-center justify-between gap-3"
                >
                  <a
                    :href="link.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="truncate text-primary hover:underline"
                  >
                    {{ link.url }}
                  </a>
                  <span class="text-surface-600 shrink-0">
                    {{
                      t('unique_clicks_count', { count: link.unique_clicks })
                    }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </DataView>

    <Dialog
      v-model:visible="actionDialogVisible"
      modal
      :header="
        actionDialogType === 'stop' ? t('stop_campaign') : t('delete_campaign')
      "
      :style="{ width: '28rem', maxWidth: '95vw' }"
    >
      <div class="text-sm text-surface-700">
        {{
          actionDialogType === 'stop'
            ? t('stop_campaign_confirm')
            : t('delete_campaign_confirm')
        }}
      </div>

      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <Button outlined :label="t('cancel')" @click="closeActionDialog" />
          <Button
            :severity="actionDialogType === 'stop' ? 'warning' : 'danger'"
            :label="
              actionDialogType === 'stop'
                ? t('stop_campaign')
                : t('delete_campaign')
            "
            :loading="isDialogSubmitting"
            @click="confirmActionDialog"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import type { CampaignOverview, CampaignStatus } from '@/types/campaign';

const $campaignsStore = useCampaignsStore();
const { t } = useI18n({ useScope: 'local' });
const { $saasEdgeFunctions } = useNuxtApp();
const $toast = useToast();
type CampaignActionType = 'stop' | 'delete';
const actionDialogVisible = ref(false);
const actionDialogCampaign = ref<CampaignOverview | null>(null);
const actionDialogType = ref<CampaignActionType>('stop');
const isDialogSubmitting = ref(false);
const actionLoading = ref<Record<string, CampaignActionType | null>>({});

function isActionLoading(campaignId: string, type: CampaignActionType) {
  return actionLoading.value[campaignId] === type;
}

function statusSeverity(status: CampaignStatus) {
  if (status === 'completed') return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'cancelled') return 'warn';
  if (status === 'processing') return 'info';
  return 'secondary';
}

function statusLabel(status: CampaignStatus) {
  return t(`status_${status}`);
}

function formatRate(value: number) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function deliveryTooltip(campaign: CampaignOverview) {
  return t('delivery_tooltip', {
    delivered: campaign.delivered,
    attempted: campaign.attempted,
    hard: campaign.hard_bounced,
    soft: campaign.soft_bounced,
    other: campaign.failed_other,
  });
}

function opensTooltip(campaign: CampaignOverview) {
  if (!campaign.track_open) {
    return t('opens_tooltip_disabled');
  }

  return t('opens_tooltip_enabled');
}

function clicksTooltip(campaign: CampaignOverview) {
  if (!campaign.track_click) {
    return t('clicks_tooltip_disabled');
  }

  return t('clicks_tooltip_enabled');
}

function unsubscribeTooltip(campaign: CampaignOverview) {
  return t('unsubscribes_tooltip', {
    unsubscribed: campaign.unsubscribed,
    delivered: campaign.delivered,
  });
}

function canStopCampaign(campaign: CampaignOverview) {
  return campaign.status === 'queued' || campaign.status === 'processing';
}

function canDeleteCampaign(campaign: CampaignOverview) {
  return campaign.status !== 'processing';
}

function openStopDialog(campaign: CampaignOverview) {
  actionDialogCampaign.value = campaign;
  actionDialogType.value = 'stop';
  actionDialogVisible.value = true;
}

function openDeleteDialog(campaign: CampaignOverview) {
  actionDialogCampaign.value = campaign;
  actionDialogType.value = 'delete';
  actionDialogVisible.value = true;
}

function closeActionDialog() {
  actionDialogVisible.value = false;
  actionDialogCampaign.value = null;
}

function parseActionError(error: unknown) {
  const parsed = error as { data?: { error?: string; code?: string } };
  return parsed?.data?.error || t('action_failed');
}

async function confirmActionDialog() {
  const campaign = actionDialogCampaign.value;
  if (!campaign) return;

  isDialogSubmitting.value = true;
  actionLoading.value[campaign.id] = actionDialogType.value;

  try {
    if (actionDialogType.value === 'stop') {
      await $saasEdgeFunctions(
        `email-campaigns/campaigns/${campaign.id}/stop`,
        {
          method: 'POST',
        },
      );
      $toast.add({
        severity: 'success',
        summary: t('campaign_stopped'),
        detail: t('campaign_stopped_detail'),
        life: 3500,
      });
    } else {
      await $saasEdgeFunctions(`email-campaigns/campaigns/${campaign.id}`, {
        method: 'DELETE',
      });
      $toast.add({
        severity: 'success',
        summary: t('campaign_deleted'),
        detail: t('campaign_deleted_detail'),
        life: 3500,
      });
    }

    closeActionDialog();
    await refresh();
  } catch (error: unknown) {
    $toast.add({
      severity: 'error',
      summary:
        actionDialogType.value === 'stop'
          ? t('campaign_stop_failed')
          : t('campaign_delete_failed'),
      detail: parseActionError(error),
      life: 4500,
    });
  } finally {
    if (campaign) {
      actionLoading.value[campaign.id] = null;
    }
    isDialogSubmitting.value = false;
  }
}

function notifyTerminalCampaigns() {
  const campaignsToNotify =
    $campaignsStore.consumeTerminalCampaignNotifications();

  campaignsToNotify.forEach((campaign) => {
    if (campaign.status === 'failed') {
      $toast.add({
        group: 'has-links',
        severity: 'error',
        summary: t('campaign_failed'),
        detail: {
          message: t('campaign_failed_detail'),
          button: {
            text: t('see_results'),
            action: () => navigateTo('/campaigns'),
          },
        },
        life: 12000,
      });
      return;
    }

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
    notifyTerminalCampaigns();
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
    "unsubscribes": "Unsubscribes",
    "recipients": "Recipients",
    "delivery_tooltip": "Delivered: {delivered}/{attempted} | Hard bounces: {hard} | Soft bounces: {soft} | Other failures: {other}",
    "opens_tooltip_enabled": "Open tracking is enabled. Open rates are indicative only and can be inflated by Apple Mail Privacy Protection (especially on iOS) and email client prefetching.",
    "opens_tooltip_disabled": "Open tracking is disabled for this campaign, so opening metrics are not measured.",
    "clicks_tooltip_enabled": "Click tracking is enabled. Unique clicks are counted per recipient when they click tracked links.",
    "clicks_tooltip_disabled": "Click tracking is disabled for this campaign, so click metrics are not measured.",
    "unsubscribes_tooltip": "Unique unsubscribes: {unsubscribed} out of {delivered} delivered emails.",
    "top_clicked_links": "Top clicked links",
    "top_clicked_links_tooltip": "Unique clicks are counted once per recipient per link.",
    "unique_clicks_count": "{count} unique clicks",
    "campaign_sent": "Campaign sent",
    "campaign_sent_detail": "Your campaign has been fully sent.",
    "campaign_failed": "Campaign failed",
    "campaign_failed_detail": "The campaign could not deliver any email. Please review your sender configuration and try again.",
    "see_results": "See results",
    "load_failed": "Unable to load campaigns",
    "cancel": "Cancel",
    "stop_campaign": "Stop",
    "delete_campaign": "Delete",
    "stop_campaign_confirm": "Stop this campaign now? Pending emails will be skipped.",
    "delete_campaign_confirm": "Delete this campaign permanently? This action cannot be undone.",
    "campaign_stopped": "Campaign stopped",
    "campaign_stopped_detail": "Pending sends were cancelled.",
    "campaign_stop_failed": "Unable to stop campaign",
    "campaign_deleted": "Campaign deleted",
    "campaign_deleted_detail": "The campaign has been permanently deleted.",
    "campaign_delete_failed": "Unable to delete campaign",
    "action_failed": "Request failed",
    "status_queued": "Queued",
    "status_processing": "Processing",
    "status_completed": "Completed",
    "status_failed": "Failed",
    "status_cancelled": "Cancelled"
  },
  "fr": {
    "campaigns": "Campagnes",
    "refresh": "Rafraîchir",
    "no_campaigns": "Aucune campagne",
    "delivery": "Livraison",
    "opens": "Ouvertures",
    "clicks": "Clics",
    "unsubscribes": "Désinscriptions",
    "recipients": "Destinataires",
    "delivery_tooltip": "Livrés : {delivered}/{attempted} | Hard bounces : {hard} | Soft bounces : {soft} | Autres échecs : {other}",
    "opens_tooltip_enabled": "Le tracking des ouvertures est activé. Le taux d'ouverture reste indicatif et peut être surestimé (Apple Mail Privacy Protection, notamment sur iOS, et préchargements des clients email).",
    "opens_tooltip_disabled": "Le tracking des ouvertures est désactivé pour cette campagne, les ouvertures ne sont donc pas mesurées.",
    "clicks_tooltip_enabled": "Le tracking des clics est activé. Les clics uniques sont comptés une seule fois par destinataire et par lien.",
    "clicks_tooltip_disabled": "Le tracking des clics est désactivé pour cette campagne, les clics ne sont donc pas mesurés.",
    "unsubscribes_tooltip": "Désinscriptions uniques : {unsubscribed} sur {delivered} emails livrés.",
    "top_clicked_links": "Liens les plus cliqués",
    "top_clicked_links_tooltip": "Les clics uniques sont comptés une fois par destinataire et par lien.",
    "unique_clicks_count": "{count} clics uniques",
    "campaign_sent": "Campagne envoyée",
    "campaign_sent_detail": "Votre campagne a été entièrement envoyée.",
    "campaign_failed": "Campagne échouée",
    "campaign_failed_detail": "La campagne n'a pu envoyer aucun email. Vérifiez la configuration d'expédition puis réessayez.",
    "see_results": "Voir les résultats",
    "load_failed": "Impossible de charger les campagnes",
    "cancel": "Annuler",
    "stop_campaign": "Stopper",
    "delete_campaign": "Supprimer",
    "stop_campaign_confirm": "Stopper cette campagne maintenant ? Les envois en attente seront ignorés.",
    "delete_campaign_confirm": "Supprimer définitivement cette campagne ? Cette action est irréversible.",
    "campaign_stopped": "Campagne stoppée",
    "campaign_stopped_detail": "Les envois en attente ont été annulés.",
    "campaign_stop_failed": "Impossible de stopper la campagne",
    "campaign_deleted": "Campagne supprimée",
    "campaign_deleted_detail": "La campagne a été supprimée définitivement.",
    "campaign_delete_failed": "Impossible de supprimer la campagne",
    "action_failed": "Échec de la requête",
    "status_queued": "En file d'attente",
    "status_processing": "En cours",
    "status_completed": "Terminée",
    "status_failed": "Échouée",
    "status_cancelled": "Stoppée"
  }
}
</i18n>
