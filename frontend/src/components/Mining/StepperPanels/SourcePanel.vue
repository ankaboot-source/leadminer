<template>
  <template v-if="!showOtherSources">
    <div class="flex flex-col items-center gap-12 p-8">
      <div class="flex flex-col items-center gap-6 w-full max-w-lg">
        <h2 class="text-xl">{{ t('title') }}</h2>

        <Select
          v-model="sourceModel"
          :options="sourceOptions"
          class="w-full"
          option-label="email"
          :placeholder="t('email_address')"
          :pt="{
            trigger: { class: 'text-indigo-500' },
            input: { class: 'text-indigo-500' },
            root: { class: 'border-[#bcbdf9]' },
          }"
        >
          <template #value="{ value }">
            <div class="flex items-center space-x-2">
              <i
                :class="getIcon(value?.type)"
                class="text-secondary text-sm"
              ></i>
              <span>{{ value?.email }}</span>
            </div>
          </template>

          <template #option="{ option }">
            <div class="flex items-center space-x-2">
              <i
                :class="getIcon(option.type)"
                class="text-secondary text-sm"
              ></i>
              <span>{{ option.email }}</span>
            </div>
          </template>
        </Select>
      </div>

      <div class="flex flex-col min-[1129px]:flex-row gap-2 w-full max-w-lg">
        <Button
          id="mine-source"
          class="w-full"
          :disabled="!sourceModel"
          :label="t('mine_new_source')"
          outlined
          @click="showOtherSources = true"
        />
        <Button
          id="extract-source"
          class="w-full"
          severity="contrast"
          :disabled="!sourceModel"
          :label="t('extract_contacts')"
          @click="extractContacts"
        />
      </div>
    </div>
  </template>

  <template v-else>
    <div class="flex flex-col items-center gap-12 p-8">
      <div
        class="flex flex-col items-center justify-center gap-6 w-full max-w-4xl"
      >
        <h2 class="text-xl">{{ t('title') }}</h2>
        <div class="flex flex-col min-[1129px]:flex-row flex-wrap gap-2">
          <oauth-source icon="pi pi-google" label="Google" source="google" />
          <oauth-source
            icon="pi pi-microsoft"
            :label="t('microsoft_or_outlook')"
            source="azure"
          />
          <imap-source
            v-model:source="sourceModel"
            v-model:show="$imapDialogStore.showImapDialog"
          />
          <Button
            id="import-file"
            icon="pi pi-upload"
            :label="t('import_csv_excel')"
            outlined
            @click="importFileDialogRef.openModal()"
          />
          <importFileDialog ref="importFileDialogRef" />
        </div>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import ImapSource from '@/components/Mining/AddSourceImap.vue';
import OauthSource from '@/components/Mining/AddSourceOauth.vue';
import { FetchError } from 'ofetch';
import type { MiningSource } from '~/types/mining';
import importFileDialog from '../ImportFileDialog.vue';

const importFileDialogRef = ref();
const { t } = useI18n({
  useScope: 'local',
});

const $stepper = useMiningStepper();
const $leadminerStore = useLeadminerStore();

const $imapDialogStore = useImapDialog();
const sourceModel = ref<MiningSource | undefined>();
const sourceOptions = computed(() => useLeadminerStore().miningSources);
const showOtherSources = ref(false);
const { source } = useRoute().query;

function onSourceChange(miningSource: MiningSource) {
  $leadminerStore.boxes = [];
  $leadminerStore.selectedBoxes = [];
  $leadminerStore.activeMiningSource = miningSource;
  $stepper.next();
}
function extractContacts() {
  if (sourceModel.value) {
    onSourceChange(sourceModel.value);
  }
}

function getIcon(type: string) {
  switch (type) {
    case 'google':
      return 'pi pi-google';
    case 'azure':
      return 'pi pi-microsoft';
    default:
      return 'pi pi-inbox';
  }
}

async function fetchMiningSourcesAndHandleSource() {
  await $leadminerStore.fetchMiningSources();

  const selectedSource = source
    ? $leadminerStore.getMiningSourceByEmail(source as string)
    : null;

  if (selectedSource) {
    const newQuery = { ...useRoute().query };
    delete newQuery.source;
    useRouter().replace({ query: newQuery });
    onSourceChange(selectedSource);
  } else {
    sourceModel.value = sourceOptions?.value[0];
  }
}

onMounted(async () => {
  try {
    await fetchMiningSourcesAndHandleSource();
  } catch (error) {
    throw error instanceof FetchError && error.response?.status === 401
      ? error
      : new Error(t('fetch_sources_failed'));
  }

  if (sourceOptions.value.length === 0) {
    showOtherSources.value = true;
  }

  watch(sourceModel, (miningSource) => {
    // Watch for changes in `sourceModel` after the initial source selection.
    // This will trigger `onSourceChange` for buttons Google, Azure, or IMAP.
    if (miningSource) {
      onSourceChange(miningSource);
    }
  });
});

defineExpose({
  onSourceChange,
});
</script>

<i18n lang="json">
{
  "en": {
    "title": "Mine contacts from",
    "mine_existing_source": "Mine from existing source",
    "mine_new_source": "Mine from another source",
    "fetch_sources_failed": "Failed to fetch mining sources",
    "email_address": "email address",
    "extract_contacts": "Extract contacts",
    "microsoft_or_outlook": "Microsoft or Outlook",
    "import_csv_excel": "Import CSV or Excel"
  },
  "fr": {
    "title": "Extraire des contacts depuis",
    "mine_existing_source": "Extraire depuis une source existante",
    "mine_new_source": "Extraire depuis une autre source",
    "fetch_sources_failed": "Échec de la récupération des sources de minage",
    "email_address": "adresse e-mail",
    "extract_contacts": "Extraire les contacts",
    "microsoft_or_outlook": "Microsoft ou Outlook",
    "import_csv_excel": "Importer CSV ou Excel"
  }
}
</i18n>
