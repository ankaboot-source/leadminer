<template>
  <div class="flex flex-col md:flex-row gap-2 md:gap-8">
    <div v-if="sourceOptions.length" class="w-full flex flex-col gap-3">
      <p>Pick an email address to mine</p>
      <Dropdown
        v-model="sourceModel"
        checkmark
        :options="sourceOptions"
        option-label="email"
        placeholder="email address"
        @update:model-value="onSourceChange"
      />
    </div>
    <div v-if="sourceOptions.length">
      <Separator layout="vertical" content="or" class="hidden md:flex" />
      <Separator layout="horizontal" content="or" class="flex md:hidden" />
    </div>
    <div class="w-full flex flex-col gap-3">
      <span>Add a new email provider</span>
      <div class="flex flex-col md:flex-row gap-2 flex-wrap">
        <oauth-source icon="pi pi-google" label="Google" source="google" />
        <oauth-source
          icon="pi pi-microsoft"
          label="Microsoft or Outlook"
          source="azure"
        />
        <imap-source />
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

const { error: sourcesError } = useAsyncData(() =>
  $leadminerStore.fetchMiningSources()
);

onMounted(() => {
  if (sourcesError.value) {
    throw new Error('Failed to fetch mining sources');
  }
});

function onSourceChange(source: MiningSource) {
  $leadminerStore.boxes = [];
  $leadminerStore.selectedBoxes = [];
  $leadminerStore.activeMiningSource = source;
  nextCallback();
}
</script>
