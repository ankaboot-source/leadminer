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
    <!-- aligned switch (quick) -->
    <div class="flex items-center gap-2 pb-4">
      <ToggleSwitch
        v-model="$leadminerStore.extractSignatures"
        input-id="extractSignatures"
      />
      <label for="extractSignatures" class="cursor-pointer">
        {{ t('extract_signatures_option') }} {{ t('extract_signatures_sub') }}
      </label>
    </div>

    <div class="flex items-center gap-2">
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
    <TreeCard
      v-if="shouldShowTreeCard"
      :class="{ disabled: $leadminerStore.activeMiningTask }"
    />

    <template #footer>
      <Button :label="$t('common.save')" @click="close" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import TreeCard from '@/components/cards/TreeCard.vue';

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
const shouldShowTreeCard = computed(
  () => boxes.value.length > 0 && !props.isLoadingBoxes,
);

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
    "extract_signatures_option": "Extract contact details from signatures",
    "extract_signatures_sub": "( this may take more time )"
  },
  "fr": {
    "fine_tune_mining": "Affinez l'extraction",
    "select_folders_to_mine": "Sélectionnez les dossiers à extraire",
    "email_messages_selected": "E-mails sélectionnés",
    "extract_signatures_option": "Extraire les coordonnées depuis les signatures",
    "extract_signatures_sub": "(l'extraction prendra plus de temps)"
  }
}
</i18n>
