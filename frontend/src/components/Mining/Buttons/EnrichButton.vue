<template>
  <component
    :is="CreditsDialog"
    ref="CreditsDialogEnrichRef"
    engagement-type="contact"
    action-type="enrich"
    @secondary-action="startEnrichment(true)"
  />
  <Dialog
    v-model:visible="dialogVisible"
    modal
    :state="{
      maximized: true,
    }"
    :header="t('confirm_enrichment', contactsToEnrich?.length ?? 0)"
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
          @click="closeEnrichmentConfirmationDialog"
        />
        <div
          class="flex flex-col gap-2 sm:flex-row w-full sm:w-auto order-1 sm:order-2"
        >
          <Button
            :label="t('update_empty')"
            class="w-full sm:w-auto"
            @click="
              () => {
                closeEnrichmentConfirmationDialog();
                startEnrichment(true);
              }
            "
          />
          <Button
            :label="t('update_all')"
            class="w-full sm:w-auto"
            @click="
              () => {
                closeEnrichmentConfirmationDialog();
                startEnrichment(false);
              }
            "
          />
        </div>
      </div>
    </template>
  </Dialog>
  <Button
    :id="`${source}-enrich-button`"
    v-tooltip="t('button.tooltip')"
    :class="{ 'border-solid border-2 border-black': bordered }"
    severity="contrast"
    icon-pos="right"
    :label="t('button.start_enrichment')"
    pt:label:class="hidden md:block"
    :disabled="isEnrichDisabled"
    @click="onClickEnrich"
  >
    <template #icon>
      <span class="p-button-icon p-button-icon-right">
        <span v-if="!$leadminerStore.activeEnrichment">💎</span>
        <i v-else class="pi pi-spin pi-spinner mr-1.5" />
      </span>
    </template>
  </Button>
  <EnrichGdprDialog
    ref="enrichGdprDialogRef"
    @has-given-consent="onAcceptEnrich"
  />
</template>
<script setup lang="ts">
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';

import type { EnrichContactResponse, EnrichmentTask } from '@/types/enrichment';
import {
  CreditsDialog,
  CreditsDialogEnrichRef,
  openCreditsDialog,
} from '@/utils/credits';
import type { Contact } from '~/types/contact';
import EnrichGdprDialog from '../EnrichGdprDialog.vue';

const { t } = useI18n({
  useScope: 'local',
});

const props = defineProps<{
  startOnMounted?: boolean;
  enrichmentRealtimeCallback: (
    payload: RealtimePostgresChangesPayload<EnrichmentTask>,
  ) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  enrichmentRequestResponseCallback: ({ response }: any) => void;
  enrichAllContacts: boolean;
  contactsToEnrich?: Partial<Contact>[];
  bordered?: boolean;
  skipDialog?: boolean;
  source?: 'stepper' | 'datatable' | 'contact';
}>();

const { $api } = useNuxtApp();

const $toast = useToast();
const $leadminerStore = useLeadminerStore();
const $contactsStore = useContactsStore();
const dialogVisible = ref(false);

const {
  startOnMounted,
  enrichmentRealtimeCallback,
  enrichmentRequestResponseCallback,
  bordered,
} = props;

const enrichAllContacts = toRef(() => props.enrichAllContacts);
const contactsToEnrich = toRef(() => props.contactsToEnrich);
const skipDialog = toRef(() => props.skipDialog);

const totalTasks = ref(0);
const enrichmentCompleted = ref(false);

let subscription: RealtimeChannel;

function showNotification(
  severity: 'info' | 'warn' | 'error' | 'success' | 'secondary' | 'contrast',
  summary: string,
  detail: string,
  group?: 'achievement',
) {
  $toast.add({
    severity,
    summary,
    detail,
    group,
    life: 5000,
  });
}

function stopEnrichment() {
  if (subscription) {
    subscription.unsubscribe();
  }
  $leadminerStore.activeEnrichment = false;
}

function handleEnrichmentProgressNotification(task: EnrichmentTask) {
  const {
    status,
    details: { total_enriched },
  } = task;

  if (task.status === 'running') return;

  // status done, canceled
  stopEnrichment();

  if (status === 'canceled') {
    showNotification(
      'error',
      t('notification.summary'),
      t('notification.enrichment_canceled'),
    );
  } else if (total_enriched > 0) {
    showNotification(
      'success',
      t('notification.summary'),
      t('notification.enrichment_completed', {
        n: total_enriched,
        enriched: total_enriched.toLocaleString(),
      }),
      'achievement',
    );
  } else {
    showNotification(
      'info',
      t('notification.summary'),
      t('notification.no_additional_info'),
    );
  }
}

function setupEnrichmentRealtime() {
  subscription = useSupabaseClient()
    .channel('enrichment-tracker')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'private',
        table: 'tasks',
        filter: `category=eq.${'enriching'}`,
      },
      (payload: RealtimePostgresChangesPayload<EnrichmentTask>) => {
        enrichmentRealtimeCallback(payload);
        const task = payload.new as EnrichmentTask;
        handleEnrichmentProgressNotification(task);
      },
    );
  subscription.subscribe();
}

async function enrichPerson(
  updateEmptyFieldsOnly: boolean,
  contacts: Partial<Contact>,
) {
  totalTasks.value = 1;
  await $api<EnrichContactResponse>('/enrich/person/', {
    method: 'POST',
    body: {
      updateEmptyFieldsOnly,
      enrichAllContacts: false,
      contact: contacts,
    },
    onResponse({ response }) {
      enrichmentRequestResponseCallback({ response });
      const { total, available, task } = response._data;

      if (response.status === 402) {
        stopEnrichment();
        openCreditsDialog(CreditsDialogEnrichRef, true, total, available, 0);
      } else if (response.status === 200) {
        handleEnrichmentProgressNotification(task);
      } else if (response.status === 503) {
        showNotification(
          'error',
          t('notification.summary'),
          t('notification.enricher_configuration_required'),
        );
      }
    },
  });
}

async function enrichPersonBulk(
  updateEmptyFieldsOnly: boolean,
  enrichAll: boolean,
  contacts: Partial<Contact>[],
) {
  showNotification(
    'success',
    t('notification.summary'),
    t('notification.enrichment_started', { toEnrich: contacts.length }),
  );
  await $api<EnrichContactResponse>('/enrich/person/bulk', {
    method: 'POST',
    body: {
      updateEmptyFieldsOnly,
      enrichAllContacts: enrichAll,
      contacts: enrichAll ? undefined : contacts,
    },
    onResponse({ response }) {
      enrichmentRequestResponseCallback({ response });
      const { total, available, task } = response._data;

      if (response.status === 402) {
        stopEnrichment();
        openCreditsDialog(CreditsDialogEnrichRef, true, total, available, 0);
      } else if (response.status === 200) {
        if (task.status === 'running') {
          setupEnrichmentRealtime();
        } else {
          handleEnrichmentProgressNotification(task);
        }
      } else if (response.status === 503) {
        showNotification(
          'error',
          t('notification.summary'),
          t('notification.enricher_configuration_required'),
        );
      }
    },
  });
}

async function startEnrichment(updateEmptyFieldsOnly: boolean) {
  try {
    totalTasks.value = 0;
    enrichmentCompleted.value = false;
    $leadminerStore.activeEnrichment = true;

    if (contactsToEnrich.value?.length === 1) {
      await enrichPerson(updateEmptyFieldsOnly, contactsToEnrich.value[0]);
    } else {
      await enrichPersonBulk(
        updateEmptyFieldsOnly,
        enrichAllContacts.value,
        contactsToEnrich.value!,
      );
    }
  } catch (err) {
    stopEnrichment();
    throw err;
  }
}

onMounted(async () => {
  if (startOnMounted) {
    await startEnrichment(true);
  }
});

const enrichGdprDialogRef = ref();
const $profile = useSupabaseUserProfile();
const hasAcceptedEnriching = computed(
  () => $profile.value?.gdpr_details.hasAcceptedEnriching,
);

/**
 * Verifies if user has accepted enriching conditions (using `hasAcceptedEnriching` of `$profile`), then proceeds to the enrichment confirmation dialog
 * @param justAcceptedEnrich : is a workaround as `hasAcceptedEnriching` of `$profile` can still be not updated from the realtime
 */
function openEnrichmentConfirmationDialog(justAcceptedEnrich?: boolean) {
  if (!justAcceptedEnrich && !hasAcceptedEnriching.value) {
    enrichGdprDialogRef.value.openModal();
    return;
  }

  const creditsDialogOpened = useCreditsDialog(
    CreditsDialogEnrichRef,
    contactsToEnrich.value?.map(({ email }) => email as string),
  );
  if (creditsDialogOpened) return;

  if (skipDialog.value) {
    startEnrichment(false);
  } else dialogVisible.value = true;
}

function onAcceptEnrich() {
  const justAcceptedEnrich = true;
  openEnrichmentConfirmationDialog(justAcceptedEnrich);
}

function onClickEnrich() {
  openEnrichmentConfirmationDialog();
}

const closeEnrichmentConfirmationDialog = () => {
  dialogVisible.value = false;
};

const isEnrichDisabled = computed(
  () =>
    $leadminerStore.activeEnrichment ||
    (!enrichAllContacts.value && !contactsToEnrich.value?.length) ||
    (enrichAllContacts.value && !$contactsStore.selectedContactsCount),
);
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
      "enrichment_started_one": "Enrichment on {toEnrich} contact has started. Please wait a few minutes.",
      "enrichment_started": "Enrichment on {toEnrich} contacts has started. Please wait a few minutes.",
      "enrichment_completed": "No data have been found. | {enriched} contact has been successfully enriched. | {enriched} contacts has been successfully enriched.",
      "enrichment_canceled": "Your contact enrichment has been canceled.",
      "already_enriched": "Contacts you selected are already enriched.",
      "no_additional_info": "Enrichment completed, but no additional information was found for the selected contacts.",
      "enricher_configuration_required": "Enricher configuration is required."
    },
    "button": {
      "tooltip": "Extract public information on contacts I've already a relation with using third-party tools",
      "start_enrichment": "Enrich",
      "halt_enrichment": "Cancel enrichment"
    }
  },
  "fr": {
    "update_all": "Tout remplir",
    "update_empty": "Remplir les champs vides",
    "update_confirmation": "La mise à jour des informations du contact peut écraser les détails existants. Comment aimeriez-vous procéder ?",
    "confirm_enrichment": "Confirmer l'enrichissement du contact | Confirmer l'enrichissement des {n} contacts",
    "notification": {
      "summary": "Enrichir",
      "enrichment_started": "L'enrichissement de {toEnrich} contacts a commencé. Veuillez patienter quelques minutes.",
      "enrichment_started_one": "L'enrichissement de {toEnrich} contact a commencé. Veuillez patienter quelques minutes.",
      "enrichment_completed": "Aucune nouvelle information n'a été trouvée. | {enriched} contact a été enrichi avec succès | {enriched} contacts ont été enrichis avec succès.",
      "enrichment_canceled": "L'enrichissement de votre contact a été annulé.",
      "already_enriched": "Ce contact est déjà enrichi.",
      "no_additional_info": "L'enrichissement est terminé, mais aucune information supplémentaire n'a été trouvée pour les contacts sélectionnés.",
      "enricher_configuration_required": "Configuration de l'enrichisseur est requise."
    },
    "button": {
      "tooltip": "Extraire des informations publiques sur les contacts avec lesquels je suis en relation à l'aide d'outils tiers.",
      "start_enrichment": "Enrichir",
      "halt_enrichment": "Annuler l'enrichissement"
    }
  }
}
</i18n>
