<template>
  <Dialog
    ref="dialog"
    v-model:visible="visible"
    modal
    :header="t('import_csv_excel')"
    pt:content:class="grow p-3 border-y border-slate-200"
    pt:footer:class="p-3"
    :draggable="false"
    :maximizable="$screenStore?.size?.md"
    :pt:root:class="{ 'p-dialog-maximized': !$screenStore?.size?.md }"
    :style="{ width: '60vw', height: '70vh' }"
  >
    <FileUpload
      ref="fileUpload"
      :accept="acceptedFiles"
      :max-file-size="maxFileSize"
      :choose-label="t('select_file_label')"
      @select="onSelectFile($event)"
    >
      <template #header>
        <div v-if="contentJson">{{ t('description') }}</div>
        <template v-else> {{ null }}</template>
      </template>

      <template #content>
        <div
          v-if="!contentJson"
          class="flex items-center justify-center flex-col gap-3"
        >
          <template v-if="!uploadLoading">
            <i
              class="pi pi-cloud-upload !border-2 !rounded-full !p-8 !text-4xl !text-muted-color"
            />
            <p>{{ t('drag_and_drop') }}</p>
          </template>
          <div v-else>
            <ProgressSpinner />
          </div>

          <Button
            v-tooltip.bottom="t('upload_tooltip', { maxSizeInMB })"
            class="my-1"
            icon="pi pi-upload"
            :label="t('select_file_label')"
            :loading="uploadLoading"
            @click="fileUpload.choose()"
          />
          <Message
            v-if="uploadFailed"
            severity="error"
            size="small"
            class="w-full md:w-2/4"
          >
            {{ t('upload_error', { maxSizeInMB }) }}
          </Message>
        </div>

        <template v-else>
          <DataTable
            :value="topFiveItems"
            show-gridlines
            pt:tablecontainer:class="grow"
            scroll-height="flex"
            column-resize-mode="fit"
            row-hover
            striped-rows
            size="small"
            scrollable
          >
            <Column
              v-for="col of columns"
              :key="col.key"
              :pt="{ columnHeaderContent: 'flex-col w-full' }"
              :field="col.field"
            >
              <template #header>
                <div class="justify-self-center">
                  {{ col.original_header || '&nbsp;' }}
                </div>
                <Select
                  v-model="col.header"
                  :pt:label:class="{
                    'font-semibold': col.header === 'email',
                  }"
                  :class="{
                    'border-[--p-contrast-500]': col.header === 'email',
                  }"
                  :placeholder="t('select_column_placeholder')"
                  option-value="value"
                  option-label="label"
                  class="w-full"
                  :options="selectOptions"
                  :option-disabled="
                    (data) =>
                      selectedHeaders.includes(data.value) &&
                      data.value !== col.header
                  "
                  show-clear
                />
              </template>

              <template #body="{ data, field }">
                {{ data[field] }}
              </template>
            </Column>
          </DataTable>
        </template>
      </template>
    </FileUpload>

    <template v-if="contentJson" #footer>
      <Button
        :label="t('upload_your_file')"
        severity="secondary"
        icon="pi pi-arrow-left"
        @click="reset()"
      />
      <!-- This is a workaround as tooltip doesn't work when component is `disabled`-->
      <div
        v-tooltip.top="
          !selectedHeaders.includes('email') && t('email_column_required')
        "
      >
        <Button
          class="border-solid border-2 border-black"
          :label="t('start_mining')"
          severity="contrast"
          :disabled="!selectedHeaders.includes('email')"
          @click="startMining"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { maxFileSize, maxSizeInMB, REGEX_EMAIL } from '@/utils/constants';
import csvToJson from 'convert-csv-to-json';
import type { FileUploadSelectEvent } from 'primevue/fileupload';

const SOURCE = 'file';
const { t } = useI18n({
  useScope: 'local',
});
const $leadminerStore = useLeadminerStore();

const dialog = ref();
const visible = ref(false);
const openModal = () => {
  visible.value = true;
};
defineExpose({ openModal });

const contentJson = ref(null) as Ref<Record<string, string>[] | null>;
const contentJsonLength = computed(() => contentJson.value?.length);
const fileUpload = ref();
const fileName = ref<string>();
const columns = ref<Column[]>([]);
const parsedData = ref();
const topFiveItems = computed(() => parsedData.value?.slice(0, 5));
const acceptedFiles = '.csv, .xls, .xlsx';
const uploadFailed = ref(false);
const uploadLoading = ref(false);

const options = [
  { value: 'name', label: 'Name' },
  { value: 'email', label: 'Email' },
  { value: 'given_name', label: 'Given name' },
  { value: 'family_name', label: 'Family name' },
  { value: 'alternate_names', label: 'Alternate names' },
  { value: 'location', label: 'Location' },
  { value: 'works_for', label: 'Works for' },
  { value: 'job_title', label: 'Job title' },
  { value: 'same_as', label: 'Same as' },
  { value: 'image', label: 'Avatar URL' },
];

type Column = {
  field: string;
  header: string | null;
  key?: number;
  original_header?: string;
};
type Row = Record<string, string>;

const selectOptions = options;
const selectedHeaders = computed(() =>
  columns.value
    ?.map((col: Column) => {
      return col.header;
    })
    .filter(Boolean),
);
const $screenStore = useScreenStore();

function reset() {
  fileUpload.value.clear();
  contentJson.value = null;
  columns.value = [];
  fileName.value = undefined;
  $leadminerStore.selectedFile = null;
}

function readFile(file: File): Promise<string | null> {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.readAsText(file, 'UTF-8');
    reader.onload = () => resolve(reader.result as string | null);
    reader.onerror = () => reject(Error("Couldn't read the file."));
  });
}

function extractEmailColumnIndex(row: Row) {
  const keys = Object.keys(row);
  const emailColumnIndex = keys.findIndex((key) => {
    const cellValue = String(row[key]).toLowerCase();
    return REGEX_EMAIL.test(cellValue);
  });
  return emailColumnIndex;
}

function getEmailColumnIndex(rows: Row[], testLength: number) {
  let emailColumnIndex = extractEmailColumnIndex(rows[0]); // check if 1st row has email column
  if (emailColumnIndex !== -1) {
    // 2nd to 5th row should have emails on the same column
    for (let i = 1; i < testLength; i++) {
      if (emailColumnIndex !== extractEmailColumnIndex(rows[i])) {
        emailColumnIndex = -1;
        break;
      }
    }
  }
  if (emailColumnIndex === -1) {
    throw Error('No email column detected in the CSV data.');
  }
  return emailColumnIndex;
}

function createHeaders(rows: Row[]) {
  const emailColumnIndex = getEmailColumnIndex(rows, Math.min(rows.length, 5));
  console.debug(`Email column detected at index ${emailColumnIndex}.`);
  const keys = Object.keys(rows[0]);
  return keys.map((key, index) => {
    const matchingOption = options.find(
      (option) =>
        key === option.label.replace(/\s/g, '') || key === option.value,
    ); // https://github.com/iuccio/csvToJson/pull/68
    return {
      original_header: key,
      field: matchingOption?.value || String(index),
      header:
        index === emailColumnIndex ? 'email' : matchingOption?.value || null, // Map to email or label or null
    };
  });
}

async function onSelectFile($event: FileUploadSelectEvent) {
  uploadLoading.value = true;
  fileUpload.value.clear(); // Clear the array of files
  const file = $event.files[0];
  try {
    fileName.value = file.name;
    console.debug({ 'Selected file:': file });
    const content = await readFile(file);
    if (!content) throw Error();

    // Parse CSV string to JSON
    contentJson.value = csvToJson
      .supportQuotedField(true)
      .fieldDelimiter(',')
      .csvStringToJson(content);
    if (
      Array.isArray(contentJson.value) &&
      contentJsonLength.value &&
      contentJsonLength.value > 0
    ) {
      columns.value = createHeaders(contentJson.value);
    } else {
      throw Error('Parsed CSV content is empty or invalid.');
    }
    console.log(columns.value);
    parsedData.value = contentJson.value.map((row: Row) => {
      const updatedRow: Row = {};
      Object.keys(row).forEach((key, colIndex) => {
        const field = columns.value[colIndex]?.field || key;
        updatedRow[field] = row[key];
      });
      return updatedRow;
    });
    console.debug({ parsedData: parsedData.value });
  } catch (error) {
    uploadFailed.value = true;
    reset();
    console.error(error);
  } finally {
    uploadLoading.value = false;
  }
}

function startMining() {
  const parsedDataWithMappedHeaders: Row[] = parsedData.value.map(
    (row: Row) => {
      const updatedRow: Row = {};
      columns.value.forEach((col) => {
        if (col.header) {
          updatedRow[col.header] = row[col.field];
        }
      });
      return updatedRow;
    },
  );
  if (!Object.keys(parsedDataWithMappedHeaders[0]).includes('email')) {
    throw Error('An email field should be selected.');
  }
  $leadminerStore.selectedFile = {
    name: fileName.value ?? '',
    contacts: parsedDataWithMappedHeaders,
  };
  $leadminerStore.startMining(SOURCE);
  visible.value = false;
}
</script>
<i18n lang="json">
{
  "en": {
    "import_csv_excel": "Import CSV or Excel",
    "select_file_label": "Upload your file",
    "description": "Select the columns you want to import. Your file must have at least an email column. Here are the first 5 rows.",
    "drag_and_drop": "Drag and drop files here.",
    "upload_your_file": "Upload your file",
    "start_mining": "Start mining now!",
    "upload_tooltip": ".csv, .xsls or .xls file max {maxSizeInMB}MB",
    "upload_error": "Your file must be in one of the following formats: .csv, .xls, or .xlsx, and it should be under {maxSizeInMB}MB in size. Additionally, the file must include at least a column for email addresses.",
    "select_column_placeholder": "Select a field",
    "email_column_required": "Select an email field"
  },
  "fr": {
    "import_csv_excel": "Importer CSV ou Excel",
    "select_file_label": "Téléchargez votre fichier",
    "description": "Sélectionne les colonnes que vous souhaitez importer. Votre fichier doit avoir au moins une colonne email. Voici les 5 premières lignes.",
    "drag_and_drop": "Faites glisser et déposez les fichiers ici pour les télécharger.",
    "upload_your_file": "Téléchargez votre fichier",
    "start_mining": "Commencer l'extraction de vos contacts",
    "upload_error": "Votre fichier doit être au format .csv, .xls ou .xlsx et ne doit pas dépasser {maxSizeInMB} Mo. De plus, le fichier doit inclure au moins une colonne pour les adresses e-mail.",
    "upload_tooltip": "Fichier .csv, .xsls ou .xls max {maxSizeInMB} Mo",
    "select_column_placeholder": "Sélectionnez un champ",
    "email_column_required": "Sélectionnez un champ email"
  }
}
</i18n>
