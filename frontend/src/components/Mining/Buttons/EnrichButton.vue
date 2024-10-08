<template>
  <component
    :is="CreditsDialog"
    ref="CreditsDialogRef"
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
    :class="{ 'border-solid border-2 border-black': bordered }"
    severity="contrast"
    icon-pos="right"
    :label="t('button.start_enrichment')"
    pt:label:class="hidden md:block"
    :disabled="
      $leadminerStore.activeEnrichment ||
      (!enrichAllContacts && !contactsToEnrich?.length) ||
      (enrichAllContacts && !$contactsStore.selectedContactsCount)
    "
    @click="openEnrichmentConfirmationDialog"
  >
    <template #icon>
      <span class="p-button-icon p-button-icon-right">
        <span v-if="!$leadminerStore.activeEnrichment">💎</span>
        <i v-else class="pi pi-spin pi-spinner mr-1.5" />
      </span>
    </template>
  </Button>
</template>
<script setup lang="ts">
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';

import type { EnrichContactResponse, EnrichmentTask } from '@/types/enrichment';
import type { Contact } from '~/types/contact';
import {
  CreditsDialog,
  CreditsDialogRef,
  openCreditsDialog,
} from '@/utils/credits';

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
const enrichmentTasks = new Map<string, EnrichmentTask>();
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
  enrichmentTasks.clear();
  $leadminerStore.activeEnrichment = false;
}

function handleEnrichmentNotification(tasks: EnrichmentTask[]) {
  let totalEnriched = 0;

  const error = tasks.every((task) => {
    if (task.status === 'canceled') {
      console.error(`Task ${task.id} canceled: ${task.details.error}`);
      return true;
    }
    return false;
  });

  if (error) {
    showNotification(
      'error',
      t('notification.summary'),
      t('notification.enrichment_canceled'),
    );
    return;
  }

  for (const task of tasks) {
    if (task.status === 'done') {
      totalEnriched += task.details.progress.enriched;
    }
  }

  if (totalEnriched > 0) {
    showNotification(
      'success',
      t('notification.summary'),
      t('notification.enrichment_completed', {
        n: totalEnriched,
        enriched: totalEnriched.toLocaleString(),
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

function isEnrichmentCompleted() {
  const currentTasks = Array.from(enrichmentTasks.values()) as EnrichmentTask[];
  return Boolean(
    (totalTasks.value > 0 || currentTasks.length === totalTasks.value) &&
      !currentTasks.some(({ status }) => status === 'running'),
  );
}

function updateEnrichmentProgress(tasks: EnrichmentTask[]) {
  for (const task of tasks) {
    const existingTask = enrichmentTasks.get(task.id);
    if (!existingTask || existingTask.status === 'running') {
      enrichmentTasks.set(task.id, task);
    }
  }

  enrichmentCompleted.value = isEnrichmentCompleted();

  if (enrichmentCompleted.value) {
    handleEnrichmentNotification(Array.from(enrichmentTasks.values()));
    stopEnrichment();
  }
}

function setupEnrichmentRealtime() {
  subscription = useSupabaseClient()
    .channel('enrichment-tracker')
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
        const task = payload.new as EnrichmentTask;
        updateEnrichmentProgress([task]);
      },
    );
  subscription.subscribe();
}

async function enrichPerson(
  updateEmptyFieldsOnly: boolean,
  contacts: Partial<Contact>,
) {
  await $api<EnrichContactResponse>('/enrich/person/', {
    method: 'POST',
    body: {
      updateEmptyFieldsOnly,
      enrichAllContacts: false,
      contact: contacts,
    },
    onResponse({ response }) {
      enrichmentRequestResponseCallback({ response });
      const { total, available, alreadyEnriched, tasks } = response._data;

      if (response.status === 402) {
        stopEnrichment();
        openCreditsDialog(true, total, available, 0);
      } else if (response.status === 200) {
        if (alreadyEnriched) {
          stopEnrichment();
          showNotification(
            'info',
            t('notification.summary'),
            t('notification.already_enriched'),
          );
        } else if (tasks.length) {
          totalTasks.value = tasks.length;
          updateEnrichmentProgress(tasks);
        }
      }
    },
  });
}

async function enrichPersonBulk(
  updateEmptyFieldsOnly: boolean,
  enrichAll: boolean,
  contacts: Partial<Contact>[],
) {
  await $api<EnrichContactResponse>('/enrich/person/bulk', {
    method: 'POST',
    body: {
      updateEmptyFieldsOnly,
      enrichAllContacts: enrichAll,
      contacts: enrichAll ? undefined : contacts,
    },
    onResponse({ response }) {
      enrichmentRequestResponseCallback({ response });
      const { total, available, alreadyEnriched, tasks } = response._data;

      if (response.status === 402) {
        stopEnrichment();
        openCreditsDialog(true, total, available, 0);
      } else if (response.status === 200) {
        if (alreadyEnriched) {
          stopEnrichment();
          showNotification(
            'info',
            t('notification.summary'),
            t('notification.already_enriched'),
          );
        } else if (tasks?.length) {
          totalTasks.value = tasks.length;
          updateEnrichmentProgress(tasks);
        }
      }
    },
  });
}

async function startEnrichment(updateEmptyFieldsOnly: boolean) {
  try {
    totalTasks.value = 0;
    enrichmentTasks.clear();
    enrichmentCompleted.value = false;
    $leadminerStore.activeEnrichment = true;
    setupEnrichmentRealtime();

    if (contactsToEnrich.value?.length === 1) {
      await enrichPerson(updateEmptyFieldsOnly, contactsToEnrich.value![0]);
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

const openEnrichmentConfirmationDialog = () => {
  const creditsDialogOpened = useCreditsDialog(
    contactsToEnrich.value?.map(({ email }) => email as string),
  );
  if (creditsDialogOpened) return;

  if (skipDialog.value) {
    startEnrichment(false);
  } else dialogVisible.value = true;
};

const closeEnrichmentConfirmationDialog = () => {
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
      "enrichment_completed": "No data have been found. | {enriched} contact has been successfully enriched. | {enriched} contacts has been successfully enriched.",
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
    "update_all": "Tout remplir",
    "update_empty": "Remplir les champs vides",
    "update_confirmation": "La mise à jour des informations du contact peut écraser les détails existants. Comment aimeriez-vous procéder ?",
    "confirm_enrichment": "Confirmer l'enrichissement du contact | Confirmer l'enrichissement des {n} contacts",
    "notification": {
      "summary": "Enrichir",
      "enrichment_completed": "Aucune nouvelle information n'a été trouvée. | {enriched} contact a été enrichi avec succès | {enriched} contacts ont été enrichis avec succès.",
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
