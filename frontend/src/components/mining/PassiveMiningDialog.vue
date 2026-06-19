<template>
  <Dialog
    v-model:visible="$leadminerStore.passiveMiningDialog"
    modal
    :header="t('header')"
    class="w-full sm:w-[35rem]"
  >
    <div class="flex flex-col gap-4">
      <p>
        {{ t('paragraph_1') }} <br />
        {{ t('paragraph_2') }}
      </p>

      <div class="flex flex-col gap-3 pt-2 border-t border-surface-200">
        <div v-if="isGoogleSource" class="flex items-center gap-2">
          <ToggleSwitch
            v-model="sourceConfig.google_contacts_sync"
            input-id="googleContactsSync"
          />
          <label for="googleContactsSync" class="cursor-pointer">
            {{ t('sync_google_contacts') }}
          </label>
        </div>

        <div class="flex items-center gap-2">
          <ToggleSwitch
            v-model="sourceConfig.cleaning_enabled"
            input-id="cleaningEnabled"
          />
          <label for="cleaningEnabled" class="cursor-pointer">
            {{ t('clean_contacts') }}
          </label>
        </div>

        <div class="flex items-center gap-2">
          <ToggleSwitch
            v-model="sourceConfig.extract_signatures"
            input-id="extractSignatures"
          />
          <label for="extractSignatures" class="cursor-pointer">
            {{ t('extract_signatures') }}
          </label>
        </div>
      </div>
    </div>

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
import { useToast } from 'primevue/usetoast';
import type { MiningSource } from '~/types/mining';

const miningSource = ref<MiningSource>();
const sourceConfig = ref<Record<string, boolean>>({
  google_contacts_sync: true,
  cleaning_enabled: true,
  extract_signatures: false,
});

const $leadminerStore = useLeadminerStore();
const $supabase = useSupabaseClient();
const $toast = useToast();

const { t } = useI18n({
  useScope: 'local',
});

const isGoogleSource = computed(() => miningSource.value?.type === 'google');

watch(
  () => $leadminerStore.passiveMiningDialog,
  (newVal) => {
    if (newVal) {
      miningSource.value = $leadminerStore.activeMiningSource;
      sourceConfig.value = {
        google_contacts_sync: true,
        cleaning_enabled: true,
        extract_signatures: false,
        ...(($leadminerStore.activeMiningSource?.config ?? {}) as Record<
          string,
          boolean
        >),
      };
    }
  },
);

function closePassiveMiningDialog() {
  $leadminerStore.passiveMiningDialog = false;
}

async function enablePassiveMining() {
  if (!miningSource.value) return;
  try {
    const { error } = await $supabase
      // @ts-expect-error: Issue with nuxt/supabase
      .schema('private')
      .from('mining_sources')
      .update({
        passive_mining: true,
        config: sourceConfig.value,
      })
      .match({ email: miningSource.value.email });

    if (error) throw error;
    closePassiveMiningDialog();
  } catch (error) {
    const message =
      (error as { message?: string }).message ||
      'Failed to enable continuous mining';
    $toast.add({
      severity: 'error',
      summary: 'Error',
      detail: message,
      life: 5000,
    });
  }
}
</script>

<i18n lang="json">
{
  "en": {
    "header": "Continuous Contact Extraction",
    "paragraph_1": "New contacts found in incoming emails will be automatically saved.",
    "paragraph_2": "Enable continuous contact extraction from future emails?",
    "sync_google_contacts": "Sync Google Contacts",
    "clean_contacts": "Clean contacts (email verification)",
    "extract_signatures": "Extract signatures",
    "yes_enable": "Yes, enable"
  },
  "fr": {
    "header": "Extraction continue des contacts",
    "paragraph_1": "Les nouveaux contacts trouvés dans les e-mails entrants seront automatiquement enregistrés.",
    "paragraph_2": "Activer l'extraction continue des contacts à partir des futurs e-mails ?",
    "sync_google_contacts": "Synchroniser les contacts Google",
    "clean_contacts": "Nettoyer les contacts (vérification e-mail)",
    "extract_signatures": "Extraire les signatures",
    "yes_enable": "Oui, activer"
  }
}
</i18n>
