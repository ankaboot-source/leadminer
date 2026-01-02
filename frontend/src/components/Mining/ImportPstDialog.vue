<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="t('choose_pst_file')"
    :closable="!isUploadingPST"
    :dismissable-mask="!isUploadingPST"
    :close-on-escape="!isUploadingPST"
    pt:content:class="grow p-3 pt-0 "
    :draggable="false"
    :maximizable="$screenStore?.size?.md"
    :pt:root:class="{ 'p-dialog-maximized': !$screenStore?.size?.md }"
    :style="{ width: '60vw', height: '70vh' }"
  >
    <FileUpload
      ref="fileUpload"
      pt:root:class="h-full"
      pt:content:class="h-full w-full"
      pt:header:class="hidden"
      :accept="ACCEPTED_FILES"
      :max-file-size="PST_FILE_SIZE_LIMIT"
      :choose-label="t('choose_pst_file')"
      custom-upload
      auto
      :progress="uploadProgress"
      @uploader="uploadPST"
    >
      <template #content>
        <div
          v-if="uploadProgress"
          class="flex flex-col h-full w-full items-center justify-center gap-3"
        >
          {{ t('uploading_file', uploadProgress) }}
          {{ fileName }}

          <ProgressBar
            :value="uploadProgress"
            :show-value="false"
            :mode="uploadProgress === 100 ? 'indeterminate' : 'determinate'"
            class="w-full h-3"
          />

          <Button
            class="mt-4"
            label="Cancel"
            outlined
            @click="pstUploadXhr!.abort()"
          />
        </div>
        <div
          v-else
          class="flex flex-col h-full w-full items-center justify-center gap-3"
        >
          <i
            class="pi pi-cloud-upload !border-2 !rounded-full !p-8 !text-4xl !text-muted-color"
          />
          <p>{{ $t('upload.drag_and_drop') }}</p>

          <Button
            id="import-pst"
            v-tooltip.bottom="t('upload_tooltip', PST_FILE_SIZE_LIMIT_GB)"
            class="my-1"
            icon="pi pi-upload"
            :label="$t('upload.select_file_label')"
            :loading="isUploadingPST"
            @click="fileUpload.choose()"
          >
            <template #icon>
              <img src="/icons/pst.svg" alt="PST Icon" class="w-6 h-6" />
            </template>
          </Button>
          <a
            class="link"
            target="_blank"
            rel="noopener noreferrer"
            :href="learnExportLink"
          >
            {{ t('learn_export') }}
          </a>
        </div>
      </template>
    </FileUpload>
  </Dialog>
</template>

<script setup lang="ts">
import type { FileUploadUploaderEvent } from 'primevue/fileupload';

const ACCEPTED_FILES = '.pst,.ost';
const PST_FILE_SIZE_LIMIT = 5368709120; // 5 GB
const PST_FILE_SIZE_LIMIT_GB = PST_FILE_SIZE_LIMIT / (1024 * 1024 * 1024);

const { t } = useI18n({
  useScope: 'local',
});

const fileUpload = ref();

const visible = ref(false);
const openModal = () => {
  visible.value = true;
};
defineExpose({ openModal });

const $stepper = useMiningStepper();
const $leadminerStore = useLeadminerStore();
const $supabase = useSupabaseClient();
const $screenStore = useScreenStore();
const $toast = useToast();

const learnExportLink = computed(
  () =>
    `https://support.microsoft.com/${$leadminerStore.language}/office/14252b52-3075-4e9b-be4e-ff9ef1068f91`,
);

const fileName = ref('');
const isUploadingPST = ref(false);
const sourceIsPst = ref(false);
const uploadProgress = ref(0);
const pstUploadXhr = ref<XMLHttpRequest | null>(null);

function resetPst() {
  fileName.value = '';
  $leadminerStore.pstFilePath = '';
  uploadProgress.value = 0;
  isUploadingPST.value = false;
  pstUploadXhr.value = null;
  fileUpload.value?.clear();
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
    $leadminerStore.pstFilePath = `${useSupabaseUser()?.value?.sub}/${fileName.value}`;

    const { data, error } = await $supabase.storage
      .from('pst')
      .createSignedUploadUrl($leadminerStore.pstFilePath);

    const uploadAlreadyExists = error?.message.includes('already exists');

    if (error && !uploadAlreadyExists) throw error;

    if (data?.signedUrl) {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        pstUploadXhr.value = xhr;
        xhr.open('PUT', data.signedUrl, true);
        if (data.token) xhr.setRequestHeader('x-signature', data.token);
        xhr.setRequestHeader(
          'Content-Type',
          file.type || 'application/octet-stream',
        );
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable)
            uploadProgress.value = Math.floor((e.loaded / e.total) * 100);
        };

        xhr.onload = () =>
          xhr.status === 200 || xhr.status === 201
            ? resolve()
            : reject(new Error(xhr.responseText || `Status ${xhr.status}`));
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.onabort = () => reject(new Error('Upload canceled'));
        xhr.send(file);
      });
    }

    $toast.add({
      severity: uploadAlreadyExists ? 'info' : 'success',
      summary: $t('upload.upload'),
      detail: uploadAlreadyExists ? t('upload_exists') : t('upload_success'),
      life: 5000,
    });
    $stepper.next();
    $leadminerStore.miningType = 'pst';

    isUploadingPST.value = false;
    visible.value = false;
  } catch (error) {
    resetPst();
    if (error instanceof Error && error.message === 'Upload canceled') return;
    console.error('PST Upload Error:', error);
    $toast.add({
      severity: 'error',
      summary: $t('upload.upload'),
      detail: t('upload_failed'),
      life: 5000,
    });
  }
}
</script>

<i18n lang="json">
{
  "en": {
    "learn_export": "Learn how to export your emails from Outlook",
    "uploading_file": "Uploading file... {n}%",
    "upload_tooltip": ".pst or .ost file max {n}GB",
    "upload_exists": "The PST file already exists.",
    "upload_success": "The file has been uploaded successfully.",
    "upload_failed": "Upload failed.",
    "choose_pst_file": "Import Outlook Data File (PST or OST)"
  },
  "fr": {
    "learn_export": "Apprenez comment à exporter vos emails depuis Outlook",
    "uploading_file": "Téléversement... {n}%",
    "upload_tooltip": "Fichier .pst ou .ost max {n} Go",
    "upload_exists": "Le fichier PST existe déjà.",
    "upload_success": "Le fichier a été téléversé avec succès.",
    "upload_failed": "Échec du téléversement.",
    "choose_pst_file": "Importer un fichier de données Outlook (PST ou OST)"
  }
}
</i18n>
