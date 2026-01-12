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
            :label="$t('common.cancel')"
            outlined
            @click="cancelUpload()"
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
import { Upload } from 'tus-js-client';

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
const pstTusUpload = ref<Upload | null>(null);

function cancelUpload() {
  if (pstTusUpload.value) {
    pstTusUpload.value.abort();
    pstTusUpload.value = null;
  }

  fileName.value = '';
  $leadminerStore.pstFilePath = '';
  uploadProgress.value = 0;
  isUploadingPST.value = false;
  fileUpload.value?.clear();
}
function prepareMining() {
  $stepper.next();
  $leadminerStore.miningType = 'pst';
  visible.value = false;
}
const SAAS_SUPABASE_PROJECT_URL =
  useRuntimeConfig().public.SAAS_SUPABASE_PROJECT_URL?.toString();
const SUPABASE_UPLOAD_URL = `${SAAS_SUPABASE_PROJECT_URL}/storage/v1/upload/resumable`;

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
    $leadminerStore.pstFilePath = `${user.sub}/${file.name}`;
    const {
      data: { session },
    } = await $supabase.auth.getSession();

    await new Promise<void>((resolve, reject) => {
      pstTusUpload.value = new Upload(file, {
        endpoint: SUPABASE_UPLOAD_URL,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        metadata: {
          bucketName: 'pst',
          objectName: $leadminerStore.pstFilePath,
          contentType: file.type || 'application/octet-stream',
        },
        headers: {
          authorization: `Bearer ${session?.access_token}`,
        },
        chunkSize: 6 * 1024 * 1024,
        onProgress: (uploadedBytes, totalBytes) => {
          uploadProgress.value = Math.floor((uploadedBytes / totalBytes) * 100);
        },
        onSuccess: () => resolve(),
        onError: (error) => reject(error),
        onShouldRetry: (error) => {
          return !error.message.includes('The resource already exists'); // Do not retry if file already exists
        },
      });

      pstTusUpload.value.findPreviousUploads().then((previousUploads) => {
        // Found previous uploads so we select the first one.
        if (previousUploads?.[0]) {
          pstTusUpload.value?.resumeFromPreviousUpload(previousUploads[0]);
        }
        // Start the upload
        pstTusUpload.value?.start();
      });
    });

    $toast.add({
      severity: 'success',
      summary: $t('upload.upload'),
      detail: t('upload_success',{ file_name: fileName.value }),
      life: 5000,
    });

    prepareMining();
  } catch (error) {
    if (error instanceof Error && error.message?.includes('already exists')) {
      $toast.add({
        severity: 'info',
        summary: $t('upload.upload'),
        detail: t('upload_exists'),
        life: 5000,
      });

      prepareMining();
      return;
    }

    console.error('PST Upload Error:', error);
    cancelUpload();

    $toast.add({
      severity: 'error',
      summary: $t('upload.upload'),
      detail: t('upload_failed'),
      life: 5000,
    });
  } finally {
    isUploadingPST.value = false;
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
    "upload_success": "'{file_name}' has been uploaded successfully.",
    "upload_failed": "Upload failed.",
    "choose_pst_file": "Import Outlook Data File (PST or OST)"
  },
  "fr": {
    "learn_export": "Apprenez comment à exporter vos emails depuis Outlook",
    "uploading_file": "Téléversement... {n}%",
    "upload_tooltip": "Fichier .pst ou .ost max {n} Go",
    "upload_exists": "Le fichier PST existe déjà.",
    "upload_success": "« {file_name} » a été téléversé avec succès.",
    "upload_failed": "Échec du téléversement.",
    "choose_pst_file": "Importer un fichier de données Outlook (PST ou OST)"
  }
}
</i18n>
