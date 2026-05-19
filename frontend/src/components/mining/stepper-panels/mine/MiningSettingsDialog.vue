<template>
  <Dialog
    v-model:visible="isVisible"
    modal
    dismissable-mask
    :maximizable="$screenStore?.size?.md"
    :pt:root:class="{ 'p-dialog-maximized': !$screenStore?.size?.md }"
    :style="{ width: '60vw', height: '70vh' }"
    pt:content:class="grow p-4 border-y border-slate-200"
    pt:footer:class="p-4"
    :header="t('fine_tune_mining')"
  >
    <!-- Toggle -->
    <div class="flex flex-row items-center gap-2 pb-4">
      <ToggleSwitch
        v-model="$leadminerStore.extractSignatures"
        input-id="extractSignatures"
      />
      <label for="extractSignatures" class="cursor-pointer flex-1">
        {{ $t('mining.extract_signatures_option') }}
        <span>{{ $t('mining.extract_signatures_sub') }}</span>
      </label>
    </div>

    <!-- Toggle cleaningEnabled -->
    <div class="flex flex-row items-center gap-2 pb-4">
      <ToggleSwitch
        v-model="$leadminerStore.cleaningEnabled"
        input-id="cleaningEnabled"
      />
      <label for="cleaningEnabled" class="cursor-pointer flex-1">
        {{ $t('mining.cleaning_enabled_option') }}
        <span>{{ $t('mining.cleaning_enabled_sub') }}</span>
      </label>
    </div>

    <!-- Google Contacts Sync Toggle -->
    <div
      v-if="activeMiningSource?.type === 'google'"
      class="flex flex-row items-center gap-2 pb-4"
    >
      <ToggleSwitch
        v-model="$leadminerStore.googleContactsSyncEnabled"
        input-id="googleContactsSyncEnabled"
      />
      <label for="googleContactsSyncEnabled" class="cursor-pointer flex-1">
        {{ $t('mining.sync_google_contacts') }}
        <span>{{ $t('mining.sync_google_contacts_sub') }}</span>
      </label>
    </div>

    <!-- Google Contacts Progress Bar -->
    <div v-if="shouldShowGoogleContactsProgress" class="pb-4">
      <ProgressBar :value="googleContactsProgressValue" :show-value="true">
        {{ $t('mining.syncing_google_contacts') }}
      </ProgressBar>
    </div>

    <div
      v-if="$leadminerStore.miningType === 'email'"
      class="flex items-center gap-2"
    >
      <div class="text-h6">{{ t('select_folders_to_mine') }}</div>
      <Button
        rounded
        outlined
        class="size-8"
        icon="pi pi-refresh"
        :loading="props.isLoadingBoxes"
        :disabled="activeMiningSource === undefined"
        @click="onRefreshImapTree"
      />
      <div class="grow" />

      <Badge :v-tooltip="t('email_messages_selected')" size="large">
        {{ totalEmails.toLocaleString() }}
        <i class="pi pi-envelope ml-1.5" />
      </Badge>
    </div>
    <EmailFoldersTree
      v-if="shouldShowEmailFoldersTree"
      :class="{ disabled: $leadminerStore.activeMiningTask }"
    />

    <template #footer>
      <Button :label="$t('common.save')" @click="close" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
// skipcq: JS-W1028 - Pre-existing: Nuxt auto-imports components with script setup, no default export needed
import EmailFoldersTree from './EmailFoldersTree.vue';

const { t } = useI18n({
  useScope: 'local',
});

const props = defineProps({
  totalEmails: { type: Number, required: true },
  isLoadingBoxes: { type: Boolean, required: true },
});

const $leadminerStore = useLeadminerStore();
const isVisible = ref(false);
const $screenStore = useScreenStore();

const activeMiningSource = computed(() => $leadminerStore.activeMiningSource);
const boxes = computed(() => $leadminerStore.boxes);
const shouldShowEmailFoldersTree = computed(
  () => boxes.value.length > 0 && !props.isLoadingBoxes,
);

const shouldShowGoogleContactsProgress = computed(
  () =>
    activeMiningSource.value?.type === 'google' &&
    $leadminerStore.googleContactsSyncEnabled &&
    !$leadminerStore.googleContactsFetched &&
    $leadminerStore.activeTask,
);

const googleContactsProgressValue = computed(() => {
  if ($leadminerStore.googleContactsFetched) {
    return 100;
  }
  return 50;
});

async function onRefreshImapTree() {
  try {
    $leadminerStore.isLoadingBoxes = true;
    await $leadminerStore.fetchInbox();
    $leadminerStore.isLoadingBoxes = false;
  } catch (err) {
    $leadminerStore.isLoadingBoxes = false;
    throw err;
  }
}

function open() {
  isVisible.value = true;
}

function close() {
  isVisible.value = false;
}

defineExpose({
  open,
});
</script>

<i18n lang="json">
{
  "en": {
    "fine_tune_mining": "Fine-tune your mining",
    "select_folders_to_mine": "Select folders to mine",
    "email_messages_selected": "Email messages selected",
    "sync_google_contacts": "Sync Google Contacts",
    "sync_google_contacts_sub": "(syncs contacts from your Google account)",
    "syncing_google_contacts": "Syncing Google Contacts..."
  },
  "fr": {
    "fine_tune_mining": "Affinez l'extraction",
    "select_folders_to_mine": "Sélectionnez les dossiers à extraire",
    "email_messages_selected": "E-mails sélectionnés",
    "sync_google_contacts": "Synchroniser les contacts Google",
    "sync_google_contacts_sub": "(synchronise les contacts de votre compte Google)",
    "syncing_google_contacts": "Synchronisation des contacts Google..."
  }
}
</i18n>
