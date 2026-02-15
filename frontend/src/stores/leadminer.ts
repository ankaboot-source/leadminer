import { defineStore } from 'pinia';
import type { TreeSelectionKeys } from 'primevue/tree';
import { ref } from 'vue';

import { updateMiningSourcesValidity } from '@/utils/sources';
import { startMiningNotification } from '~/utils/extras';
import {
  type MiningSource,
  type MiningTask,
  type MiningType,
  MiningTypes,
} from '../types/mining';
import type { BoxNode } from '../utils/boxes';
import { sse } from '../utils/sse';

export const useLeadminerStore = defineStore('leadminer', () => {
  const { $api } = useNuxtApp();
  const { t, getBrowserLocale } = useI18n();
  const language = getBrowserLocale() || 'en';
  const $toast = useToast();
  const $stepper = useMiningStepper();

  const activeEnrichment = ref(false);
  const activeMiningSource = ref<MiningSource | undefined>();

  const miningType = ref<MiningType>('email');

  const miningTask = ref<MiningTask | undefined>();

  const miningStartedAt = ref<number | undefined>(); // timestamp in performance.now() time (ms)
  const miningSources = ref<MiningSource[]>([]);
  const boxes = ref<BoxNode[]>([]);
  const extractSignatures = ref(true);
  const selectedBoxes = ref<TreeSelectionKeys>([]);
  const excludedBoxes = ref<Set<string>>(new Set());
  const selectedFile = ref<{
    name: string;
    contacts: Record<string, string>[];
  } | null>(null);

  const isLoadingStartMining = ref(false);
  const isLoadingStopMining = ref(false);
  const isLoadingBoxes = ref(false);

  const loadingStatus = ref(false);
  const loadingStatusDns = ref(false);

  const totalMessages = ref(0);
  const extractedEmails = ref(0);
  const scannedEmails = ref(0);
  const verifiedContacts = ref(0);
  const createdContacts = ref(0);

  const fetchingFinished = ref(true);
  const extractionFinished = ref(true);
  const cleaningFinished = ref(true);

  const miningCompleted = ref(false);

  const activeMiningTask = computed(() => miningTask.value !== undefined);

  const activeTask = computed(
    () =>
      activeMiningTask.value || isLoadingBoxes.value || activeEnrichment.value,
  );

  const passiveMiningDialog = ref(false);

  const miningStartedAndFinished = computed(() =>
    Boolean(miningStartedAt.value && miningCompleted.value),
  );

  const miningInterrupted = ref(false);
  const errors = ref({});

  function $resetMining() {
    miningTask.value = undefined;
    miningStartedAt.value = undefined;
    activeMiningSource.value = undefined;
    boxes.value = [];
    selectedBoxes.value = [];
    excludedBoxes.value = new Set();
    selectedFile.value = null;
    extractSignatures.value = true;
    isLoadingStartMining.value = false;
    isLoadingStopMining.value = false;
    isLoadingBoxes.value = false;
    loadingStatus.value = false;
    loadingStatusDns.value = false;

    totalMessages.value = 0;
    extractedEmails.value = 0;
    scannedEmails.value = 0;
    verifiedContacts.value = 0;
    createdContacts.value = 0;

    fetchingFinished.value = true;
    extractionFinished.value = true;
    cleaningFinished.value = true;

    miningCompleted.value = false;

    activeEnrichment.value = false;

    miningInterrupted.value = false;

    miningType.value = 'email';

    passiveMiningDialog.value = false;

    errors.value = {};
  }

  function $reset() {
    miningSources.value = [];
    $resetMining();
  }

  /**
   * Retrieves a mining source from the Pinia store by email.
   * @param email - The email address of the mining source to retrieve.
   */
  function getMiningSourceByEmail(email: string) {
    return miningSources.value.find((source) => source.email === email);
  }

  /**
   * Retrieves mining sources.
   * @throws {Error} Throws an error if there is an issue while retrieving mining sources.
   */
  async function fetchMiningSources() {
    const { sources } = await $api<{
      message: string;
      sources: MiningSource[];
    }>('/imap/mine/sources');

    miningSources.value = sources ?? [];
  }

  async function fetchInbox() {
    try {
      if (!activeMiningSource.value) {
        return;
      }

      isLoadingBoxes.value = true;
      boxes.value = [];
      selectedBoxes.value = [];
      extractSignatures.value = true;

      const { data } = await $api<{
        data: { message: string; folders: BoxNode[] };
      }>('/imap/boxes', {
        method: 'POST',
        body: {
          ...activeMiningSource.value,
        },
      });

      const { folders } = data || {};
      if (folders) {
        boxes.value = [...folders];

        const { defaultFolders, excludedKeys } =
          getDefaultAndExcludedFolders(folders);

        selectedBoxes.value = defaultFolders;
        excludedBoxes.value = excludedKeys;
      }

      miningSources.value = updateMiningSourcesValidity(
        miningSources.value,
        activeMiningSource.value,
        true,
      );
      isLoadingBoxes.value = false;
    } catch (error) {
      miningSources.value = updateMiningSourcesValidity(
        miningSources.value,
        activeMiningSource.value as MiningSource,
        false,
      );

      isLoadingBoxes.value = false;
      throw error;
    }
  }

  async function stopMiningApi(
    endEntireTask: boolean,
    processes: string[] | null,
  ) {
    const user = useSupabaseUser().value;
    const userId = user?.id || (user as { sub?: string } | null)?.sub;

    if (!userId || !miningTask.value) {
      return null;
    }

    const { miningId } = miningTask.value;

    const res = await $api(
      `/imap/mine/${miningType.value}/${userId}/${miningId}`,
      {
        method: 'POST',
        body: {
          endEntireTask,
          processes,
        },
      },
    );

    return res;
  }

  function startProgressListener(type: MiningType, miningId: string) {
    sse.initConnection(type, miningId, {
      onExtractedUpdate: (count) => {
        extractedEmails.value = count;
      },
      onFetchedUpdate: (count) => {
        scannedEmails.value = count;
      },
      onClose: () => {
        sse.closeConnection();
      },
      onError: () => {
        miningInterrupted.value = true;
        setTimeout(async () => {
          try {
            await stopMiningApi(true, []);
          } catch (err) {
            console.error('[SSE] error: ', (err as Error).message);
          }
          $resetMining();
          $toast.add({
            severity: 'warn',
            summary: t('mining.toast_canceled_title'),
            detail: t('mining.toast_canceled_by_connection_detail'),
            life: 5000,
          });
          $stepper.go(1);
        }, 0);
      },

      onFetchingDone: (totalFetched) => {
        scannedEmails.value = totalFetched;
        fetchingFinished.value = true;
      },
      onExtractionDone: (totalExtracted) => {
        extractedEmails.value = totalExtracted;
        extractionFinished.value = true;
      },
      onCleaningDone: (totalCleaned) => {
        verifiedContacts.value = totalCleaned;
        cleaningFinished.value = true;
      },
      onVerifiedContacts: (totalVerified) => {
        verifiedContacts.value = totalVerified;
      },
      onCreatedContacts: (totalCreated) => {
        createdContacts.value = totalCreated;
      },
      onMiningCompleted: () => {
        console.info('Mining marked as completed.');
        miningCompleted.value = true;
        setTimeout(() => {
          miningTask.value = undefined;
        }, 100);
      },
    });
  }

  async function startMiningEmail(
    userId: string,
    folders: string[],
    miningSource: MiningSource,
  ) {
    miningType.value = 'email';

    const { data: task } = await $api<{ data: MiningTask }>(
      `/imap/mine/${miningType.value}/${userId}`,
      {
        method: 'POST',
        body: {
          boxes: folders,
          miningSource,
          extractSignatures: extractSignatures.value,
        },
      },
    );

    return task;
  }

  async function startMiningFile(
    userId: string,
    fileName: string,
    importedContacts: Record<string, string>[],
  ) {
    miningType.value = 'file';
    fetchingFinished.value = true;
    scannedEmails.value = 1;

    const { data: task } = await $api<{ data: MiningTask }>(
      `/imap/mine/${miningType.value}/${userId}`,
      {
        method: 'POST',
        body: {
          name: fileName,
          contacts: importedContacts,
        },
      },
    );

    return task;
  }

  async function startMiningPST(userId: string, fileName: string) {
    miningType.value = 'pst';

    const { data: task } = await $api<{ data: MiningTask }>(
      `/imap/mine/pst/${userId}`,
      {
        method: 'POST',
        body: {
          name: fileName,
          extractSignatures: extractSignatures.value,
        },
      },
    );

    return task;
  }

  const pstFilePath = ref('');

  /**
   * Starts the mining process.
   * @throws {Error} Throws an error if there is an issue while starting the mining process.
   */
  async function startMining(source: MiningType, storagePath?: string) {
    await useSupabaseClient().auth.refreshSession(); // Refresh session on mining start

    const user = useSupabaseUser().value;
    const token = useSupabaseSession().value?.access_token;
    const userId = user?.id || (user as { sub?: string } | null)?.sub;

    if (!userId || !token) return;
    if (source === 'file' && !selectedBoxes.value) return;
    if (source === 'email' && !activeMiningSource.value) return;

    // reset, prepare states
    loadingStatus.value = true;
    loadingStatusDns.value = true;

    totalMessages.value = 0;
    scannedEmails.value = 0;
    extractedEmails.value = 0;
    createdContacts.value = 0;
    verifiedContacts.value = 0;

    fetchingFinished.value = false;
    extractionFinished.value = false;
    cleaningFinished.value = false;

    try {
      isLoadingStartMining.value = true;
      const task =
        source === 'email'
          ? await startMiningEmail(
              userId,
              Object.keys(selectedBoxes.value).filter(
                (key) =>
                  selectedBoxes.value[key].checked &&
                  !excludedBoxes.value.has(key) &&
                  key !== '',
              ),
              activeMiningSource.value!,
            )
          : source === 'file'
            ? await startMiningFile(
                userId,
                selectedFile.value!.name,
                selectedFile.value!.contacts,
              )
            : await startMiningPST(userId, storagePath!);

      totalMessages.value = task.progress.totalMessages;
      sse.closeConnection();
      startProgressListener(miningType.value, task.miningId);

      miningTask.value = task;
      miningStartedAt.value = performance.now();
      startMiningNotification();
    } catch (err) {
      sse.closeConnection();
      throw err;
    } finally {
      loadingStatus.value = false;
      loadingStatusDns.value = false;
      isLoadingStartMining.value = false;
    }
  }

  /**
   * Stops the mining process.
   * @throws {Error} Throws an error if there is an issue while stopping the mining process.
   */
  async function stopMining(
    endEntireTask: boolean,
    processes: string[] | null,
  ) {
    try {
      isLoadingStopMining.value = true;

      await stopMiningApi(endEntireTask, processes);

      if (endEntireTask) {
        miningTask.value = undefined;
        fetchingFinished.value = true;
        cleaningFinished.value = true;
      }
      fetchingFinished.value = true;
      extractionFinished.value = true;
      isLoadingStopMining.value = false;
    } catch (err) {
      fetchingFinished.value = true;
      extractionFinished.value = true;
      cleaningFinished.value = true;
      isLoadingStopMining.value = false;
      throw err;
    }
  }

  async function getCurrentRunningMining() {
    // 1) GET running tasks for the current user
    try {
      const user = useSupabaseUser().value;
      const userId = user?.id || (user as { sub?: string } | null)?.sub;

      if (!userId) return 1;

      const response = await $api<{
        task: MiningTask;
        fetch: MiningTask;
        extract: MiningTask;
        clean: MiningTask;
      }>(`/imap/mine/${userId}/`);

      if (!response) return 1;

      const { task: redactedTask, fetch, clean, extract } = response;

      if (!redactedTask || !redactedTask.miningSource.type) return 1;

      const {
        miningSource: { type: mType },
      } = redactedTask;

      if ((mType === MiningTypes.FILE && !extract) || !clean) return 1;
      if ((mType === MiningTypes.EMAIL && !fetch) || !extract || !clean) {
        return 1;
      }

      miningTask.value = redactedTask;
      miningType.value = mType;
      activeMiningSource.value = miningSources.value.find(
        ({ email }) => email === redactedTask.miningSource.source,
      );

      miningStartedAt.value =
        miningType.value === MiningTypes.EMAIL
          ? performance.now() -
            (Date.now() - new Date(fetch.started_at).getTime())
          : performance.now() -
            (Date.now() - new Date(extract.started_at).getTime());

      const { progress } = redactedTask;
      totalMessages.value = progress.totalMessages;
      scannedEmails.value = progress.fetched ?? 0;
      extractedEmails.value = progress.extracted ?? 0;
      createdContacts.value = progress.createdContacts ?? 0;
      verifiedContacts.value = progress.verifiedContacts ?? 0;

      fetchingFinished.value =
        miningType.value === MiningTypes.EMAIL
          ? fetch && ['done', 'canceled'].includes(fetch.status)
          : true;

      extractionFinished.value =
        extract && ['done', 'canceled'].includes(extract.status);

      cleaningFinished.value =
        clean && ['done', 'canceled'].includes(clean.status);

      startProgressListener(miningType.value, miningTask.value.miningId);

      return extractionFinished.value ? 3 : 2;
    } catch (err) {
      console.error(err);
      return 1;
    }
  }

  return {
    fetchInbox,
    fetchMiningSources,
    getMiningSourceByEmail,
    getCurrentRunningMining,
    startMining,
    stopMining,

    $reset,
    $resetMining,

    activeEnrichment,
    miningTask,
    miningType,
    miningStartedAt,
    miningSources,
    activeMiningSource,
    boxes,
    selectedBoxes,
    excludedBoxes,
    extractSignatures,
    selectedFile,
    isLoadingStartMining,
    isLoadingStopMining,
    isLoadingBoxes,
    loadingStatus,
    loadingStatusDns,
    totalMessages,
    extractedEmails,
    scannedEmails,
    createdContacts,
    verifiedContacts,
    fetchingFinished,
    extractionFinished,
    cleaningFinished,
    miningCompleted,
    activeMiningTask,
    activeTask,
    passiveMiningDialog,
    miningStartedAndFinished,
    miningInterrupted,
    errors,
    language,
    pstFilePath,
  };
});
