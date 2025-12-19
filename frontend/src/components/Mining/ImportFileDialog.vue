<template>
  <Dialog
    ref="dialog"
    v-model:visible="visible"
    modal
    :header="t('import_csv_excel')"
    pt:content:class="grow p-3 pt-0"
    pt:footer:class="p-3"
    :draggable="false"
    :maximizable="$screenStore?.size?.md"
    :pt:root:class="{ 'p-dialog-maximized': !$screenStore?.size?.md }"
    :style="{ width: '60vw', height: '70vh' }"
  >
    <FileUpload
      ref="fileUpload"
      pt:root:class="h-full"
      :accept="acceptedFiles"
      :max-file-size="maxFileSize"
      :choose-label="t('select_file_label')"
      :pt:header:class="{ hidden: !contentJson }"
      :pt:content:class="{
        'flex flex-col ': true,
        'pt-4 h-full w-full': !contentJson,
      }"
      @select="onSelectFile($event)"
    >
      <template #header>
        <div v-if="contentJson" class="w-full">
          {{ t('select_column_description', { ROWS_SHOWN_NUMBER }) }}
          <Message
            v-if="unavailableEmailRows"
            severity="warn"
            class="mt-2"
            size="small"
          >
            {{
              t('unavailable_email_rows', {
                n: unavailableEmailRows.length,
                unavailableEmailRows: unavailableEmailRows
                  .map((value) => ++value)
                  .join(', '),
              })
            }}
          </Message>
        </div>
        <template v-else>{{ null }}</template>
      </template>

      <template #content>
        <div
          v-if="!contentJson"
          class="flex flex-col items-center justify-center gap-3 m-auto"
        >
          <i
            class="pi pi-cloud-upload !border-2 !rounded-full !p-8 !text-4xl !text-muted-color"
          />
          <p>{{ t('drag_and_drop') }}</p>

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
            :value="parsedData"
            show-gridlines
            pt:tablecontainer:class="grow"
            scroll-height="flex"
            column-resize-mode="fit"
            row-hover
            striped-rows
            size="small"
            scrollable
            :current-page-report-template="`{first} - {last} / {totalRecords} ${t('contacts')}`"
            paginator-template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport"
            :paginator="true"
            :rows="ROWS_SHOWN_NUMBER"
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
                    'border-(--p-contrast-500)': col.header === 'email',
                  }"
                  :placeholder="t('select_column_placeholder')"
                  option-value="value"
                  option-label="label"
                  class="w-full"
                  :options="selectOptions"
                  :disabled="col.available_option.length === 0"
                  :option-disabled="
                    (data) =>
                      (selectedHeaders.includes(data.value) &&
                        data.value !== col.header) ||
                      !col.available_option.includes(data.value)
                  "
                  show-clear
                  @value-change="handleSelectChangeEvent"
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
      <Button
        v-tooltip.top="
          !selectedHeaders.includes('email') && t('email_column_required')
        "
        class="border-solid border-2 border-black"
        :label="t('start_mining_now')"
        severity="contrast"
        :disabled="!selectedHeaders.includes('email')"
        @click="startMining"
      />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { maxFileSize, maxSizeInMB } from '@/utils/constants';
import { REGEX_EMAIL } from '@/utils/email';
import Papa from 'papaparse';
import type { FileUploadSelectEvent } from 'primevue/fileupload';
import readXlsxFile from 'read-excel-file';
import type { Contact } from '~/types/contact';
import { isValidURL } from '~/utils/contacts';

const SOURCE = 'file';
const { t } = useI18n({
  useScope: 'local',
});

const { t: $t } = useI18n({
  useScope: 'local',
});
const $leadminerStore = useLeadminerStore();
const $stepper = useMiningStepper();

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
const acceptedFiles = '.csv, .xlsx';
const uploadFailed = ref(false);
const uploadLoading = ref(false);
const ROWS_SHOWN_NUMBER = 5;

const options: {
  value: keyof Contact;
  label: string;
}[] = [
  { value: 'name', label: t('contact.name') },
  { value: 'email', label: 'Email' },
  { value: 'given_name', label: $t('contact.given_name') },
  { value: 'family_name', label: $t('contact.family_name') },
  { value: 'alternate_name', label: $t('contact.alternate_name') },
  { value: 'location', label: $t('contact.location') },
  { value: 'works_for', label: $t('contact.works_for') },
  { value: 'job_title', label: $t('contact.job_title') },
  { value: 'same_as', label: $t('contact.same_as') },
  { value: 'image', label: $t('contact.image') },
];

const URL_OPTIONS: (keyof Contact)[] = ['image', 'same_as'];
const REST_OPTIONS = options
  .filter(
    (option) => option.value !== 'email' && !URL_OPTIONS.includes(option.value),
  )
  .map((option) => option.value);

type Column = {
  field: string;
  header: string | null;
  key?: number;
  original_header?: string;
  available_option: string[];
  unavailable_email_rows?: number[];
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
  fileUpload.value?.clear();
  contentJson.value = null;
  columns.value = [];
  fileName.value = undefined;
  $leadminerStore.selectedFile = null;
}

function isEmptyCell(cellValue: string) {
  return cellValue === '' || cellValue === undefined || cellValue === null;
}

function getColumns(rows: Row[]) {
  const keys = Object.keys(rows[0]);
  const urlColumnIndexes = new Set<number>();
  const emptyColumnIndexes = new Set<number>();
  const emailColumnIndexes = new Set<number>();
  const emailFailedColumnIndexes: { [key: number]: number[] } = {};

  // Initialize sets with indexes from the first row
  keys.forEach((key, col_index) => {
    const cellValue = String(rows[0][key]).toLowerCase();
    if (REGEX_EMAIL.test(cellValue)) emailColumnIndexes.add(col_index);
    if (isValidURL(cellValue) || isEmptyCell(cellValue))
      urlColumnIndexes.add(col_index);
    if (isEmptyCell(cellValue)) emptyColumnIndexes.add(col_index);
  });
  if (emailColumnIndexes.size === 0)
    throw new Error('No email column detected in the CSV data.');

  // Clean from sets based on next rows
  for (let row_index = 1; row_index < rows.length; row_index++) {
    const row = rows[row_index];
    const row_keys = Object.keys(row);
    const validIndexes = new Set<number>([
      ...emailColumnIndexes,
      ...urlColumnIndexes,
    ]);
    validIndexes.forEach((valid_index) => {
      const cellValue = String(row[row_keys[valid_index]]).toLowerCase();
      if (emailColumnIndexes.has(valid_index) && !REGEX_EMAIL.test(cellValue)) {
        if (!emailFailedColumnIndexes[valid_index])
          emailFailedColumnIndexes[valid_index] = [row_index];
        else emailFailedColumnIndexes[valid_index].push(row_index);
        console.debug(
          `Email column fails at col ${valid_index} row ${row_index}:`,
          row,
          emailFailedColumnIndexes,
        );
      }
      if (
        urlColumnIndexes.has(valid_index) &&
        !(isValidURL(cellValue) || isEmptyCell(cellValue))
      )
        urlColumnIndexes.delete(valid_index);
      if (emptyColumnIndexes.has(valid_index) && !isEmptyCell(cellValue))
        emptyColumnIndexes.delete(valid_index);
    });
  }

  if (emailColumnIndexes.size === 0)
    throw new Error('No email column detected in the CSV data.');

  return {
    emailColumnIndexes: Array.from(emailColumnIndexes),
    urlColumnIndexes: Array.from(urlColumnIndexes).filter(
      (index) => !emptyColumnIndexes.has(index), // Remove empty columns
    ),
    emptyColumnIndexes: Array.from(emptyColumnIndexes),
    emailFailedColumnIndexes,
  };
}

const unavailableEmailRows = ref<number[]>();
function handleSelectChangeEvent(value: string | null) {
  if (value === 'email' || value === null) {
    updateUnavailableEmailRows();
  }
}

function updateUnavailableEmailRows() {
  unavailableEmailRows.value = columns.value.find(
    (col) => col.header === 'email',
  )?.unavailable_email_rows;
}

function createHeaders(rows: Row[]): {
  original_header: string;
  field: string;
  header: keyof Contact | null;
  available_option: string[];
  unavailable_email_rows?: number[];
}[] {
  const {
    emailColumnIndexes,
    urlColumnIndexes,
    emptyColumnIndexes,
    emailFailedColumnIndexes,
  } = getColumns(rows);

  console.debug(`Email able columns detected at index ${emailColumnIndexes}.`);
  console.debug(`URL able columns detected at index ${urlColumnIndexes}.`);
  console.debug(`Empty columns detected at index ${emptyColumnIndexes}.`);

  const keys = Object.keys(rows[0]);
  return keys.map((key, index) => {
    const matchingOption = options.find((option) => key === option.value);
    const available_option = (() => {
      if (emptyColumnIndexes.includes(index)) return [];
      if (emailColumnIndexes.includes(index)) return ['email'];
      if (urlColumnIndexes.includes(index)) return URL_OPTIONS;
      return REST_OPTIONS;
    })();

    let header: keyof Contact | null = null;
    // Set the first email column as email
    if (index === emailColumnIndexes[0]) {
      header = 'email';
    }
    // Map to label
    else if (
      matchingOption &&
      available_option.includes(matchingOption.value)
    ) {
      header = matchingOption.value;
    }

    return {
      original_header: key,
      field: matchingOption?.value || String(index),
      header,
      available_option,
      ...(emailFailedColumnIndexes[index] && {
        unavailable_email_rows: emailFailedColumnIndexes[index],
      }),
    };
  });
}

// Helper function to parse CSV file
function parseCsvFile(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      skipEmptyLines: true,
      header: true,
      complete: (results) => {
        console.debug('Parsed CSV data:', results.data);
        console.debug('Parsed CSV meta:', results.meta);
        resolve(results.data as Record<string, string>[]);
      },
      error: (error) => {
        console.error('Error parsing CSV:', error.message);
        reject(new Error('No valid CSV content could be parsed.'));
      },
    });
  });
}

// Helper function to parse XLSX file
async function parseXlsxFile(file: File) {
  const data = await readXlsxFile(file);
  // Convert the array to header mapped objects
  const header = data[0].map((h) => String(h ?? '')); // Convert to string
  return data.slice(1).map((row) =>
    header.reduce(
      (obj, h, i) => {
        obj[h] = String(row[i] ?? ''); // Also ensure values are strings if needed
        return obj;
      },
      {} as { [key: string]: string },
    ),
  );
}

// Helper function to map row data with columns
function mapRowData(data: Record<string, string>[], cols: Column[]): Row[] {
  return data.map((row: Row) => {
    const updatedRow: Row = {};
    Object.keys(row).forEach((key, colIndex) => {
      const field = cols[colIndex]?.field || key;
      updatedRow[field] = row[key];
    });
    return updatedRow;
  });
}

async function onSelectFile($event: FileUploadSelectEvent) {
  uploadLoading.value = true;
  fileUpload.value.clear(); // Clear the array of files
  const file = $event.files[0];
  try {
    console.debug({ 'Selected file:': file });
    fileName.value = file.name;
    contentJson.value = file.type.includes('csv')
      ? await parseCsvFile(file)
      : await parseXlsxFile(file);

    console.debug({ fileContentJson: contentJson.value });
    if (
      !Array.isArray(contentJson.value) ||
      !(contentJsonLength.value && contentJsonLength.value > 0)
    ) {
      throw Error('No valid CSV content could be parsed.');
    }

    columns.value = createHeaders(contentJson.value);
    if (!columns.value) {
      throw new Error('No valid CSV content could be parsed.');
    }
    if (!dialog.value.maximized && Object.keys(columns.value).length >= 4)
      dialog.value.maximize(); // Fullscreen if more than 4 columns

    updateUnavailableEmailRows();
    console.debug({ columns: columns.value });

    parsedData.value = mapRowData(contentJson.value, columns.value);
    console.debug({ parsedData: parsedData.value });
  } catch (error) {
    uploadFailed.value = true;
    reset();
    console.error(error);
  } finally {
    uploadLoading.value = false;
  }
}

async function startMining() {
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

  // Remove rows with unavailable emails
  unavailableEmailRows.value
    ?.sort((a, b) => b - a)
    ?.forEach((index) => parsedDataWithMappedHeaders.splice(index, 1));

  if (!Object.keys(parsedDataWithMappedHeaders[0]).includes('email')) {
    throw Error('An email field should be selected.');
  }
  $leadminerStore.selectedFile = {
    name: fileName.value ?? '',
    contacts: parsedDataWithMappedHeaders,
  };

  await $leadminerStore.startMining(SOURCE);
  $stepper.next();
  visible.value = false;
}
</script>
<i18n lang="json">
{
  "en": {
    "import_csv_excel": "Import CSV or Excel",
    "select_file_label": "Upload your file",
    "select_column_description": "Select the columns you want to import. Your file must have at least an email column. Here are the first {ROWS_SHOWN_NUMBER} rows.",
    "contacts": "contacts",
    "drag_and_drop": "Drag and drop files here.",
    "upload_your_file": "Upload your file",
    "start_mining_now": "Start mining now!",
    "upload_tooltip": ".csv or .xlsx file max {maxSizeInMB}MB",
    "upload_error": "Your file must be in one of the following formats: .csv or .xlsx, and it should be under {maxSizeInMB}MB in size. Additionally, the file must include at least a column for email addresses.",
    "select_column_placeholder": "Select a field",
    "email_column_required": "Select an email field",
    "contact": { "name": "Name" },
    "unavailable_email_rows": "The following row won't be extracted due to an invalid email address: {unavailableEmailRows}. | The following {n} rows won't be extracted due to invalid email addresses: {unavailableEmailRows}."
  },
  "fr": {
    "import_csv_excel": "Importer CSV ou Excel",
    "select_file_label": "Téléchargez votre fichier",
    "select_column_description": "Sélectionnez les colonnes que vous souhaitez importer. Votre fichier doit avoir au moins une colonne email. Voici les {ROWS_SHOWN_NUMBER} premières lignes.",
    "contacts": "contacts",
    "drag_and_drop": "Faites glisser et déposez les fichiers ici pour les télécharger.",
    "upload_your_file": "Téléchargez votre fichier",
    "start_mining_now": "Commencer l'extraction de vos contacts",
    "upload_error": "Votre fichier doit être au format .csv ou .xlsx et ne doit pas dépasser {maxSizeInMB} Mo. De plus, le fichier doit inclure au moins une colonne pour les adresses e-mail.",
    "upload_tooltip": "Fichier .csv ou .xlsx max {maxSizeInMB} Mo",
    "select_column_placeholder": "Sélectionnez un champ",
    "email_column_required": "Sélectionnez un champ email",
    "contact": { "name": "Nom complet" },
    "unavailable_email_rows": "La ligne suivante ne sera pas extraite en raison d'une adresse e-mail invalide : {unavailableEmailRows}. | Les {n} lignes suivantes ne seront pas extraites en raison d'adresses e-mail invalides : {unavailableEmailRows}."
  }
}
</i18n>
