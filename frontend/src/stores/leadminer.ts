import { defineStore } from 'pinia';
import type { TreeSelectionKeys } from 'primevue/tree';
import { ref } from 'vue';

import {
  getMiningSources,
  updateMiningSourcesValidity,
  updateMiningSourcesValidityFromUnavailable,
} from '@/utils/sources';
import { extractUnavailableSenderEmails } from '@/utils/senderOptions';
import {
  type MiningSourceConfigFlags,
  deriveSourceConfig,
} from '@/utils/miningSourceConfig';
import { startMiningNotification } from '~/utils/extras';
import {
  type MiningSource,
  type MiningTask,
  type MiningTaskGroup,
  type MiningType,
  type TaskState,
  MiningTypes,
} from '../types/mining';
import type { BoxNode } from '../utils/boxes';
import { sse } from '../utils/sse';
import { useContactsStore } from './contacts';

export const useLeadminerStore = defineStore('leadminer', () => {
  const { $api, $saasEdgeFunctions, $i18n } = useNuxtApp();
  const { t, getBrowserLocale } = $i18n;
  const language = getBrowserLocale() || 'en';
  const $toast = useToast();
  const $stepper = useMiningStepper();
  const supabase = useSupabaseClient();
  const config = useRuntimeConfig();
  const $contactsStore = useContactsStore();

  const activeEnrichment = ref(false);
  const activeMiningSource = ref<MiningSource | undefined>();

  const miningType = ref<MiningType>('email');

  const miningTask = ref<MiningTask | undefined>();

  const passiveMinings = ref<MiningTaskGroup[]>([]);

  const miningStartedAt = ref<number | undefined>(); // timestamp in performance.now() time (ms)
  const miningSources = ref<MiningSource[]>([]);
  const isLoadingMiningSources = ref(false);
  const hasLoadedMiningSources = ref(false);
  const boxes = ref<BoxNode[]>([]);
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
  const totalImported = ref(0);
  const extractedEmails = ref(0);
  const scannedEmails = ref(0);
  const verifiedContacts = ref(0);
  const createdContacts = ref(0);

  const fetchingFinished = ref(true);
  const extractionFinished = ref(true);
  const cleaningFinished = ref(true);
  const signatureExtractionFinished = ref(false);

  const googleContactsFetched = ref(false);
  const sourceConfig = ref<MiningSourceConfigFlags>(deriveSourceConfig());

  // Resume-vs-full choice for incremental mining. When resumeFromMining.value
  // is set, startMiningEmail sends it as resumeFrom so the fetcher only pulls
  // UIDs above the persisted watermark. Chosen via the dialog in sources.vue.
  const resumeFromMining = ref<{
    folders: Record<string, { uidvalidity: string; last_uid: number }>;
  } | null>(null);

  const miningCompleted = ref(false);

  const activeMiningTask = computed(() => miningTask.value !== undefined);

  const activeTask = computed(
    () =>
      activeMiningTask.value || isLoadingBoxes.value || activeEnrichment.value,
  );

  const passiveMiningDialog = ref(false);
  // resolveSenderOptions does per-source verifyTransport (SMTP/OAuth + token
  // refresh) plus a DB call. With several sources it can easily take 5-10s,
  // and a previous 3s cap caused false "preserving previous validity" warnings.
  const SENDER_OPTIONS_TIMEOUT_MS = 10_000;

  const miningStartedAndFinished = computed(() =>
    Boolean(miningStartedAt.value && miningCompleted.value),
  );

  const miningInterrupted = ref(false);
  const errors = ref({});

  /**
   * Offers the "Enable continuous contact extraction?" dialog at the end of a
   * mining run, unless the source is already on continuous (passive) mining or
   * the run was interrupted. Owned by the store so it survives component
   * unmount (e.g. google-contacts-only runs, resumed/reloaded runs).
   */
  function maybeOpenPassiveMiningDialog() {
    if (miningInterrupted.value) return;
    const source = activeMiningSource.value;
    if (!source || source.passive_mining) return;
    passiveMiningDialog.value = true;
  }

  function getCurrentUserId() {
    const user = useSupabaseUser().value;
    return user?.id || (user as { sub?: string } | null)?.sub;
  }

  function $resetMining() {
    miningTask.value = undefined;
    miningStartedAt.value = undefined;
    activeMiningSource.value = undefined;
    passiveMinings.value = [];
    boxes.value = [];
    selectedBoxes.value = [];
    excludedBoxes.value = new Set();
    selectedFile.value = null;
    sourceConfig.value = deriveSourceConfig();
    isLoadingStartMining.value = false;
    isLoadingStopMining.value = false;
    isLoadingBoxes.value = false;
    loadingStatus.value = false;
    loadingStatusDns.value = false;

    totalMessages.value = 0;
    totalImported.value = 0;
    extractedEmails.value = 0;
    scannedEmails.value = 0;
    verifiedContacts.value = 0;
    createdContacts.value = 0;

    fetchingFinished.value = true;
    extractionFinished.value = true;
    cleaningFinished.value = true;
    signatureExtractionFinished.value = false;

    miningCompleted.value = false;
    googleContactsFetched.value = false;

    activeEnrichment.value = false;

    miningInterrupted.value = false;

    miningType.value = 'email';

    passiveMiningDialog.value = false;

    resumeFromMining.value = null;

    errors.value = {};
  }

  function $reset() {
    miningSources.value = [];
    hasLoadedMiningSources.value = false;
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
    isLoadingMiningSources.value = true;

    try {
      const sources = await getMiningSources();

      const previousValidityMap = new Map(
        miningSources.value.map((s) => [s.email.toLowerCase(), s.isValid]),
      );

      miningSources.value = sources.map((source) => ({
        ...source,
        isValid: previousValidityMap.get(source.email.toLowerCase()) ?? true,
      }));

      fetchSenderOptionsInBackground();
    } finally {
      isLoadingMiningSources.value = false;
    }
  }

  /**
   * Loads mining sources once per session. Consumers that display a mining
   * source call this instead of fetchMiningSources() directly, which keeps
   * source fetching lazy (only where a source is shown) and avoids duplicate
   * fetches (auth screen, every protected-route navigation).
   */
  async function ensureMiningSourcesLoaded() {
    if (hasLoadedMiningSources.value || isLoadingMiningSources.value) {
      return;
    }
    try {
      await fetchMiningSources();
      hasLoadedMiningSources.value = true;
    } catch (error) {
      // Leave hasLoadedMiningSources=false so the next consumer retries.
      console.warn('[mining] failed to load mining sources', error);
    }
  }

  async function fetchSenderOptionsInBackground() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        SENDER_OPTIONS_TIMEOUT_MS,
      );

      const senderOptionsData = (await $saasEdgeFunctions(
        'email-campaigns/campaigns/sender-options',
        { method: 'POST', signal: controller.signal },
      )) as {
        options?: { email: string; available: boolean }[];
      };

      clearTimeout(timeoutId);

      const allOptions = (senderOptionsData.options || []).map((option) => ({
        email: option.email,
        available: option.available,
      }));
      const unavailableEmails = extractUnavailableSenderEmails(allOptions);

      miningSources.value = updateMiningSourcesValidityFromUnavailable(
        miningSources.value,
        unavailableEmails,
      );
    } catch (error) {
      console.warn(
        'Failed to fetch sender-options, preserving previous validity:',
        error,
      );
    }
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
    const userId = getCurrentUserId();

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

  function startProgressListener(
    type: MiningType,
    miningId: string,
    serverEndpoint: string,
    token: string | null,
  ) {
    sse.initConnection(type, miningId, serverEndpoint, token, {
      onExtractedUpdate: (count) => {
        extractedEmails.value = count;
      },
      onFetchedUpdate: (count) => {
        scannedEmails.value = count;
      },
      onTotalImportedUpdate: (total) => {
        totalImported.value = total;
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
      onSignatureExtractionDone: () => {
        signatureExtractionFinished.value = true;
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
        $contactsStore.setSkipOrgLookup(false);
        maybeOpenPassiveMiningDialog();
        setTimeout(async () => {
          miningTask.value = undefined;
          await fetchMiningSources();
        }, 100);
      },
      onGoogleContactsFetched: () => {
        googleContactsFetched.value = true;
        maybeOpenPassiveMiningDialog();
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
          miningSource: miningSource.id
            ? { id: miningSource.id }
            : { email: miningSource.email },
          extractSignatures: sourceConfig.value.extract_signatures,
          cleaningEnabled: sourceConfig.value.cleaning_enabled,
          googleContactsSync: sourceConfig.value.google_contacts_sync,
          ...(resumeFromMining.value
            ? { resumeFrom: resumeFromMining.value }
            : {}),
        },
      },
    );

    // Consumed once: don't leak one source's watermark into a later run for a
    // different source (the value is only meaningful for the fetch just issued).
    resumeFromMining.value = null;

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

    // File mining has no active source — use fresh defaults, not the last
    // email source's config.
    const fileConfig = deriveSourceConfig();

    const { data: task } = await $api<{ data: MiningTask }>(
      `/imap/mine/${miningType.value}/${userId}`,
      {
        method: 'POST',
        body: {
          name: fileName,
          contacts: importedContacts,
          cleaningEnabled: fileConfig.cleaning_enabled,
        },
      },
    );

    return task;
  }

  async function startMiningPST(userId: string, fileName: string) {
    miningType.value = 'pst';

    // PST mining has no active source — use fresh defaults.
    const pstConfig = deriveSourceConfig();

    const { data: task } = await $api<{ data: MiningTask }>(
      `/imap/mine/pst/${userId}`,
      {
        method: 'POST',
        body: {
          name: fileName,
          extractSignatures: pstConfig.extract_signatures,
          cleaningEnabled: pstConfig.cleaning_enabled,
        },
      },
    );

    return task;
  }

  const pstFilePath = ref('');

  async function startMiningPostgreSQL(
    userId: string,
    options: {
      connection: {
        host: string;
        port: number;
        database: string;
        username: string;
        password: string;
        ssl: boolean;
      };
      query: string;
      mapping: Record<string, string>;
      saveConnection: boolean;
      connectionName: string;
    },
  ) {
    miningType.value = 'postgresql';
    fetchingFinished.value = true;
    scannedEmails.value = 1;

    const { data: task } = await $api<{ data: MiningTask }>(
      `/imap/mine/postgresql/${userId}`,
      {
        method: 'POST',
        body: {
          connection: options.connection,
          query: options.query,
          mapping: options.mapping,
          saveConnection: options.saveConnection,
          connectionName: options.connectionName,
        },
      },
    );

    return task;
  }

  /**
   * Starts the mining process.
   * @throws {Error} Throws an error if there is an issue while starting the mining process.
   */
  async function startMining(source: MiningType, storagePath?: string) {
    await supabase.auth.refreshSession(); // Refresh session on mining start

    const userId = getCurrentUserId();
    const token = (await supabase.auth.getSession()).data.session?.access_token;

    if (!userId || !token) return;
    if (source === 'file' && !selectedBoxes.value) return;
    if (source === 'email' && !activeMiningSource.value) return;

    // reset, prepare states
    loadingStatus.value = true;
    loadingStatusDns.value = true;

    totalMessages.value = 0;
    totalImported.value = 0;
    scannedEmails.value = 0;
    extractedEmails.value = 0;
    createdContacts.value = 0;
    verifiedContacts.value = 0;

    fetchingFinished.value = false;
    extractionFinished.value = false;
    cleaningFinished.value = false;
    signatureExtractionFinished.value = false;

    try {
      isLoadingStartMining.value = true;

      let task;
      switch (source) {
        case 'email':
          if (!activeMiningSource.value)
            throw new Error('activeMiningSource is required for mining EMAIL');
          task = await startMiningEmail(
            userId,
            Object.keys(selectedBoxes.value).filter(
              (key) =>
                selectedBoxes.value[key].checked &&
                !excludedBoxes.value.has(key) &&
                key !== '',
            ),
            activeMiningSource.value,
          );
          break;
        case 'file':
          if (!selectedFile.value)
            throw new Error('selectedFile is required for mining FILE');
          task = await startMiningFile(
            userId,
            selectedFile.value.name,
            selectedFile.value.contacts,
          );
          break;
        case 'pst':
          if (!storagePath)
            throw new Error('Storage path is required for mining PST');
          task = await startMiningPST(userId, storagePath);
          break;
        case 'postgresql':
          if (!storagePath)
            throw new Error('Storage path is required for mining PostgreSQL');
          task = await startMiningPostgreSQL(userId, JSON.parse(storagePath));
          break;
        default:
          throw new Error(`Unknown mining source: ${source}`);
      }

      totalMessages.value = task.progress?.totalMessages ?? 0;
      totalImported.value = task.progress?.totalImported ?? 0;
      sse.closeConnection();
      startProgressListener(
        miningType.value,
        task.miningId,
        config.public.SERVER_ENDPOINT,
        token,
      );

      miningTask.value = task;
      miningStartedAt.value = performance.now();
      $contactsStore.setSkipOrgLookup(true);
      startMiningNotification($toast, t, config.public.DATA_PRIVACY_URL);
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
        $contactsStore.setSkipOrgLookup(false);
        fetchingFinished.value = true;
        cleaningFinished.value = true;
        signatureExtractionFinished.value = true;
      }
      fetchingFinished.value = true;
      extractionFinished.value = true;
      signatureExtractionFinished.value = true;
      isLoadingStopMining.value = false;
      await fetchMiningSources();
    } catch (err) {
      fetchingFinished.value = true;
      extractionFinished.value = true;
      cleaningFinished.value = true;
      signatureExtractionFinished.value = true;
      isLoadingStopMining.value = false;
      await fetchMiningSources();
      throw err;
    }
  }

  const isTaskFinished = (status: string | null | undefined): boolean => {
    return status === null || status === undefined
      ? false
      : ['done', 'canceled'].includes(status);
  };

  const updateMiningProgress = (
    task: MiningTask,
    fetch: TaskState | null,
    extract: TaskState | null,
    clean: TaskState | null,
  ) => {
    const { progress } = task;
    totalMessages.value = progress.totalMessages;
    scannedEmails.value = progress.fetched ?? 0;
    extractedEmails.value = progress.extracted ?? 0;
    createdContacts.value = progress.createdContacts ?? 0;
    verifiedContacts.value = progress.verifiedContacts ?? 0;

    fetchingFinished.value =
      miningType.value === MiningTypes.EMAIL
        ? fetch !== null && ['done', 'canceled'].includes(fetch.status)
        : true;

    extractionFinished.value = isTaskFinished(extract?.status ?? null);

    cleaningFinished.value = isTaskFinished(clean?.status ?? null);
  };

  async function getCurrentRunningMining() {
    const userId = getCurrentUserId();

    if (!userId) return 1;

    try {
      const response = await $api<{
        active: Array<MiningTaskGroup | undefined>;
        passive: Array<MiningTaskGroup | undefined>;
      }>(`/imap/mine/${userId}/`);

      if (!response) return 1;

      passiveMinings.value = (response.passive || []).filter(
        (g): g is MiningTaskGroup => g !== undefined,
      );

      if (!response.active || response.active.length === 0) {
        return 1;
      }

      const firstActive = response.active[0];
      if (!firstActive) return 1;

      const { task } = firstActive;
      if (!task || !task.miningSource.type) return 1;

      const {
        miningSource: { type: mType },
      } = task;

      const { fetch } = firstActive;
      const { extract } = firstActive;
      const { clean } = firstActive;

      const hasRequiredPhases =
        mType === MiningTypes.FILE
          ? Boolean(extract)
          : Boolean(fetch) && Boolean(extract);

      if (!hasRequiredPhases) return 1;

      miningTask.value = task;
      miningType.value = mType;
      $contactsStore.setSkipOrgLookup(true);
      activeMiningSource.value = miningSources.value.find(
        ({ email }) => email === task.miningSource.source,
      );
      sourceConfig.value = deriveSourceConfig(activeMiningSource.value?.config);

      const firstStepFetch = miningType.value === MiningTypes.EMAIL && fetch;
      if (firstStepFetch) {
        miningStartedAt.value =
          performance.now() -
          (Date.now() - new Date(fetch.started_at).getTime());
      } else if (extract) {
        miningStartedAt.value =
          performance.now() -
          (Date.now() - new Date(extract.started_at).getTime());
      }

      updateMiningProgress(task, fetch, extract, clean);

      startProgressListener(miningType.value, task.miningId);

      return extractionFinished.value ? 3 : 2;
    } catch (err) {
      console.error(err);
      return 1;
    }
  }

  watch(
    activeMiningSource,
    () => {
      sourceConfig.value = deriveSourceConfig(activeMiningSource.value?.config);
    },
    {
      immediate: true,
    },
  );

  return {
    fetchInbox,
    fetchMiningSources,
    ensureMiningSourcesLoaded,
    getMiningSourceByEmail,
    getCurrentRunningMining,
    startMining,
    stopMining,
    maybeOpenPassiveMiningDialog,

    $reset,
    $resetMining,

    activeEnrichment,
    miningTask,
    miningType,
    miningStartedAt,
    miningSources,
    isLoadingMiningSources,
    activeMiningSource,
    boxes,
    selectedBoxes,
    excludedBoxes,
    selectedFile,
    isLoadingStartMining,
    isLoadingStopMining,
    isLoadingBoxes,
    loadingStatus,
    loadingStatusDns,
    totalMessages,
    totalImported,
    extractedEmails,
    scannedEmails,
    createdContacts,
    verifiedContacts,
    fetchingFinished,
    extractionFinished,
    cleaningFinished,
    signatureExtractionFinished,
    miningCompleted,
    googleContactsFetched,
    sourceConfig,
    activeMiningTask,
    activeTask,
    passiveMiningDialog,
    resumeFromMining,
    passiveMinings,
    miningStartedAndFinished,
    miningInterrupted,
    errors,
    language,
    pstFilePath,
  };
});
