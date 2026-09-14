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
            v-model="draftConfig.google_contacts_sync"
            input-id="googleContactsSync"
          />
          <label for="googleContactsSync" class="cursor-pointer">
            {{ t('sync_google_contacts') }}
          </label>
        </div>

        <div class="flex items-center gap-2">
          <ToggleSwitch
            v-model="draftConfig.cleaning_enabled"
            input-id="cleaningEnabled"
          />
          <label for="cleaningEnabled" class="cursor-pointer">
            {{ t('clean_contacts') }}
          </label>
        </div>

        <div class="flex items-center gap-2">
          <ToggleSwitch
            v-model="draftConfig.extract_signatures"
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
import { deriveSourceConfig } from '~/utils/miningSourceConfig';
import { updatePassiveMining } from '~/utils/sources';

const $leadminerStore = useLeadminerStore();

const miningSource = ref<MiningSource>();
const draftConfig = ref<Record<string, boolean>>({
  google_contacts_sync: false,
  cleaning_enabled: true,
  extract_signatures: false,
});
const $toast = useToast();

const { t } = useI18n({
  useScope: 'local',
});

const isGoogleSource = computed(() => miningSource.value?.type === 'google');

watch(
  () => $leadminerStore.passiveMiningDialog,
  (newVal, oldVal) => {
    if (newVal && !oldVal) {
      miningSource.value = $leadminerStore.activeMiningSource;
      const flags = deriveSourceConfig(
        $leadminerStore.activeMiningSource?.config,
      );
      draftConfig.value = { ...flags };
    }
  },
);

function closePassiveMiningDialog() {
  $leadminerStore.passiveMiningDialog = false;
}

async function enablePassiveMining() {
  if (!miningSource.value) return;
  try {
    // Persist the chosen flags + the currently selected folders under the typed
    // config shape (read-merge-write so unrelated keys/watermarks survive), and
    // flip the toggle. The new health.state 'active' clears any stale
    // needs_reauth/error from a previous run.
    await updatePassiveMining(
      miningSource.value.email,
      miningSource.value.type,
      true,
      {
        flags: { ...draftConfig.value },
        folders: $leadminerStore.selectedBoxes
          ? Object.keys($leadminerStore.selectedBoxes).filter(
              (key) =>
                $leadminerStore.selectedBoxes[key]?.checked &&
                !$leadminerStore.excludedBoxes?.has(key) &&
                key !== '',
            )
          : undefined,
      },
    );

    // reflect the new config in the store immediately, using the draft the
    // user actually chose (the active source object wasn't re-fetched).
    $leadminerStore.sourceConfig = deriveSourceConfig({
      ...($leadminerStore.activeMiningSource?.config ?? {}),
      flags: { ...(draftConfig.value as Record<string, boolean>) },
    });
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
