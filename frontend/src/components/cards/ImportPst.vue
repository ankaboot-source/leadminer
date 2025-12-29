<template>
  <Dialog
    v-model:visible="visible"
    modal
    header="Import Outlook Data File (PST or OST)"
    :closable="!isUploadingPST"
    :dismissable-mask="!isUploadingPST"
    :close-on-escape="!isUploadingPST"
  >
    <a class="link" :href="learnExportLink">{{ t('learn_export') }}</a>

    <FileUpload
      ref="fileUpload"
      class="p-button-outlined"
      :accept="ACCEPTED_FILES"
      :max-file-size="PST_FILE_SIZE_LIMIT"
      :choose-label="t('choose_pst_file')"
      custom-upload
      auto
      :show-cancel-button="!isUploadingPST"
      :show-upload-button="false"
      :progress="uploadProgress"
      @uploader="uploadPST"
    >
      <template #header>{{ null }}</template>
      <template #chooseicon>
        <img src="/icons/pst.svg" alt="PST Icon" class="w-6 h-6" />
      </template>
      <template #empty>
        <div class="flex flex-col items-center justify-center gap-3 m-auto">
          <i
            class="pi pi-cloud-upload !border-2 !rounded-full !p-8 !text-4xl !text-muted-color"
          />
          <p>{{ t('drag_and_drop') }}</p>
          <div class="flex flex-col items-center">
            <Button
              id="import-pst"
              v-tooltip.bottom="t('upload_tooltip', { PST_FILE_SIZE_LIMIT })"
              class="my-1"
              icon="pi pi-upload"
              outlined
              :label="t('select_file_label')"
              :loading="isUploadingPST"
              @click="fileUpload.choose()"
            >
              <template #icon>
                <img src="/icons/pst.svg" alt="PST Icon" class="w-6 h-6" />
              </template>
            </Button>
          </div>
        </div>
      </template>
      <template #content>
        <div v-if="uploadProgress > 0" class="w-full mt-3">
          <div>
            {{ t('uploading_file', uploadProgress) }}
            {{ fileName }}
          </div>
          <ProgressBar :value="uploadProgress" style="height: 12px" />
        </div>
        <template v-else> {{ null }}</template>
      </template>
    </FileUpload>
  </Dialog>
</template>

<script setup lang="ts">
import type { FileUploadUploaderEvent } from 'primevue/fileupload';

const { t } = useI18n({
  useScope: 'local',
});
const fileUpload = ref();

const visible = ref(true);
const ACCEPTED_FILES = '.pst,.ost';

const openModal = () => {
  visible.value = true;
};
defineExpose({ openModal });

const $leadminer = useLeadminerStore();
const $supabase = useSupabaseClient();
const learnExportLink = computed(
  () =>
    `https://support.microsoft.com/${$leadminer.language}/office/14252b52-3075-4e9b-be4e-ff9ef1068f91`,
);

const isUploadingPST = ref(false);
const sourceIsPst = ref(false);
const fileName = ref('');
const pstFilePath = computed(
  () => `${useSupabaseUser()?.value?.sub}/${fileName.value}`,
);
const $toast = useToast();
const uploadProgress = ref(0);
const PST_FILE_SIZE_LIMIT = 5368709120; // 5 GB

function resetPst() {
  fileName.value = '';
  uploadProgress.value = 0;
  isUploadingPST.value = false;
}

async function uploadPST($event: FileUploadUploaderEvent) {
  sourceIsPst.value = true;
  const file = ($event.files as File[])[0];
  if (!file) return;

  const user = useSupabaseUser().value;
  if (!user) return;

  fileName.value = file.name;
  uploadProgress.value = 0;
  isUploadingPST.value = true;

  try {
    const { data, error } = await $supabase.storage
      .from('pst')
      .createSignedUploadUrl(pstFilePath.value);

    const uploadAlreadyExists = error?.message.includes('already exists');

    if (error && !uploadAlreadyExists) throw error;

    if (data?.signedUrl) {
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
    }

    $toast.add({
      severity: uploadAlreadyExists ? 'info' : 'success',
      summary: t('upload'),
      detail: uploadAlreadyExists ? t('upload_exists') : t('upload_success'),
      life: 5000,
    });
    isUploadingPST.value = false;
    visible.value = false;
  } catch (error) {
    console.error('PST Upload Error:', error);
    $toast.add({
      severity: 'error',
      summary: t('upload'),
      detail: t('upload_failed'),
      life: 5000,
    });
    resetPst();
  }
}
</script>

<i18n lang="json">
{
  "en": {
    "learn_export": "Learn how to export a file from Outlook Desktop",
    "uploading_file": "Uploading file... {n}%",
    "drag_and_drop": "Drag and drop files here.",
    "select_file_label": "Upload your file",
    "upload_tooltip": ".pst or .ost file max {maxSizeInMB}MB",
    "upload": "Upload",
    "upload_exists": "The PST file already exists.",
    "upload_success": "The file has been uploaded successfully.",
    "upload_failed": "Upload failed."
  },
  "fr": {
    "learn_export": "Apprenez comment à exporter un fichier depuis Outlook Desktop",
    "uploading_file": "Téléversement... {n}%",
    "drag_and_drop": "Faites glisser et déposez les fichiers ici pour les télécharger.",
    "select_file_label": "Téléchargez votre fichier",
    "upload_tooltip": "Fichier .pst ou .ost max {maxSizeInMB} Mo",
    "upload": "Téléversement",
    "upload_exists": "Le fichier PST existe déjà.",
    "upload_success": "Le fichier a été téléversé avec succès.",
    "upload_failed": "Échec du téléversement."
  }
}
</i18n>
