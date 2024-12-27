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
    @hide="reset()"
  >
    <FileUpload
      ref="fileUpload"
      :accept="acceptedFiles"
      :max-file-size="maxFileSize"
      :choose-label="t('choose_label')"
      @select="onSelectFile($event)"
    >
      <template #header> {{ null }} </template>
      <template #content>
        <p v-if="contentJson">{{ t('description') }}</p>
        <div>
          <DataTable
            v-if="topFiveItems"
            :value="topFiveItems"
            show-gridlines
            pt:tablecontainer:class="grow"
            scroll-height="flex"
            column-resize-mode="fit"
            row-hover
            striped-rows
            paginator
            :current-page-report-template="`({currentPage} ${$t('of')} {totalPages})`"
            :rows="150"
            :rows-per-page-options="[150, 500, 1000]"
            size="small"
            scrollable
          >
            <Column v-for="col of columns" :key="col.key" :field="col.field">
              <template #header>
                <Select
                  v-model="col.header"
                  :pt:label:class="{ 'font-semibold': col.header === 'email' }"
                  placeholder="Not to import"
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
                {{ col.header }}
                <template v-if="textareaFields.includes(field)">
                  <div>{{ data[field]?.join(', ') }}</div>
                </template>
                <template v-else>
                  {{ data[field] }}
                </template>
              </template>

              <template #editor="{ data, field }">
                <template v-if="textareaFields.includes(field)">
                  <Textarea v-model="data[field]" />
                </template>
                <template v-else>
                  <InputText v-model="data[field]" autofocus fluid />
                </template>
              </template>
            </Column>
          </DataTable>

          <div v-else class="flex items-center justify-center flex-col">
            <i
              class="pi pi-cloud-upload !border-2 !rounded-full !p-8 !text-4xl !text-muted-color"
            />
            <p class="mt-6 mb-0">{{ t('drag_and_drop') }}</p>
            <Button
              icon="pi pi-upload"
              :label="t('choose_label')"
              @click="fileUpload.choose()"
            />
            <div>{{ acceptedFiles }}</div>
          </div>
        </div>
      </template>
    </FileUpload>

    <template #footer>
      <template v-if="topFiveItems">
        <Button
          :label="t('previous')"
          severity="secondary"
          icon="pi pi-arrow-left"
          @click="reset()"
        />
        <Button :label="t('start_mining')" @click="visible = false" />
      </template>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import csvToJson from 'convert-csv-to-json';
import type { FileUploadSelectEvent } from 'primevue/fileupload';
import { useToast } from 'primevue/usetoast';

const { t } = useI18n({
  useScope: 'local',
});

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
const maxFileSize = 1000000; // 1MB
const contentJson = ref(null) as Ref<object[] | null>;
const contentJsonLength = computed(() => contentJson.value?.length);
const topFiveItems = computed(() => contentJson.value?.slice(0, 5));
const fileUpload = ref();

const columns = ref();

const acceptedFiles = '.csv, .xls, .xlsx';
const textareaFields = ['alternate_names', 'location', 'same_as'];

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
  columns.value.map((col) => col.header).filter(Boolean),
);

async function onSelectFile($event: FileUploadSelectEvent) {
  fileUpload.value.clear(); // Clear the array of files
  const file = $event.files[0];
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

    // Should verify
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

function extractEmailColumnIndex(row: object) {
  const keys = Object.keys(row);
  const emailColumnIndex = keys.findIndex((key) => {
    const cellValue = String(row[key]).toLowerCase();
    return /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(cellValue);
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
      field: key,
      header:
        index === emailColumnIndex ? 'email' : matchingOption?.value || null, // Map to email or label or null
    };
  });
}

function reset() {
  fileUpload.value.clear();
  contentJson.value = null;
  columns.value = null;
}
</script>
<i18n lang="json">
{
  "en": {
    "import_csv_excel": "Import CSV or Excel",
    "choose_label": "Upload your file",
    "description": "Select the columns you want to import. Your file must have at least an email column. Here are the first 5 lines.",
    "drag_and_drop": "Drag and drop files to here to upload.",
    "previous": "Previous",
    "start_mining": "Start mining your contacts"
  },
  "fr": {
    "import_csv_excel": "Importer CSV ou Excel",
    "choose_label": "Téléchargez votre fichier",
    "description": "Sélectionne les colonnes que vous souhaitez importer. Votre fichier doit avoir au moins une colonne email. Voici les 5 premières lignes.",
    "drag_and_drop": "Faites glisser et déposez les fichiers ici pour les télécharger.",
    "previous": "Précédent",
    "start_mining": "Commencer l'extraction de vos contacts"
  }
}
</i18n>
