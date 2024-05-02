<template>
  <div class="flex flex-col min-[1129px]:flex-row gap-2">
    <div
      v-if="sourceOptions.length"
      class="w-full min-[1129px]:w-1/2 flex flex-col gap-3"
    >
      <p>Pick an existing email address to mine</p>
      <Dropdown
        v-model="sourceModel"
        class="border-[#bcbdf9]"
        checkmark
        :options="sourceOptions"
        option-label="email"
        placeholder="email address"
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
        <imap-source v-model:source="sourceModel" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MiningSource } from '~/types/mining';
import OauthSource from '@/components/Mining/AddSourceOauth.vue';
import ImapSource from '@/components/Mining/AddSourceImap.vue';

const { nextCallback } = defineProps<{
  // skipcq: JS-0296
  nextCallback: Function;
}>();

const $leadminerStore = useLeadminerStore();

const sourceModel = ref<MiningSource | undefined>();
const sourceOptions = computed(() => useLeadminerStore().miningSources);

function onSourceChange(source: MiningSource) {
  $leadminerStore.boxes = [];
  $leadminerStore.selectedBoxes = [];
  $leadminerStore.activeMiningSource = source;
  nextCallback();
}

const { error: sourcesError } = useAsyncData(() =>
  $leadminerStore.fetchMiningSources()
);

onMounted(() => {
  if (sourcesError.value) {
    throw new Error('Failed to fetch mining sources');
  }
});

watch(sourceModel, (source) => {
  if (source) {
    onSourceChange(source);
  }
});
</script>
