<template>
  <Dialog
    ref="dialog"
    v-model:visible="visible"
    modal
    :header="t('import_csv_excel')"
    pt:content:class="grow p-3 border-y border-slate-200"
    pt:footer:class="p-3"
    :draggable="false"
    maximizable
    @show="maximize()"
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
        <template v-if="contentJson">
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
            <Column v-for="col of columns" :key="col.key" :field="col.field">
              <template #header>
                <Select
                  v-model="col.header"
                  :pt:label:class="{
                    'font-semibold': col.header === 'email',
                  }"
                  :class="{
                    'border-[--p-primary-color]': col.header === 'email',
                  }"
                  :placeholder="t('select_column_placeholder')"
                  option-value="value"
                  option-label="label"
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

        <div v-else class="flex items-center justify-center flex-col gap-3">
          <i
            class="pi pi-cloud-upload !border-2 !rounded-full !p-8 !text-4xl !text-muted-color"
          />
          <p>{{ t('drag_and_drop') }}</p>
          <Button
            v-tooltip.bottom="t('upload_tooltip', { maxSizeInMB })"
            class="my-1"
            icon="pi pi-upload"
            :label="t('select_file_label')"
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
      </template>
    </FileUpload>

    <template v-if="contentJson" #footer>
      <Button
        :label="t('previous')"
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
import csvToJson from 'convert-csv-to-json';
import type { FileUploadSelectEvent } from 'primevue/fileupload';
import { useToast } from 'primevue/usetoast';

const source = 'file';
const { t } = useI18n({
  useScope: 'local',
});
const $leadminerStore = useLeadminerStore();

const dialog = ref();
function maximize() {
  if (dialog.value.maximized) return;
  dialog.value.maximize();
}
const visible = ref(false);
const openModal = () => {
  visible.value = true;
};
defineExpose({ openModal });

const toast = useToast();
const maxFileSize = 2000000; // 2MB
const maxSizeInMB = maxFileSize / 1000000;
const contentJson = ref(null) as Ref<Record<string, string>[] | null>;
const contentJsonLength = computed(() => contentJson.value?.length);
const topFiveItems = computed(() => parsedData.value?.slice(0, 5));
const fileUpload = ref();
const columns = ref<Column[]>([]);
const parsedData = ref();
const acceptedFiles = '.csv, .xls, .xlsx';
const uploadFailed = ref(false);

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

async function onSelectFile($event: FileUploadSelectEvent) {
  fileUpload.value.clear(); // Clear the array of files
  const file = $event.files[0];
  console.log('Selected file:', file);
  try {
    const content = await readFile(file);
    if (!content) throw Error();

    // Parse CSV string to JSON
    contentJson.value = csvToJson
      .supportQuotedField(true)
      .fieldDelimiter(',')
      .csvStringToJson(content);
    console.log('contentJson', contentJson.value);
    if (
      Array.isArray(contentJson.value) &&
      contentJsonLength.value &&
      contentJsonLength.value > 0
    ) {
      columns.value = createHeaders(contentJson.value);
    } else {
      throw Error('Parsed CSV content is empty or invalid.');
    }
    parsedData.value = contentJson.value.map((row: Row) => {
      const updatedRow: Row = {};
      Object.keys(row).forEach((key, colIndex) => {
        const field = columns.value[colIndex]?.field || key;
        updatedRow[field] = row[key];
      });
      return updatedRow;
    });

    toast.add({
      severity: 'info',
      summary: 'Success',
      detail: 'File Selected',
      life: 3000,
    });
    uploadFailed.value = false;
  } catch (error) {
    uploadFailed.value = true;
    reset();
    toast.add({
      severity: 'error',
      summary: 'Error reading file',
      detail: error,
      life: 3000,
    });
  }
}

async function readFile(file: File): Promise<string | null> {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.readAsText(file, 'UTF-8');
    reader.onload = () => resolve(reader.result as string | null);
    reader.onerror = () => reject(null);
  });
}

const REGEX_EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
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
  console.log(`Email column detected at index ${emailColumnIndex}.`);
  return emailColumnIndex;
}
function createHeaders(rows: Row[]) {
  const emailColumnIndex = getEmailColumnIndex(rows, Math.min(rows.length, 5));
  const keys = Object.keys(rows[0]);

  return keys.map((key, index) => {
    const matchingOption = options.find(
      (option) => option.label === key.replace(/\s/g, ''),
    ); // https://github.com/iuccio/csvToJson/pull/68
    return {
      field: matchingOption?.value || String(index),
      header:
        index === emailColumnIndex ? 'email' : matchingOption?.value || null, // Map to email or label or null
    };
  });
}

function startMining() {
  const parsedDataWithMappedHeaders = parsedData.value.map((row: Row) => {
    const updatedRow: Row = {};
    columns.value.forEach((col) => {
      if (col.header) {
        updatedRow[col.header] = row[col.field];
      }
    });
    return updatedRow;
  });
  if (!Object.keys(parsedDataWithMappedHeaders[0]).includes('email')) {
    throw Error('An email field should be selected.');
  }
  $leadminerStore.selectedFileContacts = parsedDataWithMappedHeaders;
  $leadminerStore.startMining(source);
  visible.value = false;
}

function reset() {
  fileUpload.value.clear();
  contentJson.value = null;
  columns.value = [];
  $leadminerStore.selectedFileContacts = [];
}
</script>
<i18n lang="json">
{
  "en": {
    "import_csv_excel": "Import CSV or Excel",
    "select_file_label": "Upload your file",
    "description": "Select the columns you want to import. Your file must have at least an email column. Here are the first 5 rows.",
    "drag_and_drop": "Drag and drop files here.",
    "previous": "Upload your file",
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
    "previous": "Précédent",
    "start_mining": "Commencer l'extraction de vos contacts",
    "upload_error": "Votre fichier doit être au format .csv, .xls ou .xlsx et ne doit pas dépasser {maxSizeInMB} Mo. De plus, le fichier doit inclure au moins une colonne pour les adresses e-mail.",
    "upload_tooltip": "Fichier .csv, .xsls ou .xls max {maxSizeInMB} Mo",
    "select_column_placeholder": "Sélectionnez un champ",
    "email_column_required": "Sélectionnez un champ email"
  }
}
</i18n>
