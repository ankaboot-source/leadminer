<template>
  <Toast />
  <DataTable
    ref="myTable"
    scrollable
    scrollHeight="70vh"
    size="small"
    stripedRows
    @filter="onFilter($event)"
    v-model:selection="selectedContacts"
    :selectAll="selectAll"
    @select-all-change="onSelectAllChange"
    @row-select="onRowSelect"
    @row-unselect="onRowUnselect"
    :value="contacts"
    exportFilename="contacts"
    dataKey="email"
    paginator
    filterDisplay="menu"
    v-model:filters="filters"
    :globalFilterFields="['email', 'name']"
    removableSort
    paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
    currentPageReportTemplate="({currentPage} of {totalPages}) {totalRecords}"
    :rows="150"
    :rows-per-page-options="[150, 500, 1000]"
    :loading="loading"
  >
    <template #empty> No contacts found. </template>
    <template #header>
      <div class="flex items-center gap-1">
        <Button
          type="button"
          :icon="loading ? 'pi pi-refresh pi-spin' : 'pi pi-refresh'"
          text
          @click="fetchTable()"
        />
        <div>
          <template
            v-if="
              selectedContactsLength !== 0 &&
              selectedContactsLength !== contactsLength
            "
          >
            {{ selectedContactsLength }} /
          </template>
          {{ contactsLength }}
        </div>
        <div class="grow" />
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
        <!-- Settings -->
        <Button icon="pi pi-sliders-h" @click="toggleSettingsPanel" />
        <OverlayPanel ref="settingsPanel">
          <span class="font-medium text-900 block mb-2"> Settings </span>
          <ul class="list-none p-0 m-0 flex flex-col gap-3">
            <li class="flex justify-between">
              <div>Certified valid</div>
              <InputSwitch
                v-model="validToggle"
                @update:model-value="onValidToggle"
              />
            </li>
            <li class="flex justify-between gap-2">
              <div>At least one discussion</div>
              <InputSwitch
                v-model="discussionsToggle"
                @update:model-value="onDiscussionsToggle"
              />
            </li>
            <li class="flex justify-between gap-2">
              <div>Only real persons</div>
              <InputSwitch
                v-model="personsToggle"
                @update:model-value="onPersonsToggle"
              />
            </li>
            <li class="flex justify-between gap-2">
              <div v-tooltip.left="'- Less than 3 years \n- GDPR Proof'">
                Recent
              </div>
              <InputSwitch
                v-model="recentToggle"
                @update:model-value="onRecentToggle(3)"
              />
            </li>
          </ul>
        </OverlayPanel>
      </div>
    </template>

    <!-- Select -->
    <Column selectionMode="multiple" />

    <!-- Contacts -->
    <Column field="email">
      <template #header>
        <div>Contacts</div>
        <div class="p-column-filter p-fluid p-column-filter-menu">
          <IconField iconPosition="left">
            <InputIcon class="pi pi-search" />
            <InputText
              v-model="searchContactModel"
              placeholder="Search contacts"
            />
          </IconField>
        </div>
      </template>
      <template #body="{ data }">
        <div class="flex justify-between items-center">
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
    <Column
      field="occurrence"
      header="Occurrence"
      sortable
      dataType="numeric"
      :showFilterOperator="false"
      :showAddButton="false"
    >
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
      header="Replies"
      dataType="numeric"
      sortable
      :showFilterOperator="false"
      :showAddButton="false"
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
      :showAddButton="false"
      :filterMenuStyle="{ width: '14rem' }"
    >
      <template #body="{ data }">
        <div class="flex flex-wrap gap-1">
          <Tag
            v-for="tag of data.tags"
            :value="tag"
            :severity="getTagColor(tag)"
            class="capitalize"
          />
        </div>
      </template>
      <template #filter="{ filterModel }">
        <MultiSelect
          v-model="filterModel.value"
          :options="tags"
          placeholder="Any"
          class="p-column-filter"
          display="chip"
        >
          <template #option="{ option }">
            <Tag
              :value="option"
              :severity="getTagColor(option)"
              class="capitalize"
            />
          </template>
        </MultiSelect>
      </template>
    </Column>

    <!-- Status | Reachable -->
    <Column
      field="status"
      filterField="status"
      header="Reachable"
      sortable
      :showFilterOperator="false"
      :showFilterMatchModes="false"
      :showAddButton="false"
      :filterMenuStyle="{ width: '14rem' }"
    >
      <template #body="{ data }">
        <Tag
          v-if="data.status"
          :value="data.status"
          :severity="getStatusColor(data.status)"
        />
      </template>
      <template #filter="{ filterModel }">
        <MultiSelect
          v-model="filterModel.value"
          :options="statuses"
          placeholder="Any"
          class="p-column-filter"
          display="chip"
        >
          <template #option="{ option }">
            <Tag :value="option" :severity="getStatusColor(option)" />
          </template>
        </MultiSelect>
      </template>
    </Column>
  </DataTable>
</template>

<script setup lang="ts">
import { FilterMatchMode, FilterOperator, FilterService } from "primevue/api";
import type {
  DataTableFilterEvent,
  DataTableSelectAllChangeEvent,
} from "primevue/datatable";
import { useToast } from "primevue/usetoast";
import type { Contact } from "~/types/contact";
const toast = useToast();

const tags = ["professional", "newsletter", "personal", "group", "chat"];
const statuses = ["UNKNOWN", "INVALID", "RISKY", "VALID"];

function getStatusColor(status: string) {
  if (!status) return;
  switch (status) {
    case "UNKNOWN":
      return "secondary";
    case "INVALID":
      return "danger";
    case "RISKY":
      return "warning";
    case "VALID":
      return "success";
  }
}

function getTagColor(tag: string) {
  if (!tag) return;
  switch (tag) {
    case "personal":
      return "success";
    case "professional":
      return "primary";
    case "newsletter":
      return "secondary";
    case "group":
      return "secondary";
    case "chat":
      return "secondary";
  }
}

const USER_ID = "9e217eca-0358-4b09-8a69-7a5269b2d864";

const supabase = useSupabaseClient();

const data = ref<Contact[]>([]);
const contacts = computed(() => data.value);
const contactsLength = computed(() => contacts.value?.length);
const loading = ref(true);

function convertDates(data: Contact[]) {
  return [...data].map((d) => {
    if (d.recency) {
      d.recency = new Date(d.recency);
    }
    return d;
  });
}
async function fetchTable() {
  loading.value = true;
  const { data: mydata } = await useAsyncData("contacts", async () => {
    const { data } = await supabase.rpc("get_contacts_table", {
      userid: USER_ID,
    });
    return data ? convertDates(data) : [];
  });
  loading.value = false;
  data.value = mydata.value ?? [];
}
await fetchTable();

/*** Selection ***/

const selectedContacts = ref<Contact[]>([]);
const selectedContactsLength = computed(() => selectedContacts.value.length);
const selectAll = ref(false);

const onSelectAllChange = (event: DataTableSelectAllChangeEvent) => {
  if (event.checked) {
    selectAll.value = true;
    selectedContacts.value = filteredContacts.value; // all data according to your needs
  } else {
    selectAll.value = false;
    selectedContacts.value = [];
  }
};
const onRowSelect = () => {
  // This control can be completely managed by you.
  selectAll.value = selectedContacts.value.length === contactsLength.value;
};
const onRowUnselect = () => {
  // When a row is unchecked, the header checkbox must always be in an unchecked state.
  selectAll.value = false;
};

/*** Filters ***/

const filters = ref();
const searchContactModel = ref("");
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return function (...args: Parameters<T>): void {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), wait);
  };
}
const debouncedUpdate = debounce((newValue: string) => {
  filters.value.global.value = newValue;
}, 500);
watch(searchContactModel, (newValue: string) => {
  debouncedUpdate(newValue);
});

const ANY_SELECTED = ref("ANY_SELECTED");
FilterService.register(ANY_SELECTED.value, (value, filter) => {
  return !filter ? true : filter.some((item: string) => value.includes(item));
});

const initFilters = () => {
  filters.value = {
    global: {
      value: null,
      matchMode: FilterMatchMode.CONTAINS,
    },

    // Contact
    name: {
      value: null,
      matchMode: FilterMatchMode.CONTAINS,
    },
    email: {
      value: null,
      matchMode: FilterMatchMode.CONTAINS,
    },

    // Recency
    recency: {
      operator: FilterOperator.AND,
      constraints: [{ value: null, matchMode: FilterMatchMode.DATE_AFTER }],
    },

    // Occurrence
    occurrence: {
      value: null,
      matchMode: FilterMatchMode.GREATER_THAN_OR_EQUAL_TO,
    },

    // Replied Conversations
    replied_conversations: {
      value: null,
      matchMode: FilterMatchMode.GREATER_THAN_OR_EQUAL_TO,
    },

    // Tags
    tags: { value: null, matchMode: ANY_SELECTED.value },

    // Status
    status: { value: null, matchMode: FilterMatchMode.IN },
  };
};
initFilters();
const clearFilter = () => {
  validToggle.value = false;
  discussionsToggle.value = false;
  personsToggle.value = false;
  recentToggle.value = false;
  searchContactModel.value = "";
  initFilters();
};

const filteredContacts = ref<Contact[]>([]);
function onFilter(event: DataTableFilterEvent) {
  filteredContacts.value = event.filteredValue;
}
const filteredContactsLength = computed(() => filteredContacts.value.length);

/*** Export CSV ***/
const myTable = ref();

const exportCSV = () => {
  myTable.value.exportCSV(
    selectedContactsLength.value !== 0 &&
      selectedContactsLength.value !== contactsLength.value
      ? { selectionOnly: true }
      : {}
  );
};

function copyContact(name: string, email: string) {
  toast.add({
    severity: "success",
    summary: "Copied contact!",
    detail: "Copied contact to clipboard",
    life: 3000,
  });
  navigator.clipboard.writeText(
    name && name !== "" ? `${name} <${email}>` : `<${email}>`
  );
}

/*** Settings ***/
const settingsPanel = ref();
function toggleSettingsPanel(event: Event) {
  settingsPanel.value.toggle(event);
}
const validToggle = ref(true); // status: valid
function onValidToggle() {
  filters.value.status.value = validToggle.value ? ["VALID"] : null;
}
const discussionsToggle = ref(true); // replies: >=1
function onDiscussionsToggle() {
  filters.value.replied_conversations.value = discussionsToggle.value
    ? 1
    : null;
}
const personsToggle = ref(true); // tags: professional, personal
function onPersonsToggle() {
  filters.value.tags.value = personsToggle.value
    ? ["professional", "personal"]
    : null;
}
const recentToggle = ref(true); // recency: <3 years
function onRecentToggle(yearsAgo: number) {
  filters.value.recency.constraints[0].value = recentToggle.value
    ? new Date(new Date().setFullYear(new Date().getFullYear() - yearsAgo))
    : null;
}
function toggleToggles() {
  onValidToggle();
  onDiscussionsToggle();
  onPersonsToggle();
  onRecentToggle(3);
}
toggleToggles();

// // Realtime
// const channel = ref();
// const contactsCache = new Map();

// onNuxtReady(() => {
//   setInterval(() => {
//     data.value = Array.from(contactsCache.values());
//     data.value = convertDates(data.value);
//   }, 5000);

//   channel.value = supabase
//     .channel("*")
//     .on(
//       "postgres_changes",
//       {
//         event: "*",
//         schema: "public",
//         table: "persons",
//         filter: `user_id=eq.${USER_ID}`,
//       },
//       (payload) => {
//         const newContact = payload.new as Contact;
//         if (newContact) {
//           contactsCache.set(newContact.email, newContact);
//         }
//       }
//     )
//     .subscribe();
// });

// onUnmounted(() => {
//   supabase.removeChannel(channel.value);
// });

</script>


