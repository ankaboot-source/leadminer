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
      <div v-if="sourceType === 'pst'">
        {{ $leadminerStore.pstFilePath.split('/')[1] }}
      </div>
      <div v-else-if="$leadminerStore.isLoadingBoxes">
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
      :disabled="!canStartMining"
      :loading="$leadminerStore.isLoadingStartMining"
      :label="$t('common.start_mining_now')"
      @click="startMining"
    />
    <Button
      v-else
      id="mine-stepper-stop-button"
      :loading="$leadminerStore?.isLoadingStopMining"
      icon="pi pi-stop"
      icon-pos="right"
      severity="danger"
      outlined
      :label="t('halt_mining')"
      @click="haltMining"
    />
  </div>

  <MiningSettingsDialog
    ref="miningSettingsDialogRef"
    :total-emails="totalEmails"
    :is-loading-boxes="$leadminerStore.isLoadingBoxes"
  />

  <ResumeMiningDialog
    v-model:visible="resumeDialogVisible"
    @continue="resumeSelectedNewFolders"
    @rescan="runEmailMining(MiningRunMode.Full)"
  />

  <AlreadyMinedDialog
    v-model:visible="alreadyMinedDialogVisible"
    :mode="alreadyMinedDialogMode"
    :folders="alreadyMinedDialogFolders"
    @remine="runEmailMining(MiningRunMode.Full)"
    @skip="alreadyMinedDialogVisible = false"
    @mine-new-only="mineNewFoldersOnly"
  />
</template>
<script setup lang="ts">
// @ts-expect-error "No type definitions"
import objectScan from 'object-scan';
import { FetchError } from 'ofetch';
import type { TreeSelectionKeys } from 'primevue/tree';

import ProgressCard from '@/components/mining/ProgressCard.vue';
import { requiresActiveMiningSource } from '@/utils/mining-source-guards';
import { computeExtractionProgress } from '@/utils/mining-progress';
import { flattenBoxNodes } from '~/utils/box-tree';
import { resolveMiningIntent, resolveRunMode } from '@/utils/mining-intent';
import {
  getSelectedFolderKeys,
  hasSelectedFolders,
  uncheckUpToDateFolders,
} from '~/utils/selected-folders';
import { useWebNotification } from '@vueuse/core';
import type { MiningSource, AlreadyMinedFolder } from '~/types/mining';
import { MiningRunMode } from '~/types/enums';
import MiningSettingsDialog from './MiningSettingsDialog.vue';
import ResumeMiningDialog from './ResumeMiningDialog.vue';
// skipcq: JS-W1028 - Nuxt SFCs are default imports; DeepSource cannot detect script-setup default exports
import AlreadyMinedDialog from './AlreadyMinedDialog.vue';

const { t } = useI18n({
  useScope: 'local',
});

const { t: $t } = useI18n({
  useScope: 'global',
});

const { miningSource } = defineProps<{
  miningSource: MiningSource | undefined;
}>();

const $toast = useToast();
const $stepper = useMiningStepper();
const $leadminerStore = useLeadminerStore();
const $contactsStore = useContactsStore();
const $consentSidebar = useMiningConsentSidebar();
const $supabase = useSupabaseClient();

const sourceType = computed(() => $leadminerStore.miningType);

async function handleAuthErrorAndRetry(
  retryFn: () => Promise<void>,
  sourceEmail?: string,
  sourceTypeVal?: string,
) {
  try {
    const { error: refreshError } = await $supabase.auth.refreshSession();
    if (refreshError) {
      // eslint-disable-next-line no-console
      console.error('Token refresh failed:', refreshError);
    }
    await retryFn();
  } catch (error) {
    if (
      error instanceof FetchError &&
      error.response?.status === 401 &&
      sourceEmail &&
      sourceTypeVal
    ) {
      $consentSidebar.show(
        sourceTypeVal as 'google' | 'microsoft' | 'imap',
        sourceEmail,
        '/mine',
      );
    } else if (
      error instanceof FetchError &&
      error.response?.status === 403 &&
      error.response?._data?.type === 'google'
    ) {
      // eslint-disable-next-line no-console
      console.error('Google Contacts 403:', error.response?._data);
      $toast.add({
        severity: 'warn',
        summary: $t('common.start_mining'),
        detail: {
          message: t('google_contacts_permission_needed'),
          button: {
            text: t('authorize_google_contacts'),
            action: () => {
              $consentSidebar.show('google', sourceEmail ?? '', '/mine');
            },
          },
        },
        group: 'has-links',
        life: 8000,
      });
    } else {
      const detail = getMiningErrorDetail(error, sourceTypeVal);
      // eslint-disable-next-line no-console
      console.error('Mining error:', error);
      $toast.add({
        severity: 'error',
        summary: $t('common.start_mining'),
        detail,
        life: 3000,
      });
    }
  }
}

function getMiningErrorDetail(error: unknown, sourceTypeVal?: string) {
  if (!error || typeof error !== 'object') {
    return t('mining_issue');
  }

  const fetchError = error as FetchError<{
    message?: string;
    error?: string;
  }>;

  const backendMessage =
    fetchError.data?.message ||
    fetchError.data?.error ||
    fetchError.statusMessage ||
    fetchError.message;

  if (
    sourceTypeVal === 'pst' &&
    fetchError.response?.status === 422 &&
    (backendMessage || '').toLowerCase().includes('failed to parse pst file')
  ) {
    return t('pst_file_corrupted');
  }

  return backendMessage || t('mining_issue');
}

const AVERAGE_EXTRACTION_RATE =
  parseInt(useRuntimeConfig().public.AVERAGE_EXTRACTION_RATE) || 130;
const canceled = ref<boolean>(false);
const resumeDialogVisible = ref(false);
const alreadyMinedDialogVisible = ref(false);
const alreadyMinedDialogMode = ref<'all-mined' | 'mixed'>('all-mined');
const alreadyMinedDialogFolders = ref<AlreadyMinedFolder[]>([]);
const miningSettingsDialogRef =
  ref<InstanceType<typeof MiningSettingsDialog>>();

const boxes = computed(() => $leadminerStore.boxes);
const selectedBoxes = computed<TreeSelectionKeys>(
  () => $leadminerStore.selectedBoxes,
);

const taskStartedAt = computed(() => $leadminerStore.miningStartedAt);

const hasSelectedBoxes = computed(() =>
  hasSelectedFolders(selectedBoxes.value, $leadminerStore.excludedBoxes),
);

const sourceTypeIsEmail = computed(
  () => sourceType.value === 'email' || sourceType.value === 'pst',
);

// Folders actually sent for the current/last run. Set when a run narrows the
// selection (e.g. "Mine new folders only"); null means "use the selection".
// Keeps the displayed email count in sync with what is really mined.
const runFolders = ref<string[] | null>(null);

// Any change to the folder selection invalidates a previously narrowed scope.
watch(
  selectedBoxes,
  () => {
    runFolders.value = null;
  },
  { deep: true },
);

const totalEmails = computed<number>(() => {
  if (sourceType.value === 'file') {
    return $leadminerStore.selectedFile?.contacts.length || 0;
  }

  if (sourceTypeIsEmail.value) {
    return $leadminerStore.totalMessages > 0
      ? $leadminerStore.totalMessages
      : objectScan(['**.{total}'], {
          joined: true,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          filterFn: ({ parent, property, value, context }: any) => {
            if (property !== 'total' || !parent.key) return;
            const inScope = runFolders.value?.length
              ? runFolders.value.includes(parent.key)
              : parent.key in selectedBoxes.value &&
                selectedBoxes.value[parent.key].checked;
            if (inScope) {
              context.sum += value;
            }
          },
        })(boxes.value, { sum: 0 }).sum;
  }

  return 0;
});

const totalMined = computed(() =>
  sourceTypeIsEmail.value ? totalEmails.value : $leadminerStore.createdContacts,
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

const canStartMining = computed(() => {
  if (sourceType.value !== 'email') return true;
  if ($leadminerStore.isLoadingBoxes || $leadminerStore.isLoadingStartMining)
    return false;
  return (
    totalEmails.value > 0 || $leadminerStore.sourceConfig.google_contacts_sync
  );
});

const extractionProgress = computed(() =>
  computeExtractionProgress({
    extractedEmails: extractedEmails.value,
    scannedEmails: $leadminerStore.scannedEmails,
    totalEmails: totalEmails.value,
    fetchingFinished: $leadminerStore.fetchingFinished,
    canceled: canceled.value,
    googleContactsSync: $leadminerStore.sourceConfig.google_contacts_sync,
    googleContactsFetchedCount: $leadminerStore.googleContactsFetchedCount,
    googleContactsTotal: $leadminerStore.googleContactsTotal,
  }),
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
  if (sourceType.value === 'file' || sourceType.value === 'pst') {
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
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const err = error as { statusCode?: number };
      if (err.statusCode === 502 || err.statusCode === 503) {
        $stepper.prev();
      } else if (miningSource) {
        $consentSidebar.show(miningSource.type, miningSource.email, '/mine');
      }
    } else if (miningSource) {
      $consentSidebar.show(miningSource.type, miningSource.email, '/mine');
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
  sourceTypeIsEmail.value
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

const completedTransitionDone = ref(false);

async function finishMiningFlow() {
  if (completedTransitionDone.value) return;
  completedTransitionDone.value = true;
  $leadminerStore.maybeOpenPassiveMiningDialog();
  $toast.add({
    severity: 'info',
    summary: t('mining_done'),
    detail: totalExtractedNotificationMessage.value,
    group: 'achievement',
    life: 8000,
  });
  $stepper.next();
  if (isSupported.value && permissionGranted.value) show();
  await reloadContacts();
}

watch(extractionFinished, async (finished) => {
  if (canceled.value) {
    if (completedTransitionDone.value) return;
    completedTransitionDone.value = true;
    $toast.add({
      severity: 'info',
      summary: t('mining_stopped'),
      detail: t('mining_canceled'),
      life: 3000,
    });
    $stepper.next();
    return;
  }
  if (finished) await finishMiningFlow();
});

watch(
  () => $leadminerStore.googleContactsFetched,
  async (fetched) => {
    if (fetched && !canceled.value && !hasSelectedBoxes.value) {
      await finishMiningFlow();
    }
  },
);

// Fallback for fast runs: if 'mining-completed' arrives after the earlier
// finish events were missed (SSE attach race), leave step 2 instead of
// showing a stale "start a new mining" state with no table.
watch(
  () => $leadminerStore.miningCompleted,
  async (completed) => {
    if (completed && !canceled.value) await finishMiningFlow();
  },
);

function openMiningSettings() {
  if (sourceType.value === 'email' || sourceType.value === 'pst') {
    miningSettingsDialogRef.value!.open(); // skipcq: JS-0339 is component ref
  }
}

async function startMiningBoxes() {
  if (
    !$leadminerStore.sourceConfig.google_contacts_sync &&
    !hasSelectedFolders(selectedBoxes.value, $leadminerStore.excludedBoxes)
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

  if (
    requiresActiveMiningSource(sourceType.value) &&
    !$leadminerStore.activeMiningSource
  ) {
    return;
  }

  const activeSource = $leadminerStore.activeMiningSource;
  if (!activeSource) return;

  // The choice is per-run and transient: if a selected folder was already
  // mined and has new messages, ask; otherwise resume when a watermark exists
  // and full-scan when it doesn't.
  const selectedKeys = new Set(
    getSelectedFolderKeys(selectedBoxes.value, $leadminerStore.excludedBoxes),
  );
  const selectedNodes = flattenBoxNodes(boxes.value).filter((node) =>
    selectedKeys.has(node.key),
  );

  const intent = resolveMiningIntent(selectedNodes);
  switch (intent.kind) {
    case 'resume':
      resumeDialogVisible.value = true;
      return;
    case 'mixed':
      alreadyMinedDialogMode.value = 'mixed';
      alreadyMinedDialogFolders.value = intent.folders;
      alreadyMinedDialogVisible.value = true;
      return;
    case 'all-mined':
      alreadyMinedDialogMode.value = 'all-mined';
      alreadyMinedDialogFolders.value = [];
      alreadyMinedDialogVisible.value = true;
      return;
    default:
      await runEmailMining(intent.mode);
  }
}

async function resumeSelectedNewFolders() {
  resumeDialogVisible.value = false;
  // “Mine new messages only” simply unchecks already-mined folders. The
  // remaining selection is then mined through the normal selection path.
  $leadminerStore.selectedBoxes = uncheckUpToDateFolders(
    $leadminerStore.selectedBoxes,
    boxes.value,
  );
  await runEmailMining(MiningRunMode.Incremental);
}

async function mineNewFoldersOnly() {
  alreadyMinedDialogVisible.value = false;
  // "New" = selected folders that are not UpToDate. Pass them explicitly so
  // the run never depends on mutating the shared selection state.
  const newKeys = alreadyMinedDialogFolders.value
    .filter((folder) => folder.status === 'new')
    .map((folder) => folder.key);
  const newKeySet = new Set(newKeys);
  const newNodes = flattenBoxNodes(boxes.value).filter((node) =>
    newKeySet.has(node.key),
  );
  await runEmailMining(resolveRunMode(newNodes), newKeys);
}

async function runEmailMining(runMode: MiningRunMode, folders?: string[]) {
  // Narrow the displayed scope to the folders actually mined (if any).
  runFolders.value = folders ?? null;
  resumeDialogVisible.value = false;
  alreadyMinedDialogVisible.value = false;
  completedTransitionDone.value = false;
  const activeSource = $leadminerStore.activeMiningSource;
  if (!activeSource) return;

  await handleAuthErrorAndRetry(
    () =>
      $leadminerStore.startMining(
        sourceType.value,
        undefined,
        runMode,
        folders,
      ),
    activeSource.email,
    activeSource.type,
  );
}

async function startMiningFile() {
  await handleAuthErrorAndRetry(() =>
    $leadminerStore.startMining(sourceType.value),
  );
}

async function startMiningPst() {
  await handleAuthErrorAndRetry(() =>
    $leadminerStore.startMining(sourceType.value, $leadminerStore.pstFilePath),
  );
}

async function startMining() {
  if (sourceType.value === 'email') {
    await startMiningBoxes();
  } else if (sourceType.value === 'file') {
    await startMiningFile();
  } else if (sourceType.value === 'pst') {
    await startMiningPst();
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
    "mining_done": "Extraction completed",
    "contacts_extracted": "{extractedEmails} email messages extracted from your mailbox",
    "select_folders": "Select folders",
    "select_at_least_one_folder": "Please select at least one folder to start mining.",
    "mining_started": "Mining Started",
    "mining_success": "Your mining is successfully started.",
    "mining_issue": "Oops! We encountered an issue while trying to start your mining process.",
    "pst_file_corrupted": "The PST/OST file seems corrupted or unreadable.",
    "mining_stopped": "Mining Stopped",
    "mining_canceled": "Your mining is successfully canceled.",
    "mining_already_canceled": "It seems you are trying to cancel a mining operation that is already canceled.",
    "is_mining": "Contact extraction in progress...",
    "mining_interrupted": "Mining Interrupted",
    "google_contacts_permission_needed": "Google Contacts requires your authorization.",
    "authorize_google_contacts": "Authorize Google Contacts"
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
    "pst_file_corrupted": "Le fichier PST/OST semble corrompu ou illisible.",
    "mining_stopped": "Extraction arrêtée",
    "mining_canceled": "Votre extraction a été annulée avec succès.",
    "mining_already_canceled": "Il semble que vous essayez d'annuler une opération de minage qui est déjà annulée.",
    "is_mining": "Extraction des contacts en cours...",
    "mining_interrupted": "L'extraction a été interrompue",
    "google_contacts_permission_needed": "Google Contacts nécessite votre autorisation.",
    "authorize_google_contacts": "Autoriser Google Contacts"
  }
}
</i18n>
