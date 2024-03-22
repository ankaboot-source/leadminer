import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { type BoxNode, getDefaultSelectedFolders } from '../utils/boxes';
import { sse } from '../utils/sse';
import { type MiningSource, type MiningTask } from '../types/mining';
import type { Profile } from '@/types/user';
import { updateMiningSourcesValidity } from '@/utils/sources';

export const useLeadminerStore = defineStore('leadminer', () => {
  const $router = useRouter();
  const { $api } = useNuxtApp();

  const userCredits = ref(0);

  const miningTask = ref<MiningTask | undefined>();
  const miningSources = ref<MiningSource[]>([]);
  const activeMiningSource = ref<MiningSource | undefined>();
  const boxes = ref<BoxNode[]>([]);
  const selectedBoxes = ref<string[]>([]);

  const errorMessage = ref('');
  const infoMessage = ref('');

  const isLoadingStartMining = ref(false);
  const isLoadingStopMining = ref(false);
  const isLoadingBoxes = ref(false);

  const isLoadingSources = ref(false);
  const loadingStatus = ref(false);
  const loadingStatusDns = ref(false);
  const loadingStatusbox = ref(false);

  const extractedEmails = ref(0);
  const scannedEmails = ref(0);
  const totalFetchedEmails = ref(0);
  const verifiedContacts = ref(0);
  const createdContacts = ref(0);
  const fetchingFinished = ref(true);
  const extractionFinished = ref(true);
  const status = ref('');
  const scannedBoxes = ref<string[]>([]);
  const statistics = ref({});

  const errors = ref({});

  function $reset() {
    miningTask.value = undefined;
    miningSources.value = [];
    activeMiningSource.value = undefined;
    boxes.value = [];
    selectedBoxes.value = [];

    errorMessage.value = '';
    infoMessage.value = '';

    isLoadingStartMining.value = false;
    isLoadingStopMining.value = false;
    isLoadingBoxes.value = false;
    isLoadingSources.value = false;
    loadingStatus.value = false;
    loadingStatusDns.value = false;
    loadingStatusbox.value = false;

    extractedEmails.value = 0;
    scannedEmails.value = 0;
    totalFetchedEmails.value = 0;
    verifiedContacts.value = 0;
    createdContacts.value = 0;

    status.value = '';
    scannedBoxes.value = [];
    statistics.value = {};
    errors.value = {};
  }

  /**
   * Synchronizes user credits with the backend.
   */
  async function syncUserCredits() {
    const { credits } = (
      await useSupabaseClient().from('profiles').select('*').single()
    ).data as unknown as Profile;
    userCredits.value = credits;
  }

  /**
   * Retrieves mining sources.
   * @throws {Error} Throws an error if there is an issue while retrieving mining sources.
   */
  async function getMiningSources() {
    try {
      isLoadingSources.value = true;

      const { sources } = await $api<{
        message: string;
        sources: MiningSource[];
      }>('/imap/mine/sources');

      miningSources.value = sources ?? [];

      isLoadingSources.value = false;
    } catch (err) {
      isLoadingSources.value = false;
      throw err;
    }
  }

  async function getBoxes() {
    try {
      if (!activeMiningSource.value) {
        return;
      }

      loadingStatusbox.value = true;
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
        infoMessage.value = 'Successfully retrieved IMAP boxes.';
      }

      miningSources.value = updateMiningSourcesValidity(
        miningSources.value,
        activeMiningSource.value,
        true
      );
    } catch (err) {
      if (
        activeMiningSource.value?.type &&
        ['google', 'azure'].includes(activeMiningSource.value.type)
      ) {
        $router.push(await redirectOauthConsentPage());
      }
      miningSources.value = updateMiningSourcesValidity(
        miningSources.value,
        activeMiningSource.value as MiningSource,
        false
      );
      loadingStatusbox.value = false;
      throw err;
    }
  }

  /**
   * Starts the mining process.
   * @throws {Error} Throws an error if there is an issue while starting the mining process.
   */
  async function startMining() {
    loadingStatus.value = true;
    loadingStatusDns.value = true;
    scannedEmails.value = 0;
    extractedEmails.value = 0;
    verifiedContacts.value = 0;
    createdContacts.value = 0;
    fetchingFinished.value = false;
    extractionFinished.value = false;
    statistics.value = 'f';
    scannedBoxes.value = [];

    try {
      const { data: sessionData } = await useSupabaseClient().auth.getSession();
      if (!sessionData.session?.access_token) {
        return;
      }

      const { data } = await $api<{ data: MiningTask }>(
        `/imap/mine/${sessionData.session.user.id}`,
        {
          method: 'POST',
          body: {
            boxes: selectedBoxes.value,
            miningSource: activeMiningSource.value,
          },
        }
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
            totalFetchedEmails.value = totalFetched;
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
        }
      );

      miningTask.value = task;
      loadingStatus.value = false;
      loadingStatusDns.value = false;
      status.value = '';
      infoMessage.value = 'Mining has started';
    } catch (err) {
      loadingStatus.value = false;
      loadingStatusDns.value = false;
      status.value = '';
      sse.closeConnection();
      throw err;
    }
  }

  /**
   * Stops the mining process.
   * @throws {Error} Throws an error if there is an issue while stopping the mining process.
   */
  async function stopMining() {
    try {
      const { data: session } = await useSupabaseClient().auth.getUser();

      if (!session.user || !miningTask.value) {
        return;
      }

      const { miningId } = miningTask.value;

      await $api(`/imap/mine/${session.user.id}/${miningId}`, {
        method: 'DELETE',
      });

      miningTask.value = undefined;
      status.value = '';
      infoMessage.value = 'Mining has stopped';
      fetchingFinished.value = true;
      extractionFinished.value = true;
    } catch (err) {
      // Reset values and rethrow error
      status.value = '';
      fetchingFinished.value = true;
      extractionFinished.value = true;
      throw err;
    }
  }

  return {
    getMiningSources,
    getBoxes,
    startMining,
    stopMining,
    $reset,
    syncUserCredits,
    userCredits,
    miningTask,
    miningSources,
    activeMiningSource,
    boxes,
    selectedBoxes,
    errorMessage,
    infoMessage,
    isLoadingStartMining,
    isLoadingStopMining,
    isLoadingBoxes,
    isLoadingSources,
    loadingStatus,
    loadingStatusDns,
    loadingStatusbox,
    totalFetchedEmails,
    extractedEmails,
    scannedEmails,
    createdContacts,
    verifiedContacts,
    fetchingFinished,
    extractionFinished,
    status,
    scannedBoxes,
    statistics,
    errors,
  };
});
