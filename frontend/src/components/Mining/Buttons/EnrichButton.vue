<template>
  <CreditsDialog
    ref="CreditsDialogRef"
    engagement-type="contacts"
    action-type="enrich"
    @secondary-action="startEnrichment(true)"
  />
  <Dialog
    v-model:visible="dialogVisible"
    :state="{
      maximized: true,
    }"
    header="Confirm Contact Enrichment"
    class="w-full sm:w-[35rem]"
  >
    <p>
      Updating the contact's information may overwrite the existing details. How
      would you like to proceed?
    </p>
    <template #footer>
      <div class="flex flex-col sm:flex-row justify-between w-full gap-2">
        <Button
          label="Cancel"
          severity="secondary"
          class="w-full sm:w-auto order-3 sm:order-1"
          @click="closeDialog"
        />
        <div
          class="flex flex-col gap-2 sm:flex-row w-full sm:w-auto order-1 sm:order-2"
        >
          <Button
            label="Update Empty Fields"
            class="w-full sm:w-auto"
            @click="
              () => {
                closeDialog();
                startEnrichment(true);
              }
            "
          />
          <Button
            label="Update All"
            class="w-full sm:w-auto"
            @click="
              () => {
                closeDialog();
                startEnrichment(true);
              }
            "
          />
        </div>
      </div>
    </template>
  </Dialog>
  <Button
    v-if="enrichmentStatus"
    class="w-full md:w-max border-solid border-2 border-black"
    severity="contrast"
    icon="pi pi-stop"
    icon-pos="right"
    :label="t('button.halt_enrichment')"
    @click="stopEnrichment"
  />
  <Button
    v-else
    class="w-full md:w-max border-solid border-2 border-black"
    severity="contrast"
    icon-pos="right"
    :label="t('button.start_enrichment')"
    @click="openDialog"
  >
    <template #icon>
      <span class="p-button-icon p-button-icon-right">💎</span>
    </template>
  </Button>
</template>
<script setup lang="ts">
import {
  RealtimeChannel,
  type RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';
import CreditsDialog from '@/components/Credits/InsufficientCreditsDialog.vue';
import {
  type EnrichmentTask,
  type EnrichContactResponse,
} from '@/types/enrichment';

const { t } = useI18n({
  useScope: 'local',
});

const enrichmentStatus = defineModel<boolean>('enrichmentStatus');

const {
  startOnMounted,
  enrichmentRealtimeCallback,
  enrichmentRequestResponseCallback,
} = defineProps<{
  startOnMounted: boolean;
  enrichmentRealtimeCallback: (
    payload: RealtimePostgresChangesPayload<EnrichmentTask>
  ) => void;
  enrichmentRequestResponseCallback: ({ response }: any) => void;
}>();

const { $api } = useNuxtApp();

const $toast = useToast();
const $contactStore = useContactsStore();
const $leadminerStore = useLeadminerStore();

const contactsToEnrich = computed(() =>
  $contactStore.filtered.map((contact) => contact.email)
);
const CreditsDialogRef = ref<InstanceType<typeof CreditsDialog>>();

const dialogVisible = ref(false);

const openDialog = () => {
  dialogVisible.value = true;
};

const closeDialog = () => {
  dialogVisible.value = false;
};

function showNotification(
  severity: 'info' | 'warn' | 'error' | 'success' | 'secondary' | 'contrast',
  summary: string,
  detail: string
) {
  $toast.add({
    severity,
    summary,
    detail,
    life: 5000,
  });
}

let subscription: RealtimeChannel;

function stopEnrichment() {
  if (subscription) {
    subscription.unsubscribe();
  }
  enrichmentStatus.value = false;
  $leadminerStore.activeEnrichment = false;
}

function setupEnrichmentRealtime() {
  subscription = useSupabaseClient()
    .channel('enrichement-tracker')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'tasks',
        filter: `category=eq.${'enriching'}`,
      },
      (payload: RealtimePostgresChangesPayload<EnrichmentTask>) => {
        enrichmentRealtimeCallback(payload);

        const { status, details } = payload.new as EnrichmentTask;
        const { total, enriched } = details.result;

        switch (status) {
          case 'running':
            showNotification(
              'success',
              t('notification.summary'),
              t('notification.enrichment_started', {
                total: total.toLocaleString(),
              })
            );
            break;

          case 'done':
            if (enriched) {
              showNotification(
                'success',
                t('notification.summary'),
                t('notification.enrichment_completed', {
                  total: total.toLocaleString(),
                  enriched: enriched.toLocaleString(),
                })
              );
            } else {
              showNotification(
                'info',
                t('notification.summary'),
                t('notification.no_additional_info')
              );
            }
            stopEnrichment();
            break;

          case 'canceled':
            showNotification(
              'error',
              t('notification.summary'),
              t('notification.enrichment_canceled')
            );
            stopEnrichment();
            break;

          default:
            break;
        }
      }
    );
  subscription.subscribe();
}

async function startEnrichment(partial: boolean) {
  try {
    enrichmentStatus.value = true;
    $leadminerStore.activeEnrichment = true;
    setupEnrichmentRealtime();
    await $api<EnrichContactResponse>('/enrichement/enrichAsync', {
      method: 'POST',
      body: {
        partial,
        emails: contactsToEnrich.value,
      },
      onResponse({ response }) {
        enrichmentRequestResponseCallback({ response });
        const { total, available, alreadyEnriched } = response._data;

        if (alreadyEnriched && response.status === 200) {
          stopEnrichment();
          showNotification(
            'info',
            t('notification.summary'),
            t('notification.already_enriched')
          );
        }

        if (response.status === 402) {
          stopEnrichment();
          CreditsDialogRef.value?.openModal(
            available === 0,
            total,
            available,
            0
          );
        }
      },
    });
  } catch (err) {
    stopEnrichment();
    throw err;
  }
}

onMounted(async () => {
  if (startOnMounted) {
    await startEnrichment(false);
  }
});

onUnmounted(() => {
  stopEnrichment();
});
</script>
<i18n lang="json">
{
  "en": {
    "notification": {
      "summary": "Enrich",
      "enrichment_started": "Enrichment is running for {total} contacts.",
      "enrichment_completed": "{total}/{enriched} of your contacts has been successfully enriched.",
      "enrichment_canceled": "Your contact enrichment has been canceled.",
      "already_enriched": "Contacts you selected are already enriched.",
      "no_additional_info": "Enrichment completed, but no additional information was found for the selected contacts."
    },
    "button": {
      "start_enrichment": "Enrich",
      "halt_enrichment": "Cancel enrichment",
      "start_new_mining": "Start a new mining"
    }
  },
  "fr": {
    "notification": {
      "summary": "Enrichir",
      "enrichment_started": "L'enrichissement est en cours pour ${total} contacts.",
      "enrichment_completed": "${total}/${enriched} de vos contacts ont été enrichis avec succès.",
      "enrichment_canceled": "L'enrichissement de votre contact a été annulé.",
      "already_enriched": "Ce contact est déjà enrichi.",
      "no_additional_info": "L'enrichissement est terminé, mais aucune information supplémentaire n'a été trouvée pour les contacts sélectionnés."
    },
    "button": {
      "start_enrichment": "Enrichissez",
      "halt_enrichment": "Annuler l'enrichissement",
      "start_new_mining": "Commencer une nouvelle extraction"
    }
  }
}
</i18n>
