import { defineStore } from 'pinia';
import type { TreeSelectionKeys } from 'primevue/tree';
import { ref } from 'vue';

import { updateMiningSourcesValidity } from '@/utils/sources';
import type { MiningSource, MiningTask } from '../types/mining';
import { type BoxNode, getDefaultSelectedFolders } from '../utils/boxes';
import { sse } from '../utils/sse';

export const useLeadminerStore = defineStore('leadminer', () => {
  const { $api } = useNuxtApp();

  const activeEnrichment = ref(false);
  const activeMiningSource = ref<MiningSource | undefined>();

  const miningTask = ref<MiningTask | undefined>();
  const miningStartedAt = ref<number | undefined>();
  const miningSources = ref<MiningSource[]>([]);
  const boxes = ref<BoxNode[]>([]);
  const selectedBoxes = ref<TreeSelectionKeys>([]);
  const selectedEmails = ref<string[]>([]);

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

  const activeTask = computed(
    () =>
      miningTask.value !== undefined ||
      isLoadingBoxes.value ||
      !cleaningFinished.value ||
      activeEnrichment.value,
  );

  const errors = ref({});

  function $resetMining() {
    miningTask.value = undefined;
    miningStartedAt.value = undefined;
    activeMiningSource.value = undefined;
    boxes.value = [];
    selectedBoxes.value = [];
    selectedEmails.value = [];

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

  /**
   * Starts the mining process.
   * @throws {Error} Throws an error if there is an issue while starting the mining process.
   */
  async function startMining(source: 'boxes' | 'file') {
    if (source === 'boxes') {
      loadingStatus.value = true;
      loadingStatusDns.value = true;
      scannedEmails.value = 0;
      extractedEmails.value = 0;
      verifiedContacts.value = 0;
      createdContacts.value = 0;
      fetchingFinished.value = false;
      extractionFinished.value = false;
      cleaningFinished.value = false;

      try {
        const { data: sessionData } =
          await useSupabaseClient().auth.getSession();
        if (!sessionData.session?.access_token) {
          return;
        }
        isLoadingStartMining.value = true;
        const { data } = await $api<{ data: MiningTask }>(
          `/imap/mine/${sessionData.session.user.id}`,
          {
            method: 'POST',
            body: {
              boxes: Object.keys(selectedBoxes.value).filter(
                (key) => selectedBoxes.value[key].checked && key !== '',
              ),
              miningSource: activeMiningSource.value,
            },
          },
        );

        const task = data;
        sse.initConnection(
          task?.miningId as string,
          sessionData.session.access_token,
          {
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
            onFetchingDone: (totalFetched) => {
              scannedEmails.value = totalFetched;
              fetchingFinished.value = true;
            },
            onExtractionDone: (totalExtracted) => {
              extractedEmails.value = totalExtracted;
              extractionFinished.value = true;
            },
            onVerifiedContacts: (totalVerified) => {
              verifiedContacts.value = totalVerified;
            },
            onCreatedContacts: (totalCreated) => {
              createdContacts.value = totalCreated;
            },
          },
        );

        miningTask.value = task;
        miningStartedAt.value = performance.now();
        loadingStatus.value = false;
        loadingStatusDns.value = false;
        isLoadingStartMining.value = false;
      } catch (err) {
        loadingStatus.value = false;
        loadingStatusDns.value = false;
        isLoadingStartMining.value = false;
        sse.closeConnection();
        throw err;
      }
    } else if (source === 'file') {
      console.log('mine file', selectedEmails.value);
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

      await $api(`/imap/mine/${user.id}/${miningId}`, {
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
    miningStartedAt,
    miningSources,
    activeMiningSource,
    boxes,
    selectedBoxes,
    selectedEmails,
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
    activeTask,
    errors,
  };
});
