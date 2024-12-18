<template>
  <Dialog
    v-model:visible="visible"
    modal
    header="Import CSV or Excel"
    class="w-full md:w-4/6 max-h-full h-full md:h-4/6 rounded-none md:rounded-md"
    :draggable="false"
    maximizable
    @hide="reset()"
  >
    <div class="h-full">
      <FileUpload
        accept=".csv,.xls,.xlsx"
        :max-file-size="maxFileSize"
        mode="basic"
        @select="onSelectFile($event)"
      />
      <div class="gap-2 items-center justify-center flex">
        <Checkbox v-model="hasHeader" binary input-id="hasHeader" show-clear />
        <label for="hasHeader"> Include Header</label>
      </div>

      <span v-if="topFiveItemsLength" class="items-center justify-center flex">
        (Showing {{ topFiveItemsLength }} / {{ contentJsonLength }})
      </span>

      <DataTable
        v-if="topFiveItems"
        :value="topFiveItems"
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
        <Column v-for="col of columns" :key="col.key" :field="col.field">
          <template #header>
            <Select
              v-model="col.header"
              :placeholder="col.header"
              :options="Object.values(csvArray)"
              class="w-full md:w-56"
            />
          </template>

          <template #body="{ data, field }">
            <template v-if="field === 'tags'">
              <Tag
                v-for="(tag, index) in data[field]"
                :key="index"
                :value="getTagLabel(tag)"
                :severity="getTagColor(tag)"
              />
            </template>
            <template v-else-if="textareaFields.includes(field)">
              <div>{{ data[field]?.join(', ') }}</div>
            </template>
            <template v-else>
              {{ data[field] }}
            </template>
          </template>

          <template #editor="{ data, field }">
            <template v-if="field === 'tags'">
              <MultiSelect
                v-model="data[field]"
                :options="tags()"
                option-value="value"
                option-label="label"
                display="chip"
              >
                <template #option="{ option }">
                  <Tag
                    :value="option.label"
                    :severity="getTagColor(option.value)"
                    class="capitalize"
                  />
                </template>
              </MultiSelect>
            </template>
            <template v-else-if="textareaFields.includes(field)">
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
import type { FileUploadSelectEvent } from 'primevue/fileupload';
import { useToast } from 'primevue/usetoast';
import type { Contact } from '~/types/contact';
import { getTagColor, getTagLabel, tags } from '~/utils/contacts';

const visible = ref(false);
const openModal = () => {
  visible.value = true;
};
defineExpose({ openModal });

const toast = useToast();
const maxFileSize = 1000000; // 1MB
const contentJson = ref(null) as Ref<Contact[] | null>;
const contentJsonLength = computed(() => contentJson.value?.length);
const topFiveItems = computed(() => contentJson.value?.slice(0, 5));
const topFiveItemsLength = computed(() => topFiveItems.value?.length);

const columns = ref();

const textareaFields = ['alternate_names', 'location', 'same_as'];
const arraysFields = textareaFields.concat('tags');
// realColumnNames
// mapableColumnsNames
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
const hasHeader = ref(true);

async function onSelectFile($event: FileUploadSelectEvent) {
  const file = $event.files[0]; // `multiple` prop is false
  try {
    const content = await readFile(file);
    if (!content) throw Error();

    // Parse CSV string to JSON
    contentJson.value = csvToJson
      .supportQuotedField(true)
      .fieldDelimiter(',')
      .csvStringToJson(content);

    console.log(contentJson.value);

    if (Array.isArray(contentJson.value) && contentJson.value.length > 0) {
      if (hasHeader.value) {
        // If the CSV has a header row, use the headers as column names
        const firstRow = contentJson.value[0];
        columns.value = Object.keys(firstRow).map((key) => {
          const trimmedHeader = key.replace(/\s/g, ''); // Trim spaces from header
          return {
            field: key,
            header: trimmedHeader,
          };
        });
      } else {
        // No header row: detect the email column and fill the rest
        const firstRow = contentJson.value[0];
        const keys = Object.keys(firstRow);

        // Detect email column
        const emailColumnIndex = keys.findIndex((key) => {
          const cellValue = String(firstRow[key]).toLowerCase();
          return (
            cellValue.includes('email') ||
            /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(cellValue)
          );
        });

        if (emailColumnIndex !== -1) {
          // Build columns array
          columns.value = keys.map((key, index) => {
            let header;
            if (index === emailColumnIndex) {
              header = 'Email'; // Use "Email" for the detected email column
            } else {
              header = `Column ${index + 1}`; // Default naming for other columns
            }
            return {
              field: key,
              header,
            };
          });
          console.log(`Email column detected at index ${emailColumnIndex}.`);
        } else {
          console.warn('No email column detected in the CSV data.');
          columns.value = keys.map((key, index) => ({
            field: key,
            header: `Column${index + 1}`, // Default naming for all columns
          }));
        }
      }
    } else {
      console.error('Parsed CSV content is empty or invalid.');
      columns.value = []; // Set to an empty array to avoid errors
    }

    // // Align `contentJson.value` with required columns and map headers back to real field names
    // contentJson.value = contentJson.value
    //   .map((item: Contact) =>
    //     Object.fromEntries(
    //       Object.entries(csvArray).map(([realField, header]) => {
    //         const trimmedHeader = header.replace(/\s/g, ''); // https://github.com/iuccio/csvToJson/pull/68

    //         if (arraysFields.includes(realField)) {
    //           item[trimmedHeader] = item[trimmedHeader]
    //             ?.split(',')
    //             .filter((item) => item.length);
    //         }
    //         return [
    //           realField, // Use the real field name as the key
    //           item[trimmedHeader] || null, // Map the header back to its value
    //         ];
    //       }),
    //     ),
    //   )
    //   .filter((item) => item.email !== null); // Remove rows with no email

    // Should verify
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
