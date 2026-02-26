<template>
  <Dialog
    v-model:visible="$leadminerStore.passiveMiningDialog"
    modal
    :header="t('header')"
    class="w-full sm:w-[35rem]"
  >
    <p>
      {{ t('paragraph_1') }} <br />
      {{ t('paragraph_2') }}
    </p>
    <template #footer>
      <div class="flex flex-col sm:flex-row justify-between w-full gap-2">
        <Button
          :label="$t('common.cancel')"
          class="w-full sm:w-auto"
          severity="secondary"
          @click="closePassiveMiningDialog()"
        />
        <Button
          :label="t('yes_enable')"
          class="w-full sm:w-auto"
          @click="enablePassiveMining()"
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

const { t } = useI18n({
  useScope: 'local',
});

watch(
  () => $leadminerStore.passiveMiningDialog,
  (newVal) => {
    if (newVal) {
      miningSource.value = $leadminerStore.activeMiningSource;
    }
  },
);

function closePassiveMiningDialog() {
  $leadminerStore.passiveMiningDialog = false;
}

async function enablePassiveMining() {
  if (miningSource.value) {
    const { error } = await $supabase
      // @ts-expect-error: Issue with nuxt/supabase
      .schema('private')
      .from('mining_sources')
      .update({ passive_mining: true })
      .match({ email: miningSource.value.email });

    if (error) {
      throw error;
    }
  }
  closePassiveMiningDialog();
}
</script>

<i18n lang="json">
{
  "en": {
    "header": "Continuous Contact Extraction",
    "paragraph_1": "New contacts found in incoming emails will be automatically saved.",
    "paragraph_2": "Enable continuous contact extraction from future emails?",
    "yes_enable": "Yes, enable"
  },
  "fr": {
    "header": "Extraction continue des contacts",
    "paragraph_1": "Les nouveaux contacts trouvés dans les e-mails entrants seront automatiquement enregistrés.",
    "paragraph_2": "Activer l'extraction continue des contacts à partir des futurs e-mails ?",

    "yes_enable": "Oui, activer"
  }
}
</i18n>
