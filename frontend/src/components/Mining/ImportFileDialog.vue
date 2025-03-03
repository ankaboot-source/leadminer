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
      :pt:header:class="{ hidden: contentJson }"
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
                  :disabled="col.available_option.length === 0"
                  :option-disabled="
                    (data) =>
                      (selectedHeaders.includes(data.value) &&
                        data.value !== col.header) ||
                      !col.available_option.includes(data.value)
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
import csvToJson from 'convert-csv-to-json';
import type { FileUploadSelectEvent } from 'primevue/fileupload';

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
const topFiveItems = computed(() => parsedData.value?.slice(0, 5));
const acceptedFiles = '.csv, .xls, .xlsx';
const uploadFailed = ref(false);
const uploadLoading = ref(false);

const options = [
  { value: 'name', label: $t('contact.name') },
  { value: 'email', label: 'Email' },
  { value: 'given_name', label: $t('contact.given_name') },
  { value: 'family_name', label: $t('contact.family_name') },
  { value: 'alternate_names', label: $t('contact.alternate_names') },
  { value: 'location', label: $t('contact.location') },
  { value: 'works_for', label: $t('contact.works_for') },
  { value: 'job_title', label: $t('contact.job_title') },
  { value: 'same_as', label: $t('contact.same_as') },
  { value: 'image', label: $t('contact.image') },
];

const URL_OPTIONS = ['image', 'same_as'];
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

const DELIMITERS = [',', ';', '|', '\t'];
function getLocalDelimiter() {
  const language = navigator?.language?.substring(0, 2);
  switch (language) {
    case 'fr':
    case 'de':
    case 'es':
    case 'pt':
    case 'it':
      return ';';
    default:
      return ',';
  }
}
function getOrderedDelimiters() {
  const localDelimiter = getLocalDelimiter();
  return [
    localDelimiter,
    ...DELIMITERS.filter((delimiter) => delimiter !== localDelimiter),
  ];
}
const orderedDelimiters = getOrderedDelimiters();

function reset() {
  fileUpload.value?.clear();
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

function isEmptyCell(cellValue: string) {
  return cellValue === '' || cellValue === undefined || cellValue === null;
}
function getColumns(rows: Row[]) {
  const keys = Object.keys(rows[0]);
  const emailColumnIndexes = new Set<number>();
  const urlColumnIndexes = new Set<number>();
  const emptyColumnIndexes = new Set<number>();

  // Initialize sets with indexes from the first row
  keys.forEach((key, index) => {
    const cellValue = String(rows[0][key]).toLowerCase();
    if (REGEX_EMAIL.test(cellValue)) emailColumnIndexes.add(index);
    if (
      isValidURL(cellValue) ||
      cellValue === '' ||
      cellValue === undefined ||
      cellValue === null
    )
      urlColumnIndexes.add(index);
    if (cellValue === '' || cellValue === undefined || cellValue === null)
      emptyColumnIndexes.add(index);
  });
  if (emailColumnIndexes.size === 0)
    throw new Error('No email column detected in the CSV data.');

  // Clean from sets based on next rows
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const row_keys = Object.keys(row);
    const validIndexes = new Set<number>([
      ...emailColumnIndexes,
      ...urlColumnIndexes,
    ]);
    validIndexes.forEach((index) => {
      const cellValue = String(row[row_keys[index]]).toLowerCase();
      if (emailColumnIndexes.has(index) && !REGEX_EMAIL.test(cellValue))
        emailColumnIndexes.delete(index);
      if (
        urlColumnIndexes.has(index) &&
        !(isValidURL(cellValue) || isEmptyCell(cellValue))
      )
        urlColumnIndexes.delete(index);
      if (emptyColumnIndexes.has(index) && !isEmptyCell(cellValue))
        emptyColumnIndexes.delete(index);
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
  };
}

function createHeaders(rows: Row[]) {
  const { emailColumnIndexes, urlColumnIndexes, emptyColumnIndexes } =
    getColumns(rows);

  console.debug(`Email able columns detected at index ${emailColumnIndexes}.`);
  console.debug(`URL able columns detected at index ${urlColumnIndexes}.`);
  console.debug(`Empty columns detected at index ${emptyColumnIndexes}.`);

  const keys = Object.keys(rows[0]);
  return keys.map((key, index) => {
    const matchingOption = options.find(
      (option) =>
        key === option.label.replace(/\s/g, '') || key === option.value,
    ); // https://github.com/iuccio/csvToJson/pull/68

    const available_option = (() => {
      if (emptyColumnIndexes.includes(index)) return [];
      if (emailColumnIndexes.includes(index)) return ['email'];
      if (urlColumnIndexes.includes(index)) return URL_OPTIONS;
      return REST_OPTIONS;
    })();
    return {
      original_header: key,
      field: matchingOption?.value || String(index),
      header:
        index === emailColumnIndexes[0] // Set the first email column as email //TODO the one that has 'email' in the header is should be selected as the email column if its valid
          ? 'email'
          : matchingOption?.value || null, // Map to email or label or null
      available_option,
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
    let successfullyParsed = false;
    for (const delimiter of orderedDelimiters) {
      try {
        console.debug('Trying to parse using the delimiter:', delimiter);
        // Parse CSV string to JSON
        contentJson.value = csvToJson
          .supportQuotedField(true)
          .fieldDelimiter(delimiter)
          .csvStringToJson(content);
        if (
          Array.isArray(contentJson.value) &&
          contentJsonLength.value &&
          contentJsonLength.value > 0
        ) {
          columns.value = createHeaders(contentJson.value);
          successfullyParsed = true;
          break;
        } else {
          throw Error('No valid CSV content could be parsed.');
        }
      } catch {
        console.error('Failed parsing using the delimiter:', delimiter);
        continue;
      }
    }
    if (!successfullyParsed || !contentJson.value || !columns.value) {
      throw new Error('No valid CSV content could be parsed.');
    }

    console.log({ columns: columns.value });
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
    "description": "Select the columns you want to import. Your file must have at least an email column. Here are the first 5 rows.",
    "drag_and_drop": "Drag and drop files here.",
    "upload_your_file": "Upload your file",
    "start_mining_now": "Start mining now!",
    "upload_tooltip": ".csv, .xsls or .xls file max {maxSizeInMB}MB",
    "upload_error": "Your file must be in one of the following formats: .csv, .xls, or .xlsx, and it should be under {maxSizeInMB}MB in size. Additionally, the file must include at least a column for email addresses.",
    "select_column_placeholder": "Select a field",
    "email_column_required": "Select an email field"
  },
  "fr": {
    "import_csv_excel": "Importer CSV ou Excel",
    "select_file_label": "Téléchargez votre fichier",
    "description": "Sélectionnez les colonnes que vous souhaitez importer. Votre fichier doit avoir au moins une colonne email. Voici les 5 premières lignes.",
    "drag_and_drop": "Faites glisser et déposez les fichiers ici pour les télécharger.",
    "upload_your_file": "Téléchargez votre fichier",
    "start_mining_now": "Commencer l'extraction de vos contacts",
    "upload_error": "Votre fichier doit être au format .csv, .xls ou .xlsx et ne doit pas dépasser {maxSizeInMB} Mo. De plus, le fichier doit inclure au moins une colonne pour les adresses e-mail.",
    "upload_tooltip": "Fichier .csv, .xsls ou .xls max {maxSizeInMB} Mo",
    "select_column_placeholder": "Sélectionnez un champ",
    "email_column_required": "Sélectionnez un champ email"
  }
}
</i18n>
