<template>
  <ProgressCard
    v-if="boxes"
    :status="$leadminerStore.activeMiningTask"
    :total="totalEmails"
    :current="extractedEmails"
    :rate="AVERAGE_EXTRACTION_RATE"
    :started="taskStartedAt"
    :progress="extractionProgress"
    :progress-tooltip="progressTooltip"
    :mode="sourceType === 'file' ? 'indeterminate' : 'determinate'"
  >
    <template #progress-title>
      <div v-if="$leadminerStore.isLoadingBoxes">
        <i class="pi pi-spin pi-spinner mr-1.5" />
        {{ t('retrieving_mailboxes') }}
      </div>
      <div v-else-if="!$leadminerStore.activeMiningTask">
        {{ totalMined.toLocaleString() }}
        {{ extractionProgress < 1 ? totalToMineMessage : totalMinedMessage }}
      </div>
      <div v-else>
        <i class="pi pi-spin pi-spinner mr-1.5" />
        {{ t('is_mining') }}
      </div>
    </template>
  </ProgressCard>

  <div class="flex flex-col md:flex-row justify-center gap-2">
    <Button
      v-if="!$leadminerStore.activeMiningTask"
      id="mine-stepper-settings-button"
      :disabled="
        $leadminerStore.isLoadingStartMining || $leadminerStore.isLoadingBoxes
      "
      class="text-black"
      severity="secondary"
      :label="t('fine_tune_mining')"
      outlined
      @click="openMiningSettings"
    />

    <Button
      v-if="!$leadminerStore.activeMiningTask"
      id="mine-stepper-start-button"
      :disabled="
        $leadminerStore.isLoadingBoxes ||
        $leadminerStore.isLoadingStartMining ||
        totalEmails === 0
      "
      :loading="$leadminerStore.isLoadingStartMining"
      :label="$t('common.start_mining_now')"
      @click="startMining"
    />
    <Button
      v-else
      id="mine-stepper-stop-button"
      :loading="$leadminerStore?.isLoadingStartMining"
      icon="pi pi-stop"
      icon-pos="right"
      severity="danger"
      outlined
      :label="t('halt_mining')"
      @click="haltMining"
    />
  </div>

  <importFileDialog ref="importFileDialogRef" />
  <MiningSettingsDialog
    ref="miningSettingsDialogRef"
    :total-emails="totalEmails"
    :is-loading-boxes="$leadminerStore.isLoadingBoxes"
  />
</template>
<script setup lang="ts">
// @ts-expect-error "No type definitions"
import objectScan from 'object-scan';
import { FetchError } from 'ofetch';
import type { TreeSelectionKeys } from 'primevue/tree';

import ProgressCard from '@/components/ProgressCard.vue';
import { useWebNotification } from '@vueuse/core';
import MiningSettingsDialog from '~/components/Mining/MiningSettingsDialog.vue';
import type { MiningSource } from '~/types/mining';
import importFileDialog from '../ImportFileDialog.vue';

const importFileDialogRef = ref();
const { t } = useI18n({
  useScope: 'local',
});

const { t: $t } = useI18n({
  useScope: 'global',
});

const { miningSource } = defineProps<{
  miningSource: MiningSource;
}>();

const sourceType = computed(() => $leadminerStore.miningType);
const $toast = useToast();
const $stepper = useMiningStepper();
const $leadminerStore = useLeadminerStore();
const $contactsStore = useContactsStore();
const $consentSidebar = useMiningConsentSidebar();

const AVERAGE_EXTRACTION_RATE =
  parseInt(useRuntimeConfig().public.AVERAGE_EXTRACTION_RATE) || 130;
const canceled = ref<boolean>(false);
const miningSettingsDialogRef =
  ref<InstanceType<typeof MiningSettingsDialog>>();

const boxes = computed(() => $leadminerStore.boxes);
const selectedBoxes = computed<TreeSelectionKeys>(
  () => $leadminerStore.selectedBoxes,
);

const taskStartedAt = computed(() => $leadminerStore.miningStartedAt);

const totalEmails = computed<number>(() => {
  if (sourceType.value === 'file') {
    return $leadminerStore.selectedFile?.contacts.length || 0;
  }

  if (sourceType.value === 'email') {
    console.log($leadminerStore.totalMessages);
    return $leadminerStore.totalMessages > 0
      ? $leadminerStore.totalMessages
      : objectScan(['**.{total}'], {
          joined: true,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          filterFn: ({ parent, property, value, context }: any) => {
            if (
              property === 'total' &&
              parent.key &&
              parent.key in selectedBoxes.value &&
              selectedBoxes.value[parent.key].checked
            ) {
              context.sum += value;
            }
          },
        })(boxes.value, { sum: 0 }).sum;
  }

  return 0;
});

const totalMined = computed(() =>
  sourceType.value === 'email'
    ? totalEmails.value
    : $leadminerStore.createdContacts,
);
const totalToMineMessage = computed(() =>
  $leadminerStore.miningType === 'email'
    ? t('emails_to_mine', totalEmails.value)
    : t('contacts_to_mine', totalEmails.value),
);
const totalMinedMessage = computed(() =>
  $leadminerStore.miningType === 'email'
    ? t('emails_mined', totalEmails.value)
    : t('contacts_mined', $leadminerStore.createdContacts.toLocaleString()),
);

const extractionFinished = computed(() => $leadminerStore.extractionFinished);
const extractedEmails = computed(() => $leadminerStore.extractedEmails);

const extractionProgress = computed(() =>
  $leadminerStore.fetchingFinished && !canceled.value
    ? extractedEmails.value / $leadminerStore.scannedEmails || 0
    : extractedEmails.value / totalEmails.value || 0,
);

const progressTooltip = computed(() =>
  $leadminerStore.miningType === 'email'
    ? t('mined_total_emails', {
        extractedEmails: extractedEmails.value.toLocaleString(),
        totalEmails: totalEmails.value.toLocaleString(),
      })
    : t('mined_total_contacts', {
        extractedEmails: $leadminerStore.createdContacts.toLocaleString(),
        totalEmails: totalEmails.value.toLocaleString(),
      }),
);

onMounted(async () => {
  if (sourceType.value === 'file') {
    return;
  }

  if (
    $leadminerStore.activeMiningTask ||
    $leadminerStore.isLoadingBoxes ||
    $leadminerStore.isLoadingStartMining ||
    $leadminerStore.isLoadingStopMining
  ) {
    return;
  }

  try {
    await $leadminerStore.fetchInbox();
  } catch (error: any) {
    if (error?.statusCode === 502 || error?.statusCode === 503) {
      $stepper.prev();
    } else {
      $consentSidebar.show(miningSource.type, miningSource.email);
    }
  }
});

async function reloadContacts() {
  /**
   * Disable realtime; protects table from rendering multiple times
   */
  await $contactsStore.unsubscribeFromRealtimeUpdates();
  await $contactsStore.reloadContacts();
  /**
   * Subscribe again after the table is rendered
   */
  $contactsStore.subscribeToRealtimeUpdates();
}

const totalExtractedNotificationMessage = computed(() =>
  sourceType.value === 'email'
    ? t('contacts_extracted', {
        extractedEmails: extractedEmails.value,
      })
    : t('notification_contacts_extracted', {
        extractedEmails: $leadminerStore.createdContacts,
      }),
);

const { isSupported, permissionGranted, show } = useWebNotification({
  title: `${t('mining_done')} 🎉`,
  icon: '/icons/pickaxe-192-192.png',
});

watch(extractionFinished, async (finished) => {
  if (canceled.value) {
    $toast.add({
      severity: 'info',
      summary: t('mining_stopped'),
      detail: t('mining_canceled'),
      life: 3000,
    });
    $stepper.next();
    await reloadContacts();
  } else if (finished) {
    $toast.add({
      severity: 'info',
      summary: t('mining_done'),
      detail: totalExtractedNotificationMessage,
      group: 'achievement',
      life: 8000,
    });
    $stepper.next();
    if (isSupported.value && permissionGranted.value) show();
    await reloadContacts();
  }
});

function openMiningSettings() {
  if (sourceType.value === 'email') {
    miningSettingsDialogRef.value!.open(); // skipcq: JS-0339 is component ref
  } else if (sourceType.value === 'file') {
    importFileDialogRef.value.openModal();
  }
}

async function startMiningBoxes() {
  if (
    Object.keys(selectedBoxes.value).filter(
      (key) => selectedBoxes.value[key].checked && key !== '',
    ).length === 0
  ) {
    openMiningSettings();
    $toast.add({
      severity: 'error',
      summary: t('select_folders'),
      detail: t('select_at_least_one_folder'),
      life: 3000,
    });
    return;
  }
  canceled.value = false;
  try {
    await $leadminerStore.startMining(sourceType.value);
  } catch (error) {
    if (
      error instanceof FetchError &&
      error.response?.status === 401 &&
      $leadminerStore.activeMiningSource
    ) {
      $consentSidebar.show(
        $leadminerStore.activeMiningSource.type,
        $leadminerStore.activeMiningSource.email,
      );
    } else {
      $toast.add({
        severity: 'error',
        summary: $t('common.start_mining'),
        detail: t('mining_issue'),
        life: 3000,
      });
    }
  }
}

async function startMiningFile() {
  try {
    await $leadminerStore.startMining(sourceType.value);
  } catch (error) {
    console.error(error);
  }
}

async function startMining() {
  if (sourceType.value === 'email') {
    await startMiningBoxes();
  } else if (sourceType.value === 'file') {
    await startMiningFile();
  }
}

async function haltMining() {
  canceled.value = true;
  try {
    const processes = [
      $leadminerStore.miningTask?.processes.fetch,
      $leadminerStore.miningTask?.processes.extract,
    ].filter(Boolean) as string[];

    const cancelEntireTask = processes.length === 0;

    await $leadminerStore.stopMining(
      cancelEntireTask,
      cancelEntireTask ? null : processes,
    );
  } catch (error) {
    if (error instanceof FetchError && error.response?.status === 404) {
      $toast.add({
        severity: 'warn',
        summary: t('mining_stopped'),
        detail: t('mining_already_canceled'),
        life: 5000,
      });
      $leadminerStore.miningTask = undefined;
      $leadminerStore.miningStartedAt = undefined;
    } else {
      throw error;
    }
  }
}
</script>

<i18n lang="json">
{
  "en": {
    "contacts_to_mine": "contact to mine. | contacts to mine.",
    "contacts_mined": "contact mined. | contacts mined.",
    "mined_total_contacts": "Mined / Total contact\n{extractedEmails} / {totalEmails}",
    "notification_contacts_extracted": "{extractedEmails} contacts extracted from your file",

    "retrieving_mailboxes": "Retrieving mailboxes...",
    "emails_to_mine": "email to mine. | emails to mine.",
    "emails_mined": "email mined. | emails mined.",
    "halt_mining": "Halt mining",
    "fine_tune_mining": "Fine tune mining",
    "back": "Back",
    "mined_total_emails": "Mined / Total emails\n{extractedEmails} / {totalEmails}",
    "mining_done": "Mining done",
    "contacts_extracted": "{extractedEmails} email messages extracted from your mailbox",
    "select_folders": "Select folders",
    "select_at_least_one_folder": "Please select at least one folder to start mining.",
    "mining_started": "Mining Started",
    "mining_success": "Your mining is successfully started.",
    "mining_issue": "Oops! We encountered an issue while trying to start your mining process.",
    "mining_stopped": "Mining Stopped",
    "mining_canceled": "Your mining is successfully canceled.",
    "mining_already_canceled": "It seems you are trying to cancel a mining operation that is already canceled.",
    "is_mining": "Contact extraction in progress...",
    "mining_interrupted": "Mining Interrupted"
  },
  "fr": {
    "contacts_to_mine": "contact à extraire. | contacts à extraire.",
    "contacts_mined": "contact extrait. | contacts extraits.",
    "mined_total_contacts": "Extraits / Total contacts\n{extractedEmails} / {totalEmails}",
    "notification_contacts_extracted": "{extractedEmails} contacts extraits de votre fichier",
    "retrieving_mailboxes": "Récupération des boîtes aux lettres...",
    "emails_to_mine": "email à extraire. | emails à extraire",
    "emails_mined": "email extrait. | emails extraits",
    "halt_mining": "Arrêter l'extraction",
    "fine_tune_mining": "Affiner l'extraction",
    "back": "Retour",
    "mined_total_emails": "Extrait / Total des e-mails\n{extractedEmails} / {totalEmails}",
    "mining_done": "Extraction terminée",
    "contacts_extracted": "{extractedEmails} messages e-mail extraits de votre boîte aux lettres",
    "select_folders": "Sélectionnez des dossiers",
    "select_at_least_one_folder": "Veuillez sélectionner au moins un dossier pour commencer l'extraction.",
    "mining_started": "Extraction commencée",
    "mining_success": "Votre extraction a été lancée avec succès.",
    "mining_issue": "Oups! Nous avons rencontré un problème lors du démarrage de votre processus d'extraction.",
    "mining_stopped": "Extraction arrêtée",
    "mining_canceled": "Votre extraction a été annulée avec succès.",
    "mining_already_canceled": "Il semble que vous essayez d'annuler une opération de minage qui est déjà annulée.",
    "is_mining": "Extraction des contacts en cours...",
    "mining_interrupted": "L'extraction a été interrompue"
  }
}
</i18n>
