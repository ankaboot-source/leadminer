<template>
  <ProgressCard
    v-if="boxes"
    :status="activeMiningTask"
    :total="totalEmails"
    :rate="parseInt(useRuntimeConfig().public.AVERAGE_EXTRACTION_RATE) || 130"
    :started="taskStartedAt"
    :progress="extractionProgress"
    :progress-tooltip="progressTooltip"
  >
    <template #progress-title>
      <div v-if="$leadminerStore.isLoadingBoxes" class="flex items-center">
        <i class="pi pi-spin pi-spinner mr-1.5" />
        {{ t('retrieving_mailboxes') }}
      </div>
      <div v-else-if="!$leadminerStore.miningTask">
        {{ totalEmails.toLocaleString() }}
        {{ t('email_messages_to_mine', totalEmails) }}
      </div>
    </template>
  </ProgressCard>

  <mining-settings
    ref="miningSettingsRef"
    :total-emails="totalEmails"
    :is-loading-boxes="$leadminerStore.isLoadingBoxes"
  />
  <div id="mobile-buttons" class="flex flex-col gap-2 pt-6 md:hidden">
    <Button
      v-if="!activeMiningTask"
      :disabled="
        $leadminerStore.isLoadingBoxes || $leadminerStore.isLoadingStartMining
      "
      :loading="$leadminerStore.isLoadingStartMining"
      severity="contrast"
      class="border-solid border-2 border-black"
      :label="t('start_mining_now')"
      @click="startMining"
    />
    <Button
      v-else
      :loading="$leadminerStore?.isLoadingStartMining"
      class="border-solid border-2 border-black"
      severity="contrast"
      icon="pi pi-stop"
      icon-pos="right"
      :label="t('halt_mining')"
      @click="haltMining"
    />
    <Button
      :disabled="
        activeMiningTask ||
        $leadminerStore.isLoadingStartMining ||
        $leadminerStore.isLoadingBoxes
      "
      class="text-black"
      severity="secondary"
      :label="t('fine_tune_mining')"
      outlined
      @click="openMiningSettings"
    >
    </Button>
    <Button
      :disabled="activeMiningTask || $leadminerStore.isLoadingStartMining"
      severity="secondary"
      :label="t('back')"
      @click="$stepper.prev()"
    />
  </div>
  <div class="hidden md:flex pt-6 justify-between">
    <Button
      :disabled="activeMiningTask || $leadminerStore.isLoadingStartMining"
      severity="secondary"
      :label="t('back')"
      @click="$stepper.prev()"
    />
    <div class="flex gap-2">
      <Button
        :disabled="
          activeMiningTask ||
          $leadminerStore.isLoadingStartMining ||
          $leadminerStore.isLoadingBoxes
        "
        class="text-black"
        severity="secondary"
        :label="t('fine_tune_mining')"
        outlined
        @click="openMiningSettings"
      >
      </Button>
      <Button
        v-if="!activeMiningTask"
        :disabled="
          $leadminerStore.isLoadingBoxes || $leadminerStore.isLoadingStartMining
        "
        :loading="$leadminerStore.isLoadingStartMining"
        severity="contrast"
        class="border-solid border-2 border-black"
        :label="t('start_mining_now')"
        @click="startMining"
      />
      <Button
        v-else
        :loading="$leadminerStore?.isLoadingStartMining"
        class="border-solid border-2 border-black"
        severity="contrast"
        icon="pi pi-stop"
        icon-pos="right"
        :label="t('halt_mining')"
        @click="haltMining"
      />
    </div>
  </div>
</template>
<script setup lang="ts">
// @ts-expect-error "No type definitions"
import objectScan from 'object-scan';
import { FetchError } from 'ofetch';
import type { TreeSelectionKeys } from 'primevue/tree';

import MiningSettings from '@/components/Mining/MiningSettings.vue';
import ProgressCard from '@/components/ProgressCard.vue';
import type { MiningSource } from '~/types/mining';

const { t } = useI18n({
  useScope: 'local',
});

const { miningSource } = defineProps<{
  miningSource: MiningSource;
}>();

const $toast = useToast();
const $stepper = useMiningStepper();
const $leadminerStore = useLeadminerStore();

const canceled = ref<boolean>(false);
const miningSettingsRef = ref<InstanceType<typeof MiningSettings>>();

const boxes = computed(() => $leadminerStore.boxes);
const selectedBoxes = computed<TreeSelectionKeys>(
  () => $leadminerStore.selectedBoxes,
);
const activeMiningTask = computed(
  () => $leadminerStore.miningTask !== undefined,
);
const taskStartedAt = computed(() => $leadminerStore.miningStartedAt);

const totalEmails = computed<number>(() => {
  if (boxes.value[0]) {
    return objectScan(['**.{total}'], {
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

const extractionFinished = computed(() => $leadminerStore.extractionFinished);
const extractedEmails = computed(() => $leadminerStore.extractedEmails);

const extractionProgress = computed(() =>
  $leadminerStore.fetchingFinished && !canceled
    ? extractedEmails.value / $leadminerStore.scannedEmails || 0
    : extractedEmails.value / totalEmails.value || 0,
);

const progressTooltip = computed(() =>
  t('mined_total_emails', {
    extractedEmails: extractedEmails.value.toLocaleString(),
    totalEmails: totalEmails.value.toLocaleString(),
  }),
);

onMounted(async () => {
  if (
    activeMiningTask.value ||
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
      throw error;
    } else {
      useMiningConsentSidebar().show(miningSource.type);
    }
  }
});

watch(extractionFinished, (finished) => {
  if (!canceled.value && finished) {
    $toast.add({
      severity: 'success',
      summary: t('mining_done'),
      detail: t('contacts_extracted', {
        extractedEmails: extractedEmails.value,
      }),
      group: 'achievement',
      life: 5000,
    });
    $stepper.next();
  }
});

function openMiningSettings() {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  miningSettingsRef.value!.open();
}

// eslint-disable-next-line consistent-return
async function startMining() {
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
    await $leadminerStore.startMining();
  } catch (error) {
    if (
      error instanceof FetchError &&
      error.response?.status === 401 &&
      $leadminerStore.activeMiningSource
    ) {
      useMiningConsentSidebar().show($leadminerStore.activeMiningSource.type);
    } else {
      $toast.add({
        severity: 'error',
        summary: t('start_mining'),
        detail: t('mining_issue'),
        life: 3000,
      });
    }
  }
}

async function haltMining() {
  canceled.value = true;
  try {
    await $leadminerStore.stopMining();
    $toast.add({
      severity: 'success',
      summary: t('mining_stopped'),
      detail: t('mining_canceled'),
      life: 3000,
    });
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
    "retrieving_mailboxes": "Retrieving mailboxes...",
    "email_messages_to_mine": "email message to mine. | email messages to mine.",
    "start_mining_now": "Start mining now!",
    "halt_mining": "Halt mining",
    "fine_tune_mining": "Fine tune mining",
    "back": "Back",
    "mined_total_emails": "Mined / Total emails\n{extractedEmails} / {totalEmails}",
    "mining_done": "Mining done",
    "contacts_extracted": "{extractedEmails} contacts extracted from your mailbox",
    "select_folders": "Select folders",
    "select_at_least_one_folder": "Please select at least one folder to start mining.",
    "mining_started": "Mining Started",
    "mining_success": "Your mining is successfully started.",
    "start_mining": "Start Mining",
    "mining_issue": "Oops! We encountered an issue while trying to start your mining process.",
    "mining_stopped": "Mining Stopped",
    "mining_canceled": "Your mining is successfully canceled.",
    "mining_already_canceled": "It seems you are trying to cancel a mining operation that is already canceled."
  },
  "fr": {
    "retrieving_mailboxes": "Récupération des boîtes aux lettres...",
    "email_messages_to_mine": "email à extraire. | emails à extraire",
    "start_mining_now": "Lancer maintenant l'extraction !",
    "halt_mining": "Arrêter l'extraction",
    "fine_tune_mining": "Affiner l'extraction",
    "back": "Retour",
    "mined_total_emails": "Extrait / Total des e-mails\n{extractedEmails} / {totalEmails}",
    "mining_done": "Extraction terminée",
    "contacts_extracted": "{extractedEmails} contacts extraits de votre boîte aux lettres",
    "select_folders": "Sélectionnez des dossiers",
    "select_at_least_one_folder": "Veuillez sélectionner au moins un dossier pour commencer l'extraction.",
    "mining_started": "Extraction commencée",
    "mining_success": "Votre extraction a été lancée avec succès.",
    "start_mining": "Lancer l'extraction",
    "mining_issue": "Oups! Nous avons rencontré un problème lors du démarrage de votre processus d'extraction.",
    "mining_stopped": "Extraction arrêtée",
    "mining_canceled": "Votre extraction a été annulée avec succès.",
    "mining_already_canceled": "Il semble que vous essayez d'annuler une opération de minage qui est déjà annulée."
  }
}
</i18n>
