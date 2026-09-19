<template>
  <div
    class="flex flex-col grow border border-surface-200 rounded-md p-4 gap-4"
  >
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">{{ t('sources') }}</h1>
      <Button
        v-if="$leadminer.miningSources.length > 0"
        icon="pi pi-plus"
        outlined
        :label="t('add_source')"
        @click="showAddSourceDialog = true"
      />
    </div>

    <Dialog
      v-model:visible="showAddSourceDialog"
      modal
      :header="t('add_source')"
      :style="{ width: '30rem' }"
    >
      <div class="flex flex-col gap-3">
        <Button class="w-full justify-start" outlined @click="addGoogleSource">
          <i class="pi pi-google mr-2" />
          Google
        </Button>
        <Button class="w-full justify-start" outlined @click="addAzureSource">
          <i class="pi pi-microsoft mr-2" />
          {{ t('microsoft_or_outlook') }}
        </Button>
        <Button
          class="w-full justify-start"
          outlined
          @click="openImapFromAddSource"
        >
          <i class="pi pi-inbox mr-2" />
          {{ t('other_email_provider') }}
        </Button>
      </div>
    </Dialog>

    <div class="hidden">
      <AddSourceImap
        v-model:source="imapSourceModel"
        v-model:show="showAddSourceImapDialog"
      />
    </div>

    <div
      v-if="
        $leadminer.isLoadingMiningSources && !$leadminer.miningSources.length
      "
      class="grid gap-3"
    >
      <div
        v-for="n in 3"
        :key="`source-skeleton-${n}`"
        class="border border-surface-200 rounded-md p-4"
      >
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div class="flex flex-col gap-2">
            <Skeleton width="8rem" height="1rem" />
            <Skeleton width="14rem" height="0.85rem" />
          </div>
          <div class="flex items-center gap-2">
            <Skeleton width="5.5rem" height="2rem" />
            <Skeleton width="2.8rem" height="1.6rem" />
            <Skeleton width="5.2rem" height="1.75rem" />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <Skeleton height="4.5rem" />
          <Skeleton height="4.5rem" />
          <Skeleton height="4.5rem" />
        </div>
      </div>
    </div>

    <DataView
      :value="$leadminer.miningSources"
      data-key="email"
      :paginator="true"
      :rows="10"
    >
      <template #empty>
        <div
          class="text-center py-8 text-surface-500 flex flex-col items-center gap-4"
        >
          <span>{{ t('no_sources') }}</span>
          <Button
            icon="pi pi-plus"
            :label="t('add_source')"
            @click="showAddSourceDialog = true"
          />
        </div>
      </template>
      <template #list="slotProps">
        <div class="grid gap-3">
          <div
            v-for="source in slotProps.items"
            :key="source.email"
            class="border border-surface-200 rounded-md p-4"
          >
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div class="min-w-0">
                <div class="font-medium">{{ source.email }}</div>
              </div>

              <div class="flex items-center justify-end gap-2 flex-wrap">
                <div class="flex items-center gap-2 text-sm text-surface-600">
                  <span>{{ t('continuous_mining') }}</span>
                  <ToggleSwitch
                    :model-value="source.passive_mining"
                    :disabled="isActiveMiningSource(source)"
                    @update:model-value="
                      (val: boolean) => togglePassiveMining(source, val)
                    "
                  />
                </div>

                <div
                  v-if="source.type === 'google'"
                  class="flex items-center gap-2 text-sm text-surface-600"
                >
                  <span>{{ t('google_contacts_sync') }}</span>
                  <ToggleSwitch
                    :model-value="
                      getSourceConfig(source, 'google_contacts_sync')
                    "
                    :disabled="!source.passive_mining"
                    @update:model-value="
                      (val: boolean) =>
                        toggleSourceConfig(source, 'google_contacts_sync', val)
                    "
                  />
                </div>

                <Button
                  size="small"
                  outlined
                  severity="danger"
                  icon="pi pi-trash"
                  :label="t('remove')"
                  :loading="
                    isDeleting && deletingSource?.email === source.email
                  "
                  @click="openDeleteDialog(source)"
                />

                <div
                  v-if="sourceStatus(source).showReconnect"
                  class="flex gap-2 items-center"
                >
                  <Tag
                    :value="t(sourceStatus(source).badge.labelKey)"
                    :severity="sourceStatus(source).badge.severity"
                    :icon="sourceStatus(source).badge.icon"
                  />
                  <Button
                    :label="t('reconnect')"
                    size="small"
                    severity="primary"
                    @click="reconnectExpiredSource(source)"
                  />
                </div>
                <Tag
                  v-else
                  :value="t(sourceStatus(source).badge.labelKey)"
                  :severity="sourceStatus(source).badge.severity"
                />
              </div>
            </div>

            <div
              v-if="needsReauth(source)"
              class="mt-3 p-3 rounded bg-red-50 border border-red-200 flex items-center justify-between flex-wrap gap-2"
            >
              <div class="flex items-center gap-2 text-sm text-red-600">
                <i class="pi pi-exclamation-triangle"></i>
                <span class="font-medium">{{ t('source_needs_reauth') }}</span>
              </div>
              <Button
                :label="t('reconnect')"
                size="small"
                severity="danger"
                @click="reconnectExpiredSource(source)"
              />
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-sm">
              <div class="p-2 rounded bg-surface-50">
                <div class="text-surface-500">{{ t('provider') }}</div>
                <div class="flex items-center gap-2 font-semibold mt-1">
                  <i
                    :class="getIcon(source.type)"
                    class="text-secondary size-xs"
                  ></i>
                  <span class="capitalize">{{ source.type }}</span>
                </div>
              </div>

              <div class="p-2 rounded bg-surface-50">
                <div class="text-surface-500">{{ t('total_contacts') }}</div>
                <div class="font-semibold mt-1">
                  {{ source.totalContacts || 0 }}
                </div>
              </div>

              <div class="p-2 rounded bg-surface-50">
                <div class="text-surface-500">{{ t('last_extraction') }}</div>
                <div class="font-semibold mt-1">
                  {{
                    source.lastMiningDate
                      ? formatDate(source.lastMiningDate)
                      : '-'
                  }}
                </div>
                <div
                  v-if="source.totalFromLastMining"
                  class="text-xs text-surface-500"
                >
                  {{ source.totalFromLastMining }} {{ t('contacts') }}
                </div>
              </div>
            </div>

            <div
              v-if="source.passive_mining && passiveMiningStatus(source).status"
              class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-sm"
            >
              <div class="p-2 rounded bg-surface-50">
                <div class="text-surface-500">
                  {{ t('passive_mining_status') }}
                </div>
                <div class="font-semibold mt-1 capitalize">
                  {{ t(passiveMiningStatus(source).label) }}
                </div>
              </div>

              <div class="p-2 rounded bg-surface-50">
                <div class="text-surface-500">{{ t('last_passive_run') }}</div>
                <div class="font-semibold mt-1">
                  {{
                    deriveSourceState(source).lastRunAt
                      ? formatDate(
                          deriveSourceState(source).lastRunAt as string,
                        )
                      : '-'
                  }}
                </div>
              </div>

              <div
                v-if="deriveSourceState(source).minableFolders.length"
                class="p-2 rounded bg-surface-50"
              >
                <div class="text-surface-500">{{ t('folders_mined') }}</div>
                <div class="font-semibold mt-1">
                  {{ deriveSourceState(source).minableFolders.length }}
                </div>
              </div>

              <div
                v-if="passiveMiningErrors(source).length"
                class="p-2 rounded bg-surface-50 md:col-span-2"
              >
                <div class="text-surface-500">
                  {{ t('passive_mining_errors') }}
                </div>
                <div class="text-xs text-red-500 mt-1">
                  {{ passiveMiningErrors(source).join('; ') }}
                </div>
              </div>
            </div>

            <div
              v-if="isActiveMiningSource(source)"
              class="mt-4 p-3 rounded bg-surface-50 border border-primary/20"
            >
              <div class="flex items-center justify-between flex-wrap gap-2">
                <div class="flex items-center gap-2">
                  <span
                    v-if="!isStrictlyPassive(source)"
                    class="relative flex h-2 w-2"
                  >
                    <span
                      class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"
                    ></span>
                    <span
                      class="relative inline-flex h-2 w-2 rounded-full bg-primary"
                    ></span>
                  </span>
                  <span class="text-sm font-medium text-primary">{{
                    t('mining_in_progress')
                  }}</span>
                  <Tag
                    v-if="isStrictlyPassive(source)"
                    severity="info"
                    :value="t('passive')"
                    class="text-xs ml-1"
                  />
                </div>
                <div class="flex items-center gap-2 text-sm text-surface-600">
                  <span
                    >{{ t('emails_scanned') }}: {{ $leadminer.scannedEmails }}
                  </span>
                  <span class="text-surface-400">|</span>
                  <span
                    >{{ t('emails_extracted') }}:
                    {{ $leadminer.extractedEmails }}</span
                  >
                  <span class="text-surface-400">|</span>
                  <span
                    >{{ t('emails_cleaned') }}:
                    {{ $leadminer.verifiedContacts }}</span
                  >
                  <Button
                    v-if="!isStrictlyPassive(source)"
                    size="small"
                    severity="secondary"
                    :label="t('view_mining')"
                    class="ml-2"
                    @click="navigateTo('/mine')"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </DataView>

    <Dialog
      v-model:visible="deleteDialogVisible"
      modal
      :header="t('remove_source')"
      :style="{ width: '28rem', maxWidth: '95vw' }"
    >
      <div class="text-sm text-surface-700">
        {{ t('remove_source_confirm') }}
      </div>

      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <Button outlined :label="t('cancel')" @click="closeDeleteDialog" />
          <Button
            severity="danger"
            :label="t('remove')"
            :loading="isDeleting"
            @click="confirmDelete"
          />
        </div>
      </template>
    </Dialog>

    <PassiveMiningFolderDialog
      v-model:visible="passiveDialogVisible"
      :source="passiveDialogSource"
      :mode="passiveDialogMode"
      :rows="passiveDialogRows"
      :saving="passiveDialogSaving"
      :loading="passiveDialogLoading"
      @confirm="onPassiveDialogConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import AddSourceImap from '@/components/mining/stepper-panels/source/AddSourceImap.vue';
import PassiveMiningFolderDialog from '@/components/mining/PassiveMiningFolderDialog.vue';
import { addOAuthAccount } from '@/utils/oauth';
import { resolveReconnectFallbackAction } from '@/utils/reconnectFallback';
import type { MiningSource, MiningTaskGroup } from '~/types/mining';
import { deriveSourceStatus } from '@/utils/sourceStatus';
import {
  fetchSourceFolders,
  updateMiningSourceConfig,
  updatePassiveMining,
} from '@/utils/sources';
import { deriveSourceState } from '@/utils/miningSourceConfig';
import type { MiningSourceConfigFlags } from '@/utils/miningSourceConfig';
import {
  folderDisplayName,
  getSelectedFolderKeys,
} from '@/utils/selected-folders';
import {
  buildPassiveFolderList,
  type PassiveFolderRow,
} from '@/utils/passive-mining-folders';
import { flattenBoxNodes } from '~/utils/box-tree';
import { getDefaultAndExcludedFolders } from '~/utils/boxes';
import { SourceHealthState } from '~/types/enums';
import { describeCronSchedule, isSameUtcDay } from '@/utils/cronSchedule';

const $leadminer = useLeadminerStore();
const { t } = useI18n({
  useScope: 'local',
});
// Global-scope translator for keys shared with data-driven toasts
// (resolved by the global toast template in app.vue).
const { t: $tGlobal } = useI18n({ useScope: 'global' });
const { $saasEdgeFunctions } = useNuxtApp();
const $toast = useToast();
const $route = useRoute();
const $router = useRouter();
const $imapDialogStore = useImapDialog();

const deleteDialogVisible = ref(false);
const deletingSource = ref<MiningSource | null>(null);
const isDeleting = ref(false);
const showAddSourceDialog = ref(false);
const imapSourceModel = ref<MiningSource>();
const showAddSourceImapDialog = ref(false);

async function addGoogleSource() {
  showAddSourceDialog.value = false;
  try {
    await addOAuthAccount('google', '/sources');
  } catch {
    $toast.add({
      severity: 'error',
      summary: t('add_source_failed'),
      detail: t('add_source_failed_detail'),
      life: 4500,
    });
  }
}

async function addAzureSource() {
  showAddSourceDialog.value = false;
  try {
    await addOAuthAccount('azure', '/sources');
  } catch {
    $toast.add({
      severity: 'error',
      summary: t('add_source_failed'),
      detail: t('add_source_failed_detail'),
      life: 4500,
    });
  }
}

function openImapFromAddSource() {
  showAddSourceDialog.value = false;
  nextTick(() => {
    showAddSourceImapDialog.value = true;
  });
}

function getIcon(type: string) {
  switch (type) {
    case 'google':
      return 'pi pi-google';
    case 'azure':
      return 'pi pi-microsoft';
    default:
      return 'pi pi-inbox';
  }
}

function isActiveMiningSource(source: MiningSource): boolean {
  const isActiveForeground =
    $leadminer.activeMiningSource?.email === source.email &&
    $leadminer.miningTask;

  const isPassiveBackground = $leadminer.passiveMinings?.some(
    (group: MiningTaskGroup) =>
      group.task?.miningSource?.source === source.email,
  );

  return Boolean(isActiveForeground || isPassiveBackground);
}
function isStrictlyPassive(source: MiningSource): boolean {
  return Boolean(
    $leadminer.passiveMinings?.some(
      (group: MiningTaskGroup) =>
        group.task?.miningSource?.source === source.email,
    ) &&
    !(
      $leadminer.activeMiningTask &&
      $leadminer.activeMiningSource?.email === source.email
    ),
  );
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString();
}

function openDeleteDialog(source: MiningSource) {
  deletingSource.value = source;
  deleteDialogVisible.value = true;
}

function closeDeleteDialog() {
  deleteDialogVisible.value = false;
  deletingSource.value = null;
}

async function confirmDelete() {
  if (!deletingSource.value) return;

  isDeleting.value = true;

  try {
    await $saasEdgeFunctions('delete-mining-source', {
      method: 'DELETE',
      body: { email: deletingSource.value.email },
    });

    $toast.add({
      severity: 'success',
      summary: t('source_deleted'),
      detail: t('source_deleted_detail'),
      life: 3500,
    });

    closeDeleteDialog();
    await $leadminer.fetchMiningSources();
  } catch (error) {
    $toast.add({
      severity: 'error',
      summary: t('remove_source_failed'),
      detail: (error as Error).message,
      life: 4500,
    });
  } finally {
    isDeleting.value = false;
  }
}

// Keep in sync with the passive-cron-job migration
// (supabase/migrations/*_passive_mining_cron_job.sql).
const PASSIVE_CRON_SCHEDULE = '0 2 * * *';

const passiveDialogVisible = ref(false);
const passiveDialogSource = ref<MiningSource>();
const passiveDialogMode = ref<'first-time' | 'update'>('first-time');
const passiveDialogRows = ref<PassiveFolderRow[]>([]);
const passiveDialogLoading = ref(false);
const { isSaving: passiveDialogSaving, enablePassiveMining } =
  useEnablePassiveMining();

function registeredPassiveFolders(source: MiningSource): string[] {
  return Array.isArray(source.config?.folders)
    ? source.config.folders.filter((f): f is string => typeof f === 'string')
    : [];
}

function passiveFolderLabel(key: string): string {
  return folderDisplayName(key, $tGlobal('sources.folder_inbox'));
}

/**
 * Continuous (passive) mining is scheduled server-side by a daily cron job.
 * Turning it on must first be confirmed against a folder list; turning it off
 * only PATCHes the source preference. Neither path starts a mining run.
 */
async function togglePassiveMining(source: MiningSource, value: boolean) {
  if (value) {
    await promptEnablePassiveMining(source);
  } else {
    await disablePassiveMining(source);
  }
}
async function disablePassiveMining(source: MiningSource) {
  try {
    source.config = await updatePassiveMining(
      source.email,
      source.type,
      false,
      {},
    );
    source.passive_mining = false;
    $toast.add({
      severity: 'info',
      summary: t('passive_mining_disabled'),
      detail: t('passive_mining_disabled_detail'),
      life: 4500,
    });
  } catch (error) {
    $toast.add({
      severity: 'error',
      summary: t('passive_mining_update_failed'),
      detail: (error as Error).message,
      life: 4500,
    });
  }
}

async function promptEnablePassiveMining(source: MiningSource) {
  passiveDialogSource.value = source;
  const registered = registeredPassiveFolders(source);
  passiveDialogMode.value = registered.length > 0 ? 'update' : 'first-time';
  passiveDialogRows.value = [];

  // The folders the user mined most recently are the natural passive set.
  const recent = deriveSourceState(source).minableFolders;
  if (recent.length > 0) {
    passiveDialogRows.value = buildPassiveFolderList({
      mined: recent,
      registered,
      available: recent,
      labelFor: passiveFolderLabel,
      keysFrom: 'mined',
    });
    passiveDialogVisible.value = true;
    return;
  }

  // Never-mined source: ask the server for its folders so the user can pick.
  passiveDialogVisible.value = true;
  passiveDialogLoading.value = true;
  try {
    const folders = await fetchSourceFolders(source);
    const keys = flattenBoxNodes(folders).map((node) => node.key);
    const { defaultFolders, excludedKeys } =
      getDefaultAndExcludedFolders(folders);
    passiveDialogRows.value = buildPassiveFolderList({
      mined: keys,
      registered,
      available: keys,
      checked: getSelectedFolderKeys(defaultFolders, excludedKeys),
      labelFor: passiveFolderLabel,
      keysFrom: 'mined',
    });
  } catch (error) {
    passiveDialogVisible.value = false;
    $toast.add({
      severity: 'error',
      summary: t('passive_mining_update_failed'),
      detail: (error as Error).message,
      life: 4500,
    });
  } finally {
    passiveDialogLoading.value = false;
  }
}

async function onPassiveDialogConfirm(payload: {
  folders: string[];
  flags: MiningSourceConfigFlags;
}) {
  const source = passiveDialogSource.value;
  if (!source) return;
  const enabled = await enablePassiveMining(
    source,
    payload.folders,
    payload.flags,
  );
  if (!enabled) return;
  passiveDialogVisible.value = false;
  showPassiveMiningEnabledToast(payload.folders);
}

function showPassiveMiningEnabledToast(folders: string[]) {
  // Explain what enabling actually does: when it will run and on which folders.
  const schedule = describeCronSchedule(PASSIVE_CRON_SCHEDULE);
  const foldersLabel =
    describeFolderList(folders) ??
    $tGlobal('sources.passive_mining_folders_default');
  const nextRun = schedule.nextRunAt;
  $toast.add({
    severity: 'success',
    summary: t('passive_mining_enabled'),
    detail: $tGlobal('sources.passive_mining_enabled_detail', {
      schedule: $tGlobal(schedule.schedule.key, schedule.schedule.value ?? {}),
      nextRunDay: nextRun
        ? $tGlobal(
            isSameUtcDay(nextRun, new Date())
              ? 'sources.today'
              : 'sources.tomorrow',
          )
        : '',
      nextRunTime: schedule.time ?? '',
      folders: foldersLabel,
    }),
    life: 7000,
  });
}

function describeFolderList(folders: string[]): string | null {
  if (folders.length === 1) {
    const [name] = folders;
    if (!name) return '';
    return folderDisplayName(name, $tGlobal('sources.folder_inbox'));
  }
  if (folders.length > 1) {
    return $tGlobal(
      'sources.folder_count',
      { count: folders.length },
      folders.length,
    );
  }
  return null;
}

function getSourceConfig(source: MiningSource, key: string): boolean {
  const flags = (source.config?.flags ?? {}) as Record<string, unknown>;
  return flags[key] === true;
}

function passiveMiningStatus(source: MiningSource) {
  const { state, lastRunAt } = deriveSourceState(source);
  // Running derives from live task rows (passiveMinings); here we map the
  // durable source health to UI labels.
  const status = state;
  let label = '';
  if (isSourceMiningNow(source)) {
    label = 'mining_status_running';
  } else if (status === SourceHealthState.Error) {
    label = 'mining_status_failed';
  } else if (status === SourceHealthState.NeedsReauth) {
    label = 'source_needs_reauth';
  } else if (status === SourceHealthState.Active) {
    label = lastRunAt ? 'mining_status_done' : 'passive_mining_idle';
  }
  return { status, label };
}

function isSourceMiningNow(source: MiningSource): boolean {
  return $leadminer.passiveMinings?.some(
    (g) => g?.task?.miningSource?.source === source.email,
  );
}

const PASSIVE_STATUS_POLL_MS = 60_000;

function passiveMiningErrors(source: MiningSource): string[] {
  return deriveSourceState(source).lastError ?? [];
}

function needsReauth(source: MiningSource): boolean {
  return deriveSourceState(source).state === SourceHealthState.NeedsReauth;
}

async function toggleSourceConfig(
  source: MiningSource,
  key: string,
  value: boolean,
) {
  try {
    // Send params only; mining-sources merges them (unknown keys preserved).
    const patch = { mining_flags: { [key]: value } };
    source.config = await updateMiningSourceConfig(
      source.email,
      source.type,
      patch,
    );
  } catch (error) {
    $toast.add({
      severity: 'error',
      summary: t('config_update_failed'),
      detail: (error as Error).message,
      life: 4500,
    });
  }
}

function sourceStatus(source: MiningSource) {
  return deriveSourceStatus(source, {
    email: isActiveMiningSource(source) ? source.email : undefined,
    status: $leadminer.miningTask?.status,
  });
}

async function reconnectExpiredSource(source: MiningSource) {
  if (!sourceStatus(source).showReconnect) {
    return;
  }

  try {
    if (source.type === 'imap') {
      $imapDialogStore.imapEmail = source.email;
      $imapDialogStore.showImapDialog = true;
      return;
    }

    if (source.type !== 'google' && source.type !== 'azure') {
      throw new Error(t('reconnect_unavailable'));
    }

    await addOAuthAccount(source.type, '/sources');
  } catch (error) {
    $toast.add({
      severity: 'error',
      summary: t('reconnect_failed'),
      detail: (error as Error).message,
      life: 4500,
    });
  }
}

// Passive mining runs on a server-side cron, so its status only changes
// through fetches — without polling, the status row goes stale for anyone
// who leaves this page open (the exact case: "did last night's run fire?").
// Silent: no spinner churn, no sender-options refetch. Stopped on unmount.
const passiveStatusPoll = setInterval(async () => {
  if (document.visibilityState !== 'visible') return;
  try {
    await Promise.all([
      $leadminer.fetchMiningSources({ silent: true }),
      $leadminer.getCurrentRunningMining(),
    ]);
  } catch {
    // keep the last known state on transient failures
  }
}, PASSIVE_STATUS_POLL_MS);
onUnmounted(() => clearInterval(passiveStatusPoll));

onMounted(async () => {
  await $leadminer.ensureMiningSourcesLoaded();

  // Refresh the active-mining state so an in-progress run shows under its
  // source even when the app bootstrap ran before this mining started.
  try {
    await $leadminer.getCurrentRunningMining();
  } catch {
    // non-blocking: sources list still renders without mining state
  }

  const reconnectEmail = $route.query.reconnect as string;

  if (reconnectEmail) {
    const source = $leadminer.miningSources.find(
      (s) => s.email.toLowerCase() === reconnectEmail.toLowerCase(),
    );

    const clearReconnectQuery = () => $router.replace({ query: {} });

    if (source && sourceStatus(source).showReconnect) {
      clearReconnectQuery();

      if (source.type === 'imap') {
        $imapDialogStore.imapEmail = source.email;
        $imapDialogStore.showImapDialog = true;
      } else {
        await reconnectExpiredSource(source);
      }
    } else if (!source) {
      clearReconnectQuery();

      const action = resolveReconnectFallbackAction(reconnectEmail);

      try {
        if (action === 'google' || action === 'azure') {
          await addOAuthAccount(action, '/sources');
          return;
        }
      } catch {
        $toast.add({
          severity: 'error',
          summary: t('add_source_failed'),
          detail: t('add_source_failed_detail'),
          life: 4500,
        });
      }

      $imapDialogStore.imapEmail = reconnectEmail;
      $imapDialogStore.showImapDialog = true;
    } else {
      clearReconnectQuery();
    }
  }
});
</script>

<i18n lang="json">
{
  "en": {
    "sources": "Sources",
    "add_source": "Add source",
    "microsoft_or_outlook": "Microsoft or Outlook",
    "other_email_provider": "Other email provider (IMAP)",
    "add_source_failed": "Unable to add source",
    "add_source_failed_detail": "An error occurred while adding the source.",
    "no_sources": "No sources yet",
    "email": "Email",
    "provider": "Provider",
    "last_extraction": "Last extraction",
    "passive_mining_status": "Continuous mining status",
    "last_passive_run": "Last continuous run",
    "folders_mined": "Folders mined",
    "passive_mining_errors": "Errors",
    "passive_mining_retrying": "Retrying",
    "passive_mining_idle": "Idle",
    "mining_status_failed": "Failed",
    "source_needs_reauth": "Connection lost — please reconnect to continue",
    "continuous_mining": "Continuous mining",
    "remove": "Remove",
    "remove_source": "Remove source",
    "remove_source_confirm": "Remove this mining source permanently? This action cannot be undone.",
    "remove_source_failed": "Unable to remove source",
    "type": "Type",
    "passive_mining": "Continuous mining",
    "credentials": "Credentials",
    "status": "Status",
    "connected": "Connected",
    "credential_expired": "Credential expired",
    "enabled": "Enabled",
    "disabled": "Disabled",
    "delete_source": "Delete",
    "delete_source_confirm": "Delete this mining source permanently? This action cannot be undone.",
    "cancel": "Cancel",
    "source_deleted": "Source deleted",
    "source_deleted_detail": "The mining source has been permanently deleted.",
    "delete_source_failed": "Unable to delete source",
    "stop_mining": "Stop mining",
    "view_mining": "View mining",
    "passive": "Continuous",
    "mining_in_progress": "Mining in progress",
    "mining_status_running": "Mining in progress",
    "mining_status_done": "Mining completed",
    "mining_status_canceled": "Mining canceled",
    "mining_start_failed": "Unable to start mining",
    "mining_already_running": "Mining already running",
    "mining_already_running_detail": "Another source is currently being mined.",
    "google_contacts_sync": "Google Contacts",
    "config_update_failed": "Unable to update source settings",
    "passive_mining_update_failed": "Unable to update continuous mining",
    "passive_mining_enabled": "Continuous mining enabled",
    "passive_mining_disabled": "Continuous mining disabled",
    "passive_mining_disabled_detail": "No automatic email checks will run for this source.",
    "reconnect_failed": "Unable to reconnect source",
    "reconnect_unavailable": "Reconnect URL is unavailable",
    "reconnect_not_supported": "Reconnect not supported",
    "reconnect_not_supported_detail": "This source requires manual credential update.",
    "reconnect": "Reconnect",
    "emails_scanned": "Scanned",
    "emails_extracted": "Extracted",
    "emails_cleaned": "Cleaned",
    "mining_stopped": "Mining stopped",
    "mining_stopped_detail": "The mining process has been stopped.",
    "stop_mining_failed": "Unable to stop mining",
    "total_contacts": "Contacts (Total)",
    "last_mining": "Last mining",
    "contacts": "contacts"
  },
  "fr": {
    "sources": "Sources",
    "add_source": "Ajouter une source",
    "microsoft_or_outlook": "Microsoft ou Outlook",
    "other_email_provider": "Autre compte e-mail (IMAP)",
    "add_source_failed": "Impossible d'ajouter la source",
    "add_source_failed_detail": "Une erreur s'est produite lors de l'ajout de la source.",
    "no_sources": "Aucune source",
    "email": "Email",
    "provider": "Fournisseur",
    "last_extraction": "Dernière extraction",
    "passive_mining_status": "Statut de l'extraction continue",
    "last_passive_run": "Dernière extraction continue",
    "folders_mined": "Dossiers traités",
    "passive_mining_errors": "Erreurs",
    "passive_mining_retrying": "Nouvel essai",
    "passive_mining_idle": "En attente",
    "mining_status_failed": "Échec",
    "source_needs_reauth": "Connexion perdue — veuillez vous reconnecter pour continuer",
    "continuous_mining": "Extraction continue",
    "remove": "Supprimer",
    "remove_source": "Supprimer la source",
    "remove_source_confirm": "Supprimer définitivement cette source de minage ? Cette action est irréversible.",
    "remove_source_failed": "Impossible de supprimer la source",
    "type": "Type",
    "passive_mining": "Extraction continue",
    "credentials": "Identifiants",
    "status": "Statut",
    "connected": "Connecté",
    "credential_expired": "Identifiant expiré",
    "enabled": "Activé",
    "disabled": "Désactivé",
    "delete_source": "Supprimer",
    "delete_source_confirm": "Supprimer définitivement cette source de minage ? Cette action est irréversible.",
    "cancel": "Annuler",
    "source_deleted": "Source supprimée",
    "source_deleted_detail": "La source de minage a été supprimée définitivement.",
    "delete_source_failed": "Impossible de supprimer la source",
    "stop_mining": "Arrêter le minage",
    "view_mining": "Voir le minage",
    "passive": "Continu",
    "mining_in_progress": "Extraction en cours",
    "mining_status_running": "Extraction en cours",
    "mining_status_done": "Extraction terminée",
    "mining_status_canceled": "Extraction annulée",
    "mining_start_failed": "Impossible de démarrer l'extraction",
    "mining_already_running": "Extraction déjà en cours",
    "mining_already_running_detail": "Une autre source est en cours d'extraction.",
    "google_contacts_sync": "Contacts Google",
    "config_update_failed": "Impossible de mettre à jour les paramètres",
    "passive_mining_update_failed": "Impossible de mettre à jour l'extraction continue",
    "passive_mining_enabled": "Extraction continue activée",
    "passive_mining_disabled": "Extraction continue désactivée",
    "passive_mining_disabled_detail": "Aucune vérification automatique des e-mails ne sera effectuée pour cette source.",
    "reconnect_failed": "Impossible de reconnecter la source",
    "reconnect_unavailable": "URL de reconnexion indisponible",
    "reconnect_not_supported": "Reconnexion non prise en charge",
    "reconnect_not_supported_detail": "Cette source nécessite une mise à jour manuelle des identifiants.",
    "reconnect": "Reconnecter",
    "emails_scanned": "Scannés",
    "emails_extracted": "Extracts",
    "emails_cleaned": "Nettoyés",
    "mining_stopped": "Extraction stoppée",
    "mining_stopped_detail": "Le processus d'extraction a été stoppé.",
    "stop_mining_failed": "Impossible de stopper le minage",
    "total_contacts": "Contacts (Total)",
    "last_mining": "Dernier minage",
    "contacts": "contacts"
  }
}
</i18n>
