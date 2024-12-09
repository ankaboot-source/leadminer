<template>
  <Dialog
    v-model:visible="visible"
    modal
    header="Import CSV or Excel"
    class="w-full md:w-4/6 max-h-full h-full md:h-4/6 rounded-none md:rounded-md"
    :draggable="false"
    maximizable
    @hide="reset()"
    @cell-edit-complete="onCellEditComplete"
  >
    <div class="h-full">
      <FileUpload
        accept=".csv,.xls,.xlsx"
        :max-file-size="maxFileSize"
        mode="basic"
        @select="onSelectFile($event)"
      />
      <DataTable
        v-if="contentJson"
        :value="contentJson"
        edit-mode="cell"
        show-gridlines
        pt:tablecontainer:class="grow"
        row-hover
        striped-rows
        paginator
        :current-page-report-template="`({currentPage} ${$t('of')} {totalPages})`"
        :rows="150"
        :rows-per-page-options="[150, 500, 1000]"
        size="small"
        scrollable
      >
        <Column
          v-for="col of columns"
          :key="col.key"
          :field="col.field"
          :header="col.header"
        >
          <template #body="{ data, field }">
            <template v-if="field === 'tags'">
              <Tag
                v-for="(tag, index) in data[field]"
                :key="index"
                :value="getTagLabel(tag)"
                :severity="getTagColor(tag)"
              />
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
      <div class="flex justify-end gap-2">
        <Button
          type="button"
          label="Cancel"
          severity="secondary"
          @click="visible = false"
        />
        <Button type="button" label="Import" @click="visible = false" />
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import csvToJson from 'convert-csv-to-json';
import type { DataTableCellEditCompleteEvent } from 'primevue/datatable';
import type { FileUploadSelectEvent } from 'primevue/fileupload';
import { useToast } from 'primevue/usetoast';
import type { Contact } from '~/types/contact';

const visible = ref(false);
const openModal = () => {
  visible.value = true;
};
defineExpose({ openModal });

const toast = useToast();
const maxFileSize = 1000000; // 1MB
const contentJson = ref(null) as Ref<Contact[] | null>;
const columns = ref();

const csvArray = {
  name: 'Name',
  email: 'Email',
  tags: 'Tags',
  given_name: 'Given name',
  family_name: 'Family name',
  alternate_names: 'Alternate names',
  location: 'Location',
  works_for: 'Works for',
  job_title: 'Job title',
  same_as: 'Same as',
  image: 'Avatar URL',
}; // + Status, Works_for
const textareaFields = ['alternate_names', 'location', 'same_as'];
const arraysFields = textareaFields.concat('tags');
async function onSelectFile($event: FileUploadSelectEvent) {
  const file = $event.files[0]; // `multiple` prop is false
  try {
    const content = await readFile(file);
    if (!content) throw Error();

    columns.value = Object.keys(csvArray).map((key) => ({
      field: key,
      header: csvArray[key],
    }));

    contentJson.value = csvToJson
      .supportQuotedField(true)
      .fieldDelimiter(',')
      .csvStringToJson(content);

    console.log(contentJson.value);

    // Align `contentJson.value` with required columns and map headers back to real field names
    contentJson.value = contentJson.value
      .map((item: Contact) =>
        Object.fromEntries(
          Object.entries(csvArray).map(([realField, header]) => {
            const trimmedHeader = header.replace(/\s/g, ''); // https://github.com/iuccio/csvToJson/pull/68

            if (arraysFields.includes(realField)) {
              item[trimmedHeader] = item[trimmedHeader]
                ?.split(',')
                .filter((item) => item.length);
            }
            return [
              realField, // Use the real field name as the key
              item[trimmedHeader] || null, // Map the header back to its value
            ];
          }),
        ),
      )
      .filter((item) => item.email !== null); // Remove rows with no email
    console.log(contentJson.value);

    toast.add({
      severity: 'info',
      summary: 'Success',
      detail: 'File Selected',
      life: 3000,
    });
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Error reading file',
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

function onCellEditComplete(event: DataTableCellEditCompleteEvent) {
  const { data, newValue, field } = event;

  switch (field) {
    case 'quantity':
    case 'price':
      if (isPositiveInteger(newValue)) data[field] = newValue;
      else event.preventDefault();
      break;

    default:
      if (newValue.trim().length > 0) data[field] = newValue;
      else event.preventDefault();
      break;
  }
}

function reset() {
  contentJson.value = null;
  columns.value = null;
}
</script>
<i18n lang="json">
{
  "en": {
    "header": "Import CSV",
    "description": "Description",
    "fr": {
      "header": "Import CSV",
      "description": "Description"
    }
  }
}
</i18n>
