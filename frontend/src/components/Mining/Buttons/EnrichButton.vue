<template>
  <CreditsDialog
    ref="CreditsDialogRef"
    engagement-type="contacts"
    action-type="enrich"
    @secondary-action="startEnrichment(true)"
  />
  <Dialog
    v-model:visible="dialogVisible"
    modal
    :state="{
      maximized: true,
    }"
    :header="
      t(
        'confirm_enrichment',
        contactsToEnrich?.length ?? $contactsStore.selectedLength
      )
    "
    class="w-full sm:w-[35rem]"
  >
    <p>
      {{ t('update_confirmation') }}
    </p>
    <template #footer>
      <div class="flex flex-col sm:flex-row justify-between w-full gap-2">
        <Button
          :label="$t('common.cancel')"
          severity="secondary"
          class="w-full sm:w-auto order-3 sm:order-1"
          @click="closeDialog"
        />
        <div
          class="flex flex-col gap-2 sm:flex-row w-full sm:w-auto order-1 sm:order-2"
        >
          <Button
            :label="t('update_empty')"
            class="w-full sm:w-auto"
            @click="
              () => {
                closeDialog();
                startEnrichment(true);
              }
            "
          />
          <Button
            :label="t('update_all')"
            class="w-full sm:w-auto"
            @click="
              () => {
                closeDialog();
                startEnrichment(false);
              }
            "
          />
        </div>
      </div>
    </template>
  </Dialog>
  <Button
    :class="{ 'border-solid border-2 border-black': bordered }"
    severity="contrast"
    icon-pos="right"
    :label="t('button.start_enrichment')"
    pt:label:class="hidden md:block"
    :disabled="enrichmentStatus"
    @click="openDialog"
  >
    <template #icon>
      <span class="p-button-icon p-button-icon-right">
        <span v-if="!enrichmentStatus">💎</span>
        <i v-else class="pi pi-spin pi-spinner mr-1.5" />
      </span>
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
  type EnrichContactResponse,
  type EnrichmentTask,
} from '@/types/enrichment';

const { t } = useI18n({
  useScope: 'local',
});

const enrichmentStatus = defineModel<boolean>('enrichmentStatus');

const props = defineProps<{
  startOnMounted: boolean;
  enrichmentRealtimeCallback: (
    payload: RealtimePostgresChangesPayload<EnrichmentTask>
  ) => void;
  enrichmentRequestResponseCallback: ({ response }: any) => void;
  contactsToEnrich?: string[];
  bordered?: boolean;
  skipDialog?: boolean;
}>();

const { $api } = useNuxtApp();

const $toast = useToast();
const $leadminerStore = useLeadminerStore();
const $contactsStore = useContactsStore();
const CreditsDialogRef = ref<InstanceType<typeof CreditsDialog>>();

const dialogVisible = ref(false);

const {
  startOnMounted,
  enrichmentRealtimeCallback,
  enrichmentRequestResponseCallback,
  bordered,
  skipDialog,
} = props;
const contactsToEnrich = toRef(() => props.contactsToEnrich);

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

const enrichmentMessage = (total: number) =>
  total > 1
    ? t('notification.enrichment_started_plural', {
        total: total.toLocaleString(),
      })
    : t('notification.enrichment_started');

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
              enrichmentMessage(total)
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
        emails: contactsToEnrich.value ?? $contactsStore.selected,
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

const openDialog = () => {
  if (skipDialog) startEnrichment(false);
  else dialogVisible.value = true;
};

const closeDialog = () => {
  dialogVisible.value = false;
};
</script>
<i18n lang="json">
{
  "en": {
    "update_all": "Fill all",
    "update_empty": "Fill empty fields",
    "update_confirmation": "Updating the contact's information may overwrite the existing details. How would you like to proceed?",
    "confirm_enrichment": "Confirm contact enrichment | Confirm {n} contacts enrichment",
    "notification": {
      "summary": "Enrich",
      "enrichment_started": "Enrichment is running.",
      "enrichment_started_plural": "Enrichment is running for {total} contacts.",
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
    "update_all": "Remplir tout",
    "update_empty": "Remplir les champs vides",
    "update_confirmation": "La mise à jour des informations du contact peut écraser les détails existants. Comment aimeriez-vous procéder ?",
    "confirm_enrichment": "Confirmer l'enrichissement de contact | Confirmer l'enrichissement des {n} contacts",
    "notification": {
      "summary": "Enrichir",
      "enrichment_started": "L'enrichissement est en cours.",
      "enrichment_started_plural": "L'enrichissement est en cours pour ${total} contacts.",
      "enrichment_completed": "${total}/${enriched} de vos contacts ont été enrichis avec succès.",
      "enrichment_canceled": "L'enrichissement de votre contact a été annulé.",
      "already_enriched": "Ce contact est déjà enrichi.",
      "no_additional_info": "L'enrichissement est terminé, mais aucune information supplémentaire n'a été trouvée pour les contacts sélectionnés."
    },
    "button": {
      "start_enrichment": "Enrichir",
      "halt_enrichment": "Annuler l'enrichissement",
      "start_new_mining": "Commencer une nouvelle extraction"
    }
  }
}
</i18n>
