<template>
  <div v-if="sourceOptions.length" class="flex flex-col space-y-2">
    <span>Pick a source of contacts to mine</span>
    <Dropdown
      v-model="sourceModel"
      checkmark
      :options="sourceOptions"
      option-label="email"
      placeholder="email"
    />
  </div>
  <div class="space-y-2 pt-3">
    <div>
      <span v-if="!sourceOptions.length">Add a new email provider</span>
      <span v-else>Or add a new email provider</span>
    </div>
    <div class="flex gap-2">
      <oauth-source icon="pi pi-google" label="Google" source="google" />
      <oauth-source
        icon="pi pi-microsoft"
        label="Microsoft or Outlook"
        source="azure"
      />
      <imap-source />
    </div>
  </div>
  <div class="flex justify-end">
    <Button
      :disabled="!sourceModel"
      class="text-black bg-amber-13"
      label="Continue with this email account"
      @click="props.nextCallback"
    />
  </div>
</template>

<script setup lang="ts">
import type { MiningSource } from '~/types/mining';
import OauthSource from '@/components/Mining/AddSourceOauth.vue';
import ImapSource from '@/components/Mining/AddSourceImap.vue';

const props = defineProps<{
  nextCallback: Function;
}>();

const $user = useSupabaseUser();
const $leadminerStore = useLeadminerStore();

const sourceModel = ref<MiningSource>();
const sourceOptions = computed(() => useLeadminerStore().miningSources);

const { error: sourcesError } = await useAsyncData(() =>
  $leadminerStore.getMiningSources()
);

onMounted(() => {
  if (sourcesError.value) {
    throw sourcesError.value;
  }

  const { miningSources } = $leadminerStore;
  sourceModel.value = miningSources.find(
    ({ email }) => $user.value && email === $user.value.email
  );
});

watch(sourceModel, (selectedSource) => {
  $leadminerStore.boxes = [];
  $leadminerStore.selectedBoxes = [];
  $leadminerStore.activeMiningSource = selectedSource;
});
</script>
