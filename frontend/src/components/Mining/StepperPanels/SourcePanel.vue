<template>
  <div class="flex flex-col min-[1129px]:flex-row gap-2">
    <div
      v-if="sourceOptions.length"
      class="w-full min-[1129px]:w-1/2 flex flex-col gap-3"
    >
      <p>Pick an existing email address to mine</p>
      <Dropdown
        v-model="sourceModel"
        checkmark
        :options="sourceOptions"
        option-label="email"
        placeholder="email address"
        :pt="{
          trigger: {
            class: 'text-indigo-500',
          },

          input: {
            class: 'text-indigo-500',
          },
          root: {
            class: 'border-[#bcbdf9]',
          },
        }"
      />
    </div>
    <div v-if="sourceOptions.length">
      <Separator
        layout="vertical"
        content="or"
        class="hidden min-[1129px]:flex"
      />
      <Separator
        layout="horizontal"
        content="or"
        class="flex min-[1129px]:hidden"
      />
    </div>
    <div class="shrink-0 flex flex-col gap-3">
      <span>Add a new email provider</span>
      <div class="flex flex-col min-[1129px]:flex-row gap-2 flex-wrap">
        <oauth-source icon="pi pi-google" label="Google" source="google" />
        <oauth-source
          icon="pi pi-microsoft"
          label="Microsoft or Outlook"
          source="azure"
        />
        <imap-source
          v-model:source="sourceModel"
          v-model:show="showImapDialog"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { MiningSources, type MiningSource } from '~/types/mining';
import OauthSource from '@/components/Mining/AddSourceOauth.vue';
import ImapSource from '@/components/Mining/AddSourceImap.vue';

const $stepper = useMiningStepper();
const $leadminerStore = useLeadminerStore();

const showImapDialog = ref(false);
const sourceModel = ref<MiningSource | undefined>();
const sourceOptions = computed(() => useLeadminerStore().miningSources);

function onSourceChange(source: MiningSource) {
  $leadminerStore.boxes = [];
  $leadminerStore.selectedBoxes = [];
  $leadminerStore.activeMiningSource = source;
  $stepper.next();
}

watch(sourceModel, (source) => {
  if (source) {
    onSourceChange(source);
  }
});

function selectSource(source: MiningSources | string) {
  switch (source) {
    case MiningSources.IMAP:
      showImapDialog.value = true;
      break;

    default: {
      const miningSource = $leadminerStore.getMiningSourceByEmail(source);
      if (miningSource) {
        onSourceChange(miningSource);
      }
      break;
    }
  }
}

const { error: sourcesError } = useAsyncData(() =>
  $leadminerStore.fetchMiningSources()
);

onMounted(() => {
  if (sourcesError.value) {
    throw new Error('Failed to fetch mining sources');
  }
});

defineExpose({
  selectSource,
});
</script>
