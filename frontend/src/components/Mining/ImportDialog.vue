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
      :choose-label="t('choose_label')"
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
                  :pt:label:class="{ 'font-semibold': col.header === 'email' }"
                  placeholder="Select a field"
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

        <div v-else class="flex items-center justify-center flex-col">
          <i
            class="pi pi-cloud-upload !border-2 !rounded-full !p-8 !text-4xl !text-muted-color"
          />
          <p class="mt-4 mb-6">{{ t('drag_and_drop') }}</p>
          <Button
            v-tooltip.bottom="'.csv, .xsls or .xls file max 2MB'"
            icon="pi pi-upload"
            :label="t('choose_label')"
            @click="fileUpload.choose()"
          />
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
      <Button
        class="border-solid border-2 border-black"
        :label="t('start_mining')"
        severity="contrast"
        @click="startMining"
      />
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

function startMining() {
  visible.value = false;
  $leadminerStore.startMining(source);
}
function maximize() {
  if (dialog.value.maximized) return;
  dialog.value.maximize();
}
const dialog = ref();
const visible = ref(false);
const openModal = () => {
  visible.value = true;
};
defineExpose({ openModal });

const toast = useToast();
const maxFileSize = 2000000; // 2MB
const contentJson = ref(null) as Ref<object[] | null>;
const contentJsonLength = computed(() => contentJson.value?.length);
const topFiveItems = computed(() => parsedData.value?.slice(0, 5));
const fileUpload = ref();
const columns = ref();
const parsedData = ref();
const acceptedFiles = '.csv, .xls, .xlsx';

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

const selectOptions = options;
const selectedHeaders = computed(() =>
  columns.value?.map((col) => col.header).filter(Boolean),
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

    if (
      Array.isArray(contentJson.value) &&
      contentJsonLength.value &&
      contentJsonLength.value > 0
    ) {
      columns.value = createHeaders(contentJson.value);
    } else {
      throw Error('Parsed CSV content is empty or invalid.');
    }
    parsedData.value = contentJson.value.map((row) => {
      const updatedRow: Record<string, any> = {};
      Object.keys(row).forEach((key, colIndex) => {
        const field = columns.value[colIndex]?.field || key;
        updatedRow[field] = row[key];
      });
      return updatedRow;
    });

    // Unique Email Array
    $leadminerStore.selectedEmails = [
      ...new Set(
        parsedData.value
          .map((row) => row.email)
          .filter((row) => REGEX_EMAIL.test(row)),
      ),
    ];

    console.log($leadminerStore.selectedEmails);
    toast.add({
      severity: 'info',
      summary: 'Success',
      detail: 'File Selected',
      life: 3000,
    });
  } catch (error) {
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
function extractEmailColumnIndex(row: object) {
  const keys = Object.keys(row);
  const emailColumnIndex = keys.findIndex((key) => {
    const cellValue = String(row[key]).toLowerCase();
    return REGEX_EMAIL.test(cellValue);
  });
  return emailColumnIndex;
}

function getEmailColumnIndex(rows: object[], testLength: number) {
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
function createHeaders(rows: object[]) {
  const emailColumnIndex = getEmailColumnIndex(rows, Math.min(rows.length, 5));
  const keys = Object.keys(rows[0]);

  return keys.map((key, index) => {
    const matchingOption = options.find(
      (option) => option.label === key.replace(/\s/g, ''),
    ); // https://github.com/iuccio/csvToJson/pull/68
    return {
      field:
        index === emailColumnIndex
          ? 'email'
          : matchingOption?.value || String(index),
      header:
        index === emailColumnIndex ? 'email' : matchingOption?.value || null, // Map to email or label or null
    };
  });
}

function reset() {
  fileUpload.value.clear();
  contentJson.value = null;
  columns.value = null;
  $leadminerStore.selectedEmails = [];
}
// email: accent border
// upload error: size, mandatory data (error), parsing error (mithel sajl file e5er b .csv),
// l messages: ta7t l button
// size da5lo fel i18n wel kol fard variable
</script>
<i18n lang="json">
{
  "en": {
    "import_csv_excel": "Import CSV or Excel",
    "choose_label": "Upload your file",
    "description": "Select the columns you want to import. Your file must have at least an email column. Here are the first 5 rows.",
    "drag_and_drop": "Drag and drop files here.",
    "previous": "Upload your file",
    "start_mining": "Start mining now!",
    "upload_error": "Your file must be in one of the following formats: .csv, .xls, or .xlsx, and it should be under 2MB in size. Additionally, the file must include at least a column for email addresses."
  },
  "fr": {
    "import_csv_excel": "Importer CSV ou Excel",
    "choose_label": "Téléchargez votre fichier",
    "description": "Sélectionne les colonnes que vous souhaitez importer. Votre fichier doit avoir au moins une colonne email. Voici les 5 premières lignes.",
    "drag_and_drop": "Faites glisser et déposez les fichiers ici pour les télécharger.",
    "previous": "Précédent",
    "start_mining": "Commencer l'extraction de vos contacts",
    "upload_error": "Votre fichier doit être au format .csv, .xls ou .xlsx et ne doit pas dépasser 2 Mo. De plus, le fichier doit inclure au moins une colonne pour les adresses e-mail."
  }
}
</i18n>
