<template>
  <DataTable
    ref="myTable"
    scrollable
    scrollHeight="70vh"
    size="small"
    stripedRows
    v-model:filters="filters"
    @filter="onFilter($event)"
    v-model:selection="selectedContacts"
    :value="contacts"
    paginator
    :rows="150"
    :rows-per-page-options="[150, 500, 1000]"
    dataKey="id"
    filterDisplay="menu"
    :globalFilterFields="['name', 'email']"
    removableSort
  >
    <template #empty> No contacts found. </template>
    <template #header>
      <div class="flex justify-content-between">
        <IconField iconPosition="left">
          <InputIcon>
            <i class="pi pi-search" />
          </InputIcon>
          <InputText
            v-model="filters['global'].value"
            placeholder="Search contacts"
          />
        </IconField>
        <Button
          type="button"
          icon="pi pi-filter-slash"
          label="Clear"
          outlined
          @click="clearFilter()"
        />
        <Button
          icon="pi pi-external-link"
          label="Export CSV"
          @click="exportCSV()"
        />
      </div>
    </template>

    <!-- Select -->
    <Column selectionMode="multiple" headerStyle="width: 3rem"></Column>

    <!-- Contacts -->
    <Column field="contacts">
      <template #header>
        <div>Contacts</div>
        <!-- <div class="p-column-filter p-fluid p-column-filter-menu">
			<IconField iconPosition="left">
			  <InputIcon>
				<i class="pi pi-search" />
			  </InputIcon>
			  <InputText
				v-model="filters['global'].value"
				placeholder="Search contacts"
			  />
			</IconField>
		  </div> -->
      </template>
      <template #body="{ data }">
        <div class="flex justify-between">
          <div>
            <template v-if="data.name">
              <div class="font-medium">{{ data.name }}</div>
              <div>{{ data.email }}</div>
            </template>
            <div v-else class="font-medium">{{ data.email }}</div>
          </div>
          <div>
            <Button
              rounded
              text
              icon="pi pi-copy"
              aria-label="Copy"
              @click="copyContact(data.name, data.email)"
            />
          </div>
        </div>
      </template>
    </Column>

    <!-- Occurrence -->
    <Column field="occurrence" header="Occurrence" sortable dataType="numeric">
      <template #filter="{ filterModel }">
        <InputNumber v-model="filterModel.value" />
      </template>
    </Column>

    <!-- Recency -->
    <Column field="recency" header="Recency" sortable dataType="date">
      <template #body="{ data }">
        {{ data.recency.toLocaleString() }}
      </template>
      <template #filter="{ filterModel }">
        <Calendar
          v-model="filterModel.value"
          showIcon
          class="p-column-filter"
        />
      </template>
    </Column>

    <!-- Replied conversations -->
    <Column
      field="replied_conversations"
      header="Replied conversations"
      dataType="numeric"
      sortable
    >
      <template #filter="{ filterModel }">
        <InputNumber v-model="filterModel.value" />
      </template>
    </Column>

    <!-- Tags -->
    <Column
      field="tags"
      header="Tags"
      sortable
      :showFilterOperator="false"
      :showFilterMatchModes="false"
    >
      <template #body="{ data }">
        <Tag v-for="tag of data.tags" :value="tag" severity="success" />
      </template>
      <template #filter="{ filterModel }">
        <MultiSelect
          v-model="filterModel.value"
          :options="tags"
          placeholder="Any"
          class="p-column-filter"
          style="min-width: 14rem"
          display="chip"
        >
          <template #option="{ option }">
            <Tag :value="option" severity="success" />
          </template>
        </MultiSelect>
      </template>
    </Column>

    <!-- Status -->
    <Column
      field="status"
      header="Status"
      sortable
      :showFilterOperator="false"
      :showFilterMatchModes="false"
    >
      <template #body="{ data }">
        <Tag
          v-if="data.status"
          :value="data.status"
          :severity="getStatusLabel(data.status)"
        />
      </template>
      <template #filter="{ filterModel }">
        <Dropdown
          v-model="filterModel.value"
          :options="statuses"
          placeholder="Select One"
          class="p-column-filter"
          showClear
        >
          <template #option="slotProps">
            <Tag
              :value="slotProps.option"
              :severity="getStatusLabel(slotProps.option)"
            />
          </template>
        </Dropdown>
      </template>
    </Column>

    <template #paginatorstart>
      {{ selectedContactsLength }}/{{ filteredContactsLength }}/{{
        contactsLength
      }}
    </template>
  </DataTable>
</template>

<script setup lang="ts">
import { FilterMatchMode, FilterOperator, FilterService } from "primevue/api";
import type { DataTableFilterEvent } from "primevue/datatable";
import type { Contact } from "~/types/contact";

const LIST_INCLUDES = ref();
FilterService.register(LIST_INCLUDES.value, (value, filter) => {
  return value.includes(filter);
});

const tags = ["professional", "newsletter", "personal", "group", "chat"];
const statuses = ["unknown", "invalid", "risky", "valid"];
function getStatusLabel(status: string) {
  if (!status) return;
  const currentStatus = status.toLowerCase();
  switch (currentStatus) {
    case "unknown":
      return "secondary";
    case "invalid":
      return "danger";
    case "risky":
      return "warning";
    case "valid":
      return "success";
  }
}

const USER_ID = "9e217eca-0358-4b09-8a69-7a5269b2d864";
const filters = ref();

const supabase = useSupabaseClient();

function convertDates(data: Contact[]) {
  return [...data].map((d) => {
    if (d.recency) {
      d.recency = new Date(d.recency);
    }
    return d;
  });
}

const data = ref<Contact[] | null>([]);

const channel = ref();
const contactsCache = new Map();

onNuxtReady(() => {
  setInterval(() => {
    data.value = Array.from(contactsCache.values());
    data.value = convertDates(data.value);
  }, 5000);

  channel.value = supabase
    .channel("*")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "persons",
        filter: `user_id=eq.${USER_ID}`,
      },
      (payload) => {
        const newContact = payload.new as Contact;
        if (newContact) {
          contactsCache.set(newContact.email, newContact);
        }
      }
    )
    .subscribe();
});

onUnmounted(() => {
  supabase.removeChannel(channel.value);
});

const contacts = computed(() => data.value);
const contactsLength = computed(() => contacts.value?.length);
const selectedContacts = ref([]);
const selectedContactsLength = computed(() => selectedContacts.value.length);
const initFilters = () => {
  filters.value = {
    global: {
      value: null,
      matchMode: FilterMatchMode.CONTAINS,
    },

    // Recency
    recency: {
      operator: FilterOperator.AND,
      constraints: [
        {
          value: null,
          matchMode: FilterMatchMode.DATE_IS,
        },
      ],
    },

    // Occurrence
    occurrence: {
      operator: FilterOperator.OR,
      constraints: [
        {
          value: null,
          matchMode: FilterMatchMode.GREATER_THAN_OR_EQUAL_TO,
        },
      ],
    },

    // Replied Conversations
    replied_conversations: {
      operator: FilterOperator.OR,
      constraints: [
        {
          value: null,
          matchMode: FilterMatchMode.GREATER_THAN_OR_EQUAL_TO,
        },
      ],
    },

    // Tags
    tags: {
      operator: FilterOperator.OR,
      constraints: [
        {
          value: null,
          matchMode: LIST_INCLUDES.value,
        },
      ],
    },
    // Status
    status: {
      operator: FilterOperator.OR,
      constraints: [
        {
          value: null,
          matchMode: FilterMatchMode.EQUALS,
        },
      ],
    },
  };
};

initFilters();

const clearFilter = () => {
  initFilters();
};
const myTable = ref();

const exportCSV = () => {
  console.log("Export to CSV");
  myTable.value.exportCSV();
};
const filteredContacts = ref([]);
function onFilter(event: DataTableFilterEvent) {
  selectedContacts.value = [];
  filteredContacts.value = event.filteredValue;
  console.log(event.filteredValue);
}
const filteredContactsLength = computed(() => filteredContacts.value.length);
function copyContact(name: string, email: string) {
  console.log(name && name !== "" ? `${name} <${email}>` : `<${email}>`);
}
</script>
