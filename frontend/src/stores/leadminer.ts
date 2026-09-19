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
import { resolvePassiveMiningPrompt } from '@/utils/passive-mining-folders';
import { getSelectedFolderKeys } from '@/utils/selected-folders';
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
import {
  extractFolderWatermarks,
  refreshBoxWatermarks,
} from '../utils/watermarks';
import { MiningRunMode } from '~/types/enums';
import { sse } from '../utils/sse';
import { useContactsStore } from './contacts';
import { useEnrichmentStore } from './enrichment';

export const useLeadminerStore = defineStore('leadminer', () => {
  const { $api, $saasEdgeFunctions, $i18n } = useNuxtApp();
  const { t, getBrowserLocale } = $i18n;
  const language = getBrowserLocale() || 'en';
  const $toast = useToast();
  const $stepper = useMiningStepper();
  const supabase = useSupabaseClient();
  const config = useRuntimeConfig();
  const $contactsStore = useContactsStore();
  const $enrichmentStore = useEnrichmentStore();

  const activeMiningSource = ref<MiningSource | undefined>();

  const miningType = ref<MiningType>('email');

  const miningTask = ref<MiningTask | undefined>();

  const passiveMinings = ref<MiningTaskGroup[]>([]);

  // Folders requested by the current email run. The post-run passive prompt
  // compares these (not the live tree selection) against the passive
  // registration, so explicit-override runs are covered too.
  const lastRunEmailFolders = ref<string[] | null>(null);

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
  const googleContactsTotal = ref(0);
  const googleContactsFetchedCount = ref(0);

  const fetchingFinished = ref(true);
  const extractionFinished = ref(true);
  const cleaningFinished = ref(true);
  const signatureExtractionFinished = ref(false);

  const googleContactsFetched = ref(false);
  const sourceConfig = ref<MiningSourceConfigFlags>(deriveSourceConfig());

  const miningCompleted = ref(false);

  const activeMiningTask = computed(() => miningTask.value !== undefined);

  const activeTask = computed(
    () =>
      activeMiningTask.value ||
      isLoadingBoxes.value ||
      $enrichmentStore.isActive,
  );

  const passiveMiningDialog = ref(false);
  const passiveMiningDialogShown = ref(false);
  const passiveMiningDialogMode = ref<'first-time' | 'update'>('first-time');
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
   * mining run — first-time enable prompt when the source is not on
   * continuous mining, or an update prompt when the run mined folders not
   * yet registered — unless the run was interrupted. Owned by the store so
   * it survives component unmount (e.g. google-contacts-only runs,
   * resumed/reloaded runs).
   *
   * Shown at most once per run: extraction-related events fire several times
   * (extraction finished, google contacts fetched, mining completed) and the
   * prompt must not reappear after the user answered it.
   */
  function maybeOpenPassiveMiningDialog() {
    if (passiveMiningDialogShown.value) return;
    if (miningInterrupted.value) return;
    const source = activeMiningSource.value;
    if (!source) return;

    const registered = Array.isArray(source.config?.folders)
      ? source.config.folders.filter((f): f is string => typeof f === 'string')
      : [];
    const mined =
      lastRunEmailFolders.value ??
      getSelectedFolderKeys(selectedBoxes.value, excludedBoxes.value);

    const mode = resolvePassiveMiningPrompt({
      passiveEnabled: Boolean(source.passive_mining),
      minedFolders: mined,
      registeredFolders: registered,
    });
    if (!mode) return;

    passiveMiningDialogMode.value = mode;
    passiveMiningDialogShown.value = true;
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
    lastRunEmailFolders.value = null;
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
    googleContactsTotal.value = 0;
    googleContactsFetchedCount.value = 0;

    miningInterrupted.value = false;

    miningType.value = 'email';

    passiveMiningDialog.value = false;
    passiveMiningDialogShown.value = false;

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
  async function fetchMiningSources(options: { silent?: boolean } = {}) {
    const { silent = false } = options;

    // Silent mode is for background refreshes (e.g. passive-status polling):
    // no loading flag (watchers react to it) and no sender-options fetch.
    if (!silent) {
      isLoadingMiningSources.value = true;
    }

    try {
      const sources = await getMiningSources();

      const previousValidityMap = new Map(
        miningSources.value.map((s) => [s.email.toLowerCase(), s.isValid]),
      );

      miningSources.value = sources.map((source) => ({
        ...source,
        isValid: previousValidityMap.get(source.email.toLowerCase()) ?? true,
      }));

      if (!silent) {
        fetchSenderOptionsInBackground();
      }
    } finally {
      if (!silent) {
        isLoadingMiningSources.value = false;
      }
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

  /**
   * Re-derives watermark flags on the EXISTING boxes tree from the freshly
   * fetched source config, without refetching IMAP boxes (slow, resets
   * scroll/expand state). Only `watermark`/`status` fields are touched, so
   * selection, expansion, and counts are preserved. No-op when there is no
   * active source config or no fresh watermark.
   */
  function refreshTreeWatermarks() {
    if (boxes.value.length === 0) return;
    const activeEmail = activeMiningSource.value?.email?.toLowerCase();
    if (!activeEmail) return;
    const freshSource =
      miningSources.value.find((s) => s.email.toLowerCase() === activeEmail) ??
      activeMiningSource.value;
    const rawConfig = freshSource?.config;
    if (!rawConfig) return;
    const watermarks = extractFolderWatermarks(rawConfig);
    if (Object.keys(watermarks).length === 0) return;
    refreshBoxWatermarks(boxes.value, watermarks);
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
    // Stale SSE callbacks are ignored by comparing the run's miningId (unique
    // per run) with the active task — no separate run-token counter needed.
    const isCurrentRun = () => miningTask.value?.miningId === miningId;

    sse.initConnection(type, miningId, serverEndpoint, token, {
      onExtractedUpdate: (count) => {
        if (isCurrentRun()) extractedEmails.value = count;
      },
      onFetchedUpdate: (count) => {
        if (isCurrentRun()) scannedEmails.value = count;
      },
      onTotalImportedUpdate: (total) => {
        if (isCurrentRun()) totalImported.value = total;
      },
      onClose: () => {
        if (isCurrentRun()) sse.closeConnection();
      },
      onError: () => {
        if (!isCurrentRun()) return;
        miningInterrupted.value = true;
        setTimeout(async () => {
          if (!isCurrentRun()) return;
          try {
            await stopMiningApi(true, []);
          } catch (err) {
            console.error('[SSE] error: ', (err as Error).message);
          }
          if (!isCurrentRun()) return;
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
        if (!isCurrentRun()) return;
        scannedEmails.value = totalFetched;
        fetchingFinished.value = true;
      },
      onExtractionDone: (totalExtracted) => {
        if (!isCurrentRun()) return;
        extractedEmails.value = totalExtracted;
        extractionFinished.value = true;
      },
      onCleaningDone: (totalCleaned) => {
        if (!isCurrentRun()) return;
        verifiedContacts.value = totalCleaned;
        cleaningFinished.value = true;
      },
      onSignatureExtractionDone: () => {
        if (isCurrentRun()) signatureExtractionFinished.value = true;
      },
      onVerifiedContacts: (totalVerified) => {
        if (isCurrentRun()) verifiedContacts.value = totalVerified;
      },
      onCreatedContacts: (totalCreated) => {
        if (isCurrentRun()) createdContacts.value = totalCreated;
      },
      onMiningCompleted: () => {
        if (!isCurrentRun()) return;
        console.info('Mining marked as completed.');
        miningCompleted.value = true;
        $contactsStore.setSkipOrgLookup(false);
        // The continuous-extraction prompt is owned by the extraction
        // completion paths (see maybeOpenPassiveMiningDialog); do not reopen
        // it when the whole pipeline completes.
        setTimeout(async () => {
          if (!isCurrentRun()) return;
          miningTask.value = undefined;
          await fetchMiningSources();
          refreshTreeWatermarks();
        }, 100);
      },
      onGoogleContactsFetched: () => {
        if (!isCurrentRun()) return;
        googleContactsFetched.value = true;
        maybeOpenPassiveMiningDialog();
      },
      onGoogleContactsTotalUpdate: (total) => {
        if (isCurrentRun()) googleContactsTotal.value = total;
      },
      onGoogleContactsFetchedCountUpdate: (count) => {
        if (isCurrentRun()) googleContactsFetchedCount.value = count;
      },
    });
  }

  async function startMiningEmail(
    userId: string,
    folders: string[],
    miningSource: MiningSource,
    runMode: MiningRunMode,
  ) {
    miningType.value = 'email';
    lastRunEmailFolders.value = folders;

    // The server derives the resume cursor from the source's persisted
    // watermark; the client only sends intent (folders + run mode).
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
          miningMode: runMode,
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
  async function startMining(
    source: MiningType,
    storagePath?: string,
    runMode: MiningRunMode = MiningRunMode.Full,
    foldersOverride?: string[],
  ) {
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
    googleContactsTotal.value = 0;
    googleContactsFetchedCount.value = 0;

    fetchingFinished.value = false;
    extractionFinished.value = false;
    cleaningFinished.value = false;
    signatureExtractionFinished.value = false;

    try {
      isLoadingStartMining.value = true;
      miningCompleted.value = false;
      googleContactsFetched.value = false;
      miningInterrupted.value = false;
      passiveMiningDialog.value = false;
      passiveMiningDialogShown.value = false;
      lastRunEmailFolders.value = null;

      let task;
      switch (source) {
        case 'email':
          if (!activeMiningSource.value)
            throw new Error('activeMiningSource is required for mining EMAIL');
          task = await startMiningEmail(
            userId,
            foldersOverride ??
              getSelectedFolderKeys(selectedBoxes.value, excludedBoxes.value),
            activeMiningSource.value,
            runMode,
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
      totalImported.value = 0;
      sse.closeConnection();
      miningTask.value = task;
      startProgressListener(
        miningType.value,
        task.miningId,
        config.public.SERVER_ENDPOINT,
        token,
      );
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
      refreshTreeWatermarks();
    } catch (err) {
      fetchingFinished.value = true;
      extractionFinished.value = true;
      cleaningFinished.value = true;
      signatureExtractionFinished.value = true;
      isLoadingStopMining.value = false;
      await fetchMiningSources();
      refreshTreeWatermarks();
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
    googleContactsTotal.value = progress.googleContactsTotal ?? 0;
    googleContactsFetchedCount.value = progress.googleContactsFetchedCount ?? 0;

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

      const resumedToken = (await supabase.auth.getSession()).data.session
        ?.access_token;
      startProgressListener(
        miningType.value,
        task.miningId,
        config.public.SERVER_ENDPOINT,
        resumedToken ?? null,
      );

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
    refreshTreeWatermarks,

    $reset,
    $resetMining,

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
    googleContactsTotal,
    googleContactsFetchedCount,
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
    passiveMiningDialogMode,
    passiveMinings,
    miningStartedAndFinished,
    miningInterrupted,
    errors,
    language,
    pstFilePath,
  };
});
