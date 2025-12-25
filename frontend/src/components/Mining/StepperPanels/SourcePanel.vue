<template>
  <div class="flex flex-col grow items-center justify-evenly h-2/3 text-center">
    <template v-if="!$sourcePanelStore.showsOtherSources">
      <div class="text-3xl">{{ t('title_add_existing') }}</div>
      <Select
        v-model="sourceModel"
        :options="sourceOptions"
        class="w-full max-w-xl"
        option-label="email"
        :placeholder="t('email_address')"
        :pt="{
          trigger: { class: 'text-indigo-500' },
          input: { class: 'text-indigo-500' },
          root: { class: 'border-[#bcbdf9]' },
        }"
        @change="extractContacts(sourceModel)"
      >
        <template #value="{ value }">
          <div class="flex items-center space-x-2">
            <i :class="getIcon(value?.type)" class="text-secondary text-sm"></i>
            <span>{{ value?.email }}</span>
          </div>
        </template>

        <template #option="{ option }">
          <div class="flex items-center space-x-2">
            <i :class="getIcon(option.type)" class="text-secondary text-sm"></i>
            <span>{{ option.email }}</span>
          </div>
        </template>
      </Select>

      <div class="flex flex-col md:flex-row gap-2 w-full max-w-xl">
        <Button
          id="mine-source"
          class="w-full"
          :label="t('mine_new_source')"
          outlined
          @click="$sourcePanelStore.showOtherSources()"
        />
        <Button
          id="extract-source"
          class="w-full"
          severity="contrast"
          :disabled="!sourceModel"
          :label="t('extract_contacts')"
          @click="extractContacts(sourceModel)"
        />
      </div>
    </template>

    <template v-else-if="!isUploadingPST">
      <div class="text-3xl">{{ t('title_add_new') }}</div>

      <div class="flex flex-col lg:flex-row flex-wrap gap-2">
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

        <FileUpload
          class="p-button-outlined"
          mode="basic"
          accept=".pst,.ost"
          :max-file-size="PST_FILE_SIZE_LIMIT"
          :choose-label="t('choose_pst_file')"
          choose-icon="pi pi-upload"
          custom-upload
          auto
          @uploader="uploadPSTAndMine"
        />
      </div>
    </template>

    <template v-else>
      <div class="text-3xl">
        {{ t('uploading_file', uploadProgress) }}
      </div>
      <ProgressBar class="w-full" :value="uploadProgress" />
    </template>
  </div>
</template>

<script setup lang="ts">
import ImapSource from '@/components/Mining/AddSourceImap.vue';
import OauthSource from '@/components/Mining/AddSourceOauth.vue';
import type { FileUploadUploaderEvent } from 'primevue/fileupload';
import type { MiningSource } from '~/types/mining';
import importFileDialog from '../ImportFileDialog.vue';

const importFileDialogRef = ref();
const { t } = useI18n({
  useScope: 'local',
});
const $toast = useToast();
const $supabase = useSupabaseClient();

const $stepper = useMiningStepper();
const $leadminerStore = useLeadminerStore();
const $imapDialogStore = useImapDialog();
const $sourcePanelStore = useStepperSourcePanel();
const sourceOptions = computed(() => useLeadminerStore().miningSources);
const sourceModel = ref<MiningSource | undefined>(sourceOptions?.value[0]);

function extractContacts(miningSource?: MiningSource) {
  if (miningSource) {
    $leadminerStore.boxes = [];
    $leadminerStore.selectedBoxes = [];
    $leadminerStore.activeMiningSource = miningSource;
    $stepper.next();
  }
}

$sourcePanelStore.showOtherSourcesByDefault();

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

const isUploadingPST = ref(false);
const uploadProgress = ref(0);
const PST_FILE_SIZE_LIMIT = 5368709120; // 5 GB

async function uploadPSTAndMine($event: FileUploadUploaderEvent) {
  const file = ($event.files as File[])[0];
  if (!file) return;

  const user = useSupabaseUser().value;
  if (!user) return;

  const filePath = `${user.sub}/${file.name}`;
  uploadProgress.value = 0;
  isUploadingPST.value = true;

  try {
    const { data, error } = await $supabase.storage
      .from('pst')
      .createSignedUploadUrl(filePath);
    if (error || !data?.signedUrl)
      throw error || new Error('Could not create signed URL');

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', data.signedUrl, true);
      if (data.token) xhr.setRequestHeader('x-signature', data.token);
      xhr.setRequestHeader(
        'Content-Type',
        file.type || 'application/octet-stream',
      );
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable)
          uploadProgress.value = Math.round((e.loaded / e.total) * 100);
      };
      xhr.onload = () =>
        xhr.status === 200 || xhr.status === 201
          ? resolve()
          : reject(new Error(xhr.responseText || `Status ${xhr.status}`));
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(file);
    });

    $stepper.next();
    $leadminerStore.startMining('pst', filePath);
  } catch (err: any) {
    const msg = err?.message || String(err);
    $toast.add({
      severity: msg.includes('already exists') ? 'info' : 'error',
      summary: t('upload'),
      detail: msg,
      life: 5000,
    });
  } finally {
    isUploadingPST.value = false;
    uploadProgress.value = 0;
  }
}
</script>

<i18n lang="json">
{
  "en": {
    "title_add_new": "Choose your mining source",
    "title_add_existing": "Mine from",
    "mine_new_source": "Mine from another source",
    "fetch_sources_failed": "Failed to fetch mining sources",
    "email_address": "email address",
    "extract_contacts": "Extract contacts",
    "microsoft_or_outlook": "Microsoft or Outlook",
    "import_csv_excel": "Import CSV or Excel",
    "choose_pst_file": "Import PST or OST File",
    "uploading_file": "Uploading file... {n}%",
    "upload": "Upload",
    "upload_exists": "The PST file already exists."
  },
  "fr": {
    "title_add_new": "Extraire des contacts depuis",
    "title_add_existing": "Extraire depuis",
    "mine_new_source": "Extraire depuis une autre source",
    "fetch_sources_failed": "Échec de la récupération des sources de minage",
    "email_address": "adresse e-mail",
    "extract_contacts": "Extraire les contacts",
    "microsoft_or_outlook": "Microsoft ou Outlook",
    "import_csv_excel": "Importer CSV ou Excel",
    "choose_pst_file": "Importer PST ou OST",
    "uploading_file": "Téléversement... {n}%",
    "upload": "Téléversement",
    "upload_exists": "Le fichier PST existe déjà."
  }
}
</i18n>
