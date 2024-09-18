<template>
  <div class="flex flex-col min-[1129px]:flex-row gap-2">
    <div
      v-if="sourceOptions.length"
      class="w-full min-[1129px]:w-1/2 flex flex-col gap-3"
    >
      <p>{{ t('pick_existing_email') }}</p>
      <div class="flex flex-col min-[1129px]:flex-row gap-2">
        <Select
          v-model="sourceModel"
          :options="sourceOptions"
          class="flex-grow min-w-0"
          option-label="email"
          :placeholder="t('email_address')"
          :pt="{
            trigger: {
              class: 'text-indigo-500 ',
            },
            input: {
              class: 'text-indigo-500 ',
            },
            root: {
              class: 'border-[#bcbdf9] ',
            },
          }"
          @change="extractContacts()"
        />
        <Button
          id="extract-source"
          :disabled="!sourceModel"
          severity="contrast"
          class="font-semibold whitespace-nowrap flex-shrink-0"
          :label="t('extract_contacts')"
          @click="extractContacts()"
        />
      </div>
    </div>
    <div v-if="sourceOptions.length">
      <Separator
        layout="vertical"
        :content="$t('common.or')"
        class="hidden min-[1129px]:flex"
      />
      <Separator
        layout="horizontal"
        :content="$t('common.or')"
        class="flex min-[1129px]:hidden"
      />
    </div>
    <div class="shrink-0 flex flex-col gap-3">
      <span>{{ t('add_new_email_provider') }}</span>
      <div class="flex flex-col min-[1129px]:flex-row gap-2 flex-wrap">
        <oauth-source icon="pi pi-google" label="Google" source="google" />
        <oauth-source
          icon="pi pi-microsoft"
          label="Microsoft or Outlook"
          source="azure"
        />
        <imap-source
          v-model:source="sourceModel"
          v-model:show="$imapDialogStore.showImapDialog"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ImapSource from '@/components/Mining/AddSourceImap.vue';
import OauthSource from '@/components/Mining/AddSourceOauth.vue';
import { FetchError } from 'ofetch';
import type { MiningSource, MiningSourceType } from '~/types/mining';

const { t } = useI18n({
  useScope: 'local',
});

const $stepper = useMiningStepper();
const $leadminerStore = useLeadminerStore();

const $imapDialogStore = useImapDialog();
const sourceModel = ref<MiningSource | undefined>();
const sourceOptions = computed(() => useLeadminerStore().miningSources);

function extractContacts() {
  if (sourceModel.value) {
    onSourceChange(sourceModel.value);
  }
}
function onSourceChange(source: MiningSource) {
  $leadminerStore.boxes = [];
  $leadminerStore.selectedBoxes = [];
  $leadminerStore.activeMiningSource = source;
  $stepper.next();
}

function selectSource(source: MiningSourceType | string) {
  switch (source) {
    case 'imap':
      $imapDialogStore.showImapDialog = true;
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

onMounted(async () => {
  try {
    await $leadminerStore.fetchMiningSources();
    sourceModel.value = sourceOptions?.value[0];
  } catch (error) {
    if (error instanceof FetchError && error.response?.status === 401) {
      throw error;
    } else {
      throw new Error(t('fetch_sources_failed'));
    }
  }
});

defineExpose({
  selectSource,
});
</script>

<i18n lang="json">
{
  "en": {
    "pick_existing_email": "Pick an existing email address to mine",
    "add_new_email_provider": "Add a new email provider",
    "fetch_sources_failed": "Failed to fetch mining sources",
    "email_address": "email address",
    "extract_contacts": "Extract contacts"
  },
  "fr": {
    "pick_existing_email": "Choisissez une adresse e-mail existante pour l’extraction",
    "add_new_email_provider": "Ajouter un nouveau compte e-mail",
    "fetch_sources_failed": "Échec de la récupération des sources de minage",
    "email_address": "adresse e-mail",
    "extract_contacts": "Extraire les contacts"
  }
}
</i18n>
