<template>
  <Dialog
    v-model:visible="$leadminerStore.autoExtractDialog"
    modal
    :header="'Continuous Contact Extraction'"
    class="w-full sm:w-[35rem]"
  >
    <p>
      Enable continuous contact extraction from future emails?
      <br />
      New contacts found in incoming emails will be automatically saved.
    </p>
    <template #footer>
      <div class="flex flex-col sm:flex-row justify-between w-full gap-2">
        <Button
          label="Yes, enable"
          class="w-full sm:w-auto"
          @click="enableAutoExtract()"
        />
        <Button
          :label="$t('common.cancel')"
          class="w-full sm:w-auto"
          severity="secondary"
          @click="closeAutoExtractDialog()"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import type { MiningSource } from '~/types/mining';

const miningSource = ref<MiningSource>();

const $leadminerStore = useLeadminerStore();
const $supabase = useSupabaseClient();

watch(
  () => $leadminerStore.autoExtractDialog,
  (newVal) => {
    if (newVal) {
      miningSource.value = $leadminerStore.activeMiningSource;
    }
  },
);

function closeAutoExtractDialog() {
  $leadminerStore.autoExtractDialog = false;
}

async function enableAutoExtract() {
  if (miningSource.value) {
    console.log('Enabling auto extract for', miningSource.value);

    const { error } = await $supabase
      // @ts-expect-error: Issue with nuxt/supabase
      .schema('private')
      .from('mining_sources')
      .update({ auto_extract: true })
      .match({ email: miningSource.value.email });

    if (error) {
      throw error;
    }
  }
  closeAutoExtractDialog();
}
</script>
