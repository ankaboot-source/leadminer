import { defineStore } from 'pinia';
import type { TreeSelectionKeys } from 'primevue/tree';
import { ref } from 'vue';

import { updateMiningSourcesValidity } from '@/utils/sources';
import { startMiningNotification } from '~/utils/extras';
import type { MiningSource, MiningTask, MiningType } from '../types/mining';
import { type BoxNode, getDefaultSelectedFolders } from '../utils/boxes';
import { sse } from '../utils/sse';

export const useLeadminerStore = defineStore('leadminer', () => {
  const { $api } = useNuxtApp();
  const { t } = useI18n();
  const $toast = useToast();
  const $stepper = useMiningStepper();

  const activeEnrichment = ref(false);
  const activeMiningSource = ref<MiningSource | undefined>();

  const miningType = ref<MiningType>('email');

  const miningTask = ref<MiningTask | undefined>();
  const miningStartedAt = ref<number | undefined>();
  const miningSources = ref<MiningSource[]>([]);
  const boxes = ref<BoxNode[]>([]);
  const selectedBoxes = ref<TreeSelectionKeys>([]);
  const selectedFile = ref<{
    name: string;
    contacts: Record<string, string>[];
  } | null>(null);

  const isLoadingStartMining = ref(false);
  const isLoadingStopMining = ref(false);
  const isLoadingBoxes = ref(false);

  const loadingStatus = ref(false);
  const loadingStatusDns = ref(false);

  const extractedEmails = ref(0);
  const scannedEmails = ref(0);
  const verifiedContacts = ref(0);
  const createdContacts = ref(0);

  const fetchingFinished = ref(true);
  const extractionFinished = ref(true);
  const cleaningFinished = ref(true);

  const activeMiningTask = computed(() => miningTask.value !== undefined);

  const activeTask = computed(
    () =>
      activeMiningTask.value ||
      isLoadingBoxes.value ||
      !cleaningFinished.value ||
      activeEnrichment.value,
  );

  const miningStartedAndFinished = computed(() =>
    Boolean(miningStartedAt.value && cleaningFinished.value),
  );

  const miningInterrupted = ref(false);
  const errors = ref({});

  function $resetMining() {
    miningTask.value = undefined;
    miningStartedAt.value = undefined;
    activeMiningSource.value = undefined;
    boxes.value = [];
    selectedBoxes.value = [];
    selectedFile.value = null;

    isLoadingStartMining.value = false;
    isLoadingStopMining.value = false;
    isLoadingBoxes.value = false;
    loadingStatus.value = false;
    loadingStatusDns.value = false;

    extractedEmails.value = 0;
    scannedEmails.value = 0;
    verifiedContacts.value = 0;
    createdContacts.value = 0;

    fetchingFinished.value = true;
    extractionFinished.value = true;
    cleaningFinished.value = true;

    activeEnrichment.value = false;

    miningInterrupted.value = false;

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
        selectedBoxes.value = getDefaultSelectedFolders(folders);
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

  function startProgressListener(
    type: MiningType,
    miningId: string,
    token: string,
  ) {
    sse.initConnection(type, miningId, token, {
      onExtractedUpdate: (count) => {
        extractedEmails.value = count;
      },
      onFetchedUpdate: (count) => {
        scannedEmails.value = count;
      },
      onClose: () => {
        miningTask.value = undefined;
        sse.closeConnection();
      },
      onError: () => {
        miningInterrupted.value = true;
        setTimeout(() => {
          $resetMining();
          $toast.add({
            severity: 'warn',
            summary: t('mining.mining_interrupted'),
            detail: t('mining.mining_interrupted_detail'),
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
    });
  }

  async function startMiningEmail(
    userId: string,
    folders: string[],
    miningSource: MiningSource,
  ) {
    // Set current miningType: file or email
    miningType.value = 'email';

    const { data: task } = await $api<{ data: MiningTask }>(
      `/imap/mine/${miningType.value}/${userId}`,
      {
        method: 'POST',
        body: {
          boxes: folders,
          miningSource,
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
    // Set current miningType: file or email
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

  /**
   * Starts the mining process.
   * @throws {Error} Throws an error if there is an issue while starting the mining process.
   */
  async function startMining(source: 'boxes' | 'file') {
    const user = useSupabaseUser().value;
    const token = useSupabaseSession().value?.access_token;

    if (!user || !token) return;
    if (source === 'file' && !selectedBoxes.value) return;
    if (source === 'boxes' && !activeMiningSource.value) return;

    // reset, prepare states
    loadingStatus.value = true;
    loadingStatusDns.value = true;

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
        source === 'boxes'
          ? await startMiningEmail(
              user?.id,
              Object.keys(selectedBoxes.value).filter(
                (key) => selectedBoxes.value[key].checked && key !== '',
              ),
              activeMiningSource.value!,
            )
          : await startMiningFile(
              user.id,
              selectedFile.value!.name,
              selectedFile.value!.contacts,
            );

      startProgressListener(miningType.value, task.miningId, token);

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
      const user = useSupabaseUser().value;

      if (!user || !miningTask.value) {
        return;
      }

      isLoadingStopMining.value = true;

      const { miningId } = miningTask.value;

      await $api(`/imap/mine/${miningType.value}/${user.id}/${miningId}`, {
        method: 'POST',
        body: {
          endEntireTask,
          processes,
        },
      });

      if (endEntireTask) {
        miningTask.value = undefined;
        fetchingFinished.value = true;
        cleaningFinished.value = true;
        isLoadingStopMining.value = false;
      }
      extractionFinished.value = true;
    } catch (err) {
      fetchingFinished.value = true;
      extractionFinished.value = true;
      cleaningFinished.value = true;
      isLoadingStopMining.value = false;
      throw err;
    }
  }

  return {
    fetchInbox,
    fetchMiningSources,
    getMiningSourceByEmail,

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
    selectedFile,
    isLoadingStartMining,
    isLoadingStopMining,
    isLoadingBoxes,
    loadingStatus,
    loadingStatusDns,
    extractedEmails,
    scannedEmails,
    createdContacts,
    verifiedContacts,
    fetchingFinished,
    extractionFinished,
    cleaningFinished,
    activeMiningTask,
    activeTask,
    miningStartedAndFinished,
    miningInterrupted,
    errors,
  };
});
