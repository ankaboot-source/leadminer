<template>
  <CreditsDialog
    ref="CreditsDialogRef"
    engagement-type="contacts"
    action-type="download"
    @secondary-action="exportTable(true)"
  />
  <DataTable
    ref="TableRef"
    v-model:selection="selectedContacts"
    v-model:filters="filters"
    resizable-columns
    reorderable-columns
    show-gridlines
    row-hover
    highlight-on-select
    :class="isFullscreen ? 'fullscreenTable' : ''"
    scrollable
    :scroll-height="scrollHeight"
    size="small"
    striped-rows
    :select-all="selectAll"
    :value="contacts"
    data-key="email"
    paginator
    filter-display="menu"
    :global-filter-fields="['email', 'name']"
    removable-sort
    paginator-template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
    :rows="150"
    :rows-per-page-options="[150, 500, 1000]"
    :loading="isLoading"
    @filter="onFilter($event)"
    @select-all-change="onSelectAllChange"
    @row-select="onRowSelect"
    @row-unselect="onRowUnselect"
  >
    <template #empty>
      <div class="text-center py-5">
        <div class="font-semibold">No contacts found</div>
        <div v-if="areToggledFilters !== 0 && contactsLength !== 0">
          Try clearing filters
        </div>
      </div>
    </template>
    <template #loading>
      <div class="text-center">
        <ProgressSpinner />
        <div class="font-semibold text-white">{{ loadingLabel }}</div>
      </div>
    </template>
    <template #header>
      <div class="flex items-center gap-1">
        <!-- This is a workaround as tooltip doesn't work when component is `disabled`-->
        <div
          v-tooltip.top="
            isExportDisabled && 'Select at least one contact to export'
          "
        >
          <Button
            class="mr-2"
            icon="pi pi-external-link"
            :label="screenStore.size.md ? 'Export CSV' : undefined"
            :disabled="isExportDisabled"
            @click="exportTable()"
          />
        </div>
        <div>
          <template v-if="!implicitSelectAll">
            {{ implicitlySelectedContactsLength }} /
          </template>
          {{ contactsLength }} Contacts
        </div>
        <div class="grow" />
        <Button
          :disabled="isDefaultFilters"
          icon="pi pi-filter-slash"
          :label="screenStore.size.md ? 'Clear' : undefined"
          outlined
          @click="clearFilter()"
        />
        <!-- Settings -->
        <Button @click="toggleSettingsPanel">
          <span class="p-button-label">
            <i
              v-if="areToggledFilters > 0"
              v-badge="areToggledFilters.toString()"
              class="pi pi-sliders-h"
            />
            <i v-else class="pi pi-sliders-h" />
          </span>
        </Button>
        <OverlayPanel ref="settingsPanel">
          <ul class="list-none p-0 m-0 flex flex-col gap-3">
            <li class="flex justify-between">
              <div
                v-tooltip.left="'Ensure the deliverability of your campaign'"
              >
                Only valid contacts
              </div>
              <InputSwitch
                v-model="validToggle"
                @update:model-value="onValidToggle"
              />
            </li>
            <li class="flex justify-between gap-2">
              <div
                v-tooltip.left="
                  'Contacts who previously engaged with you perform best'
                "
              >
                At least one reply
              </div>
              <InputSwitch
                v-model="discussionsToggle"
                @update:model-value="onDiscussionsToggle"
              />
            </li>
            <li class="flex justify-between gap-2">
              <div
                v-tooltip.left="
                  `- Less than ${recentYearsAgo} years \n- GDPR Proof`
                "
              >
                Recent contacts
              </div>
              <InputSwitch
                v-model="recentToggle"
                @update:model-value="onRecentToggle"
              />
            </li>
            <Divider class="my-0" />
            <MultiSelect
              v-model="visibleColumns"
              :options="visibleColumnsOptions"
              :option-disabled="disabledColumns"
              option-label="label"
              option-value="value"
              placeholder="Visible columns"
              style="width: 14rem"
              selected-items-label="{0} Visible columns"
              :max-selected-labels="0"
              pt:option:class="capitalize"
              @change="onSelectColumnsChange"
            />
          </ul>
        </OverlayPanel>
        <Button
          :icon="`pi pi-window-${isFullscreen ? 'minimize' : 'maximize'}`"
          @click="isFullscreen = !isFullscreen"
        />
      </div>
    </template>

    <!-- Select -->
    <Column
      selection-mode="multiple"
      style="width: 38px"
      :pt="{
        rowCheckbox: {
          root: {
            style: { 'z-index': 0 },
          },
        },
      }"
    />

    <!-- Contacts -->
    <Column field="contacts">
      <template #header>
        <div class="pr-2">Contacts</div>
        <div class="p-column-filter p-fluid p-column-filter-menu">
          <IconField icon-position="left">
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
    <!-- Source -->
    <Column
      v-if="visibleColumns.includes('source')"
      field="source"
      sortable
      :show-filter-operator="false"
      :show-add-button="false"
    >
      <template #header>
        <div v-tooltip.top="'The email inbox this contact is mined from'">
          Source
        </div>
      </template>
      <template #filter="{ filterModel }">
        <InputText v-model="filterModel.value" />
      </template>
    </Column>
    <!-- Occurrence -->
    <Column
      v-if="visibleColumns.includes('occurrence')"
      field="occurrence"
      sortable
      data-type="numeric"
      :show-filter-operator="false"
      :show-add-button="false"
    >
      <template #header>
        <div v-tooltip.top="'Total occurrences of this contact'">
          Occurrence
        </div>
      </template>
      <template #filter="{ filterModel }">
        <InputNumber v-model="filterModel.value" />
      </template>
    </Column>

    <!-- Recency -->
    <Column
      v-if="visibleColumns.includes('recency')"
      field="recency"
      sortable
      data-type="date"
    >
      <template #header>
        <div v-tooltip.top="'When was the last time this contact was seen'">
          Recency
        </div>
      </template>
      <template #body="{ data }">
        {{ data.recency?.toLocaleDateString() }}
      </template>
      <template #filter="{ filterModel }">
        <Calendar
          v-model="filterModel.value"
          show-icon
          class="p-column-filter"
        />
      </template>
    </Column>

    <!-- Replied conversations -->
    <Column
      v-if="visibleColumns.includes('replied_conversations')"
      field="replied_conversations"
      data-type="numeric"
      sortable
      :show-filter-operator="false"
      :show-add-button="false"
    >
      <template #header>
        <div v-tooltip.top="'How many times this contact replied'">Replies</div>
      </template>
      <template #filter="{ filterModel }">
        <InputNumber v-model="filterModel.value" />
      </template>
    </Column>

    <!-- Tags -->
    <Column
      v-if="visibleColumns.includes('tags')"
      field="tags"
      sortable
      :show-filter-operator="false"
      :show-filter-match-modes="false"
      :show-add-button="false"
      :filter-menu-style="{ width: '14rem' }"
    >
      <template #header>
        <div v-tooltip.top="'Categorize your contacts'">Tags</div>
      </template>
      <template #body="{ data }">
        <div class="flex flex-wrap gap-1">
          <Tag
            v-for="tag of data.tags"
            :key="tag"
            :value="tag"
            :class="getTagColor(tag)"
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
              :class="getTagColor(option)"
              class="capitalize"
            />
          </template>
        </MultiSelect>
      </template>
    </Column>

    <!-- Status | Reachable -->
    <Column
      v-if="visibleColumns.includes('status')"
      field="status"
      filter-field="status"
      sortable
      :show-filter-operator="false"
      :show-filter-match-modes="false"
      :show-add-button="false"
      :filter-menu-style="{ width: '14rem' }"
    >
      <template #header>
        <div v-tooltip.top="'How reachable is your contact'">Reachable</div>
      </template>
      <template #body="{ data }">
        <Tag
          :value="getStatusLabel(data.status)"
          :severity="getStatusColor(data.status)"
        />
      </template>
      <template #filter="{ filterModel }">
        <MultiSelect
          v-model="filterModel.value"
          :options="statuses"
          option-value="value"
          option-label="label"
          placeholder="Any"
          class="p-column-filter"
          display="chip"
        >
          <template #option="{ option }">
            <Tag :value="option.label" :severity="option.color" />
          </template>
        </MultiSelect>
      </template>
    </Column>

    <!-- Recipient -->
    <Column
      v-if="visibleColumns.includes('recipient')"
      field="recipient"
      data-type="numeric"
      sortable
      :show-filter-operator="false"
      :show-add-button="false"
    >
      <template #header>
        <div v-tooltip.top="'How many times the contact has received emails'">
          Recipient
        </div>
      </template>
      <template #filter="{ filterModel }">
        <InputNumber v-model="filterModel.value" />
      </template>
    </Column>

    <!-- Sender -->
    <Column
      v-if="visibleColumns.includes('sender')"
      field="sender"
      data-type="numeric"
      sortable
      :show-filter-operator="false"
      :show-add-button="false"
    >
      <template #header>
        <div v-tooltip.top="'How many times the contact has sent emails'">
          Sender
        </div>
      </template>
      <template #filter="{ filterModel }">
        <InputNumber v-model="filterModel.value" />
      </template>
    </Column>

    <!-- Seniority -->
    <Column
      v-if="visibleColumns.includes('seniority')"
      field="seniority"
      sortable
      data-type="date"
    >
      <template #header>
        <div v-tooltip.top="'Oldest date this contact has been seen'">
          Seniority
        </div>
      </template>
      <template #body="{ data }">
        {{ data.seniority?.toLocaleDateString() }}
      </template>
      <template #filter="{ filterModel }">
        <Calendar
          v-model="filterModel.value"
          show-icon
          class="p-column-filter"
        />
      </template>
    </Column>
  </DataTable>
</template>

<script setup lang="ts">
import {
  type RealtimeChannel,
  type RealtimePostgresChangesPayload,
  type User,
} from '@supabase/supabase-js';
import { FilterMatchMode, FilterOperator, FilterService } from 'primevue/api';
import type DataTable from 'primevue/datatable';
import type {
  DataTableFilterEvent,
  DataTableSelectAllChangeEvent,
} from 'primevue/datatable';

import CreditsDialog from '@/components/Credits/InsufficientCreditsDialog.vue';
import type { Contact } from '@/types/contact';
import { saveCSVFile } from '~/utils/csv';

const $toast = useToast();

const { tableData } = defineProps<{
  tableData: Contact[];
}>();

const tags = ['professional', 'newsletter', 'personal', 'group', 'chat'];

type Status = {
  value: 'VALID' | 'RISKY' | 'INVALID' | 'UNKNOWN' | null;
  label: 'VALID' | 'RISKY' | 'INVALID' | 'UNKNOWN' | 'UNVERIFIED';
  color: 'success' | 'warning' | 'danger' | 'secondary';
};

const statuses: Status[] = [
  { value: 'VALID', label: 'VALID', color: 'success' },
  { value: 'RISKY', label: 'RISKY', color: 'warning' },
  { value: 'INVALID', label: 'INVALID', color: 'danger' },
  { value: 'UNKNOWN', label: 'UNKNOWN', color: 'secondary' },
  { value: null, label: 'UNVERIFIED', color: 'secondary' },
];

function getStatusColor(value: Status['value']): Status['color'] {
  return (
    statuses.find((status) => status.value === value)?.color ?? 'secondary'
  );
}
function getStatusLabel(value: Status['value']): Status['label'] {
  return value ?? 'UNVERIFIED';
}
function getTagColor(tag: string) {
  if (!tag) return undefined;
  switch (tag) {
    case 'personal':
      return 'bg-red-100 text-red-700';
    case 'professional':
      return 'bg-blue-100 text-blue-700';
    case 'newsletter':
      return 'p-tag-secondary';
    case 'group':
      return 'p-tag-secondary';
    case 'chat':
      return 'p-tag-secondary';
    default:
      return undefined;
  }
}

const leadminerStore = useLeadminerStore();
const rows = ref<Contact[]>(tableData);
const isLoading = ref(false);
const loadingLabel = ref('');
const contacts = computed(() => rows.value);
const contactsLength = computed(() => contacts.value?.length);

let contactsCache = new Map<string, Contact>();

const activeMiningTask = computed(
  () => leadminerStore.miningTask !== undefined
);

let refreshInterval: number;
let subscription: RealtimeChannel;

const $user = useSupabaseUser();
const $supabaseClient = useSupabaseClient();

/* *** Filters *** */
const filters = ref();
const searchContactModel = ref('');
const ANY_SELECTED = ref('ANY_SELECTED');
FilterService.register(ANY_SELECTED.value, (value, filter) =>
  !filter ? true : filter.some((item: string) => value.includes(item))
);
const defaultFilters = {
  global: {
    value: null,
    matchMode: FilterMatchMode.CONTAINS,
  },

  // Contacts
  name: {
    value: null,
    matchMode: FilterMatchMode.CONTAINS,
  },
  source: {
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

  // Replies
  replied_conversations: {
    value: null,
    matchMode: FilterMatchMode.GREATER_THAN_OR_EQUAL_TO,
  },

  // Tags
  tags: { value: null, matchMode: ANY_SELECTED.value },

  // Status
  status: { value: [], matchMode: FilterMatchMode.IN },

  // Recipient
  recipient: {
    value: null,
    matchMode: FilterMatchMode.GREATER_THAN_OR_EQUAL_TO,
  },

  // Sender
  sender: {
    value: null,
    matchMode: FilterMatchMode.GREATER_THAN_OR_EQUAL_TO,
  },

  // Seniority
  seniority: {
    operator: FilterOperator.AND,
    constraints: [{ value: null, matchMode: FilterMatchMode.DATE_AFTER }],
  },
};

const initFilters = () => {
  filters.value = JSON.parse(JSON.stringify(defaultFilters));
};
initFilters();

const isDefaultFilters = computed(
  () => JSON.stringify(filters.value) === JSON.stringify(defaultFilters)
);

// skipcq: JS-0323
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return function _(...args: Parameters<T>): void {
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

const filteredContacts = ref<Contact[]>([]);
const filteredContactsLength = computed(() => filteredContacts.value.length);

/* *** Settings *** */
const settingsPanel = ref();
function toggleSettingsPanel(event: Event) {
  settingsPanel.value.toggle(event);
}

const validToggle = ref(true); // status: valid
function onValidToggle(toggle?: boolean) {
  if (toggle !== undefined) {
    validToggle.value = toggle;
  }
  if (filters.value.status.value === null) {
    filters.value.status.value = [];
  }

  if (
    !(
      filters.value.status.value.length === 1 &&
      filters.value.status.value[0] === 'VALID'
    ) &&
    validToggle.value
  ) {
    filters.value.status.value = ['VALID'];
  } else if (
    filters.value.status.value.length === 1 &&
    filters.value.status.value[0] === 'VALID' &&
    !validToggle.value
  ) {
    filters.value.status.value = [];
  }
}
watch(
  () => filters.value.status.value,
  (newStatusValue) => {
    validToggle.value =
      newStatusValue.length === 1 && newStatusValue[0] === 'VALID';
  }
);

const discussionsToggle = ref(true); // replies: >=1
function onDiscussionsToggle(toggle?: boolean) {
  if (toggle !== undefined) {
    discussionsToggle.value = toggle;
  }
  filters.value.replied_conversations.value = discussionsToggle.value
    ? 1
    : null;
}
watch(
  () => filters.value.replied_conversations.value,
  (newRepliesValue) => {
    discussionsToggle.value = newRepliesValue === 1;
  }
);

const recentToggle = ref(true); // recency: <3 years
const recentYearsAgo = 3;
function onRecentToggle(toggle?: boolean) {
  if (toggle !== undefined) {
    recentToggle.value = toggle;
  }
  filters.value.recency.constraints?.splice(1);
  filters.value.recency.constraints[0].value = recentToggle.value
    ? new Date(
        new Date().setFullYear(new Date().getFullYear() - recentYearsAgo)
      )
    : null;
}

watch(
  () => filters.value.recency.constraints,
  (newRecencyConstraints) => {
    recentToggle.value =
      newRecencyConstraints.length === 1 &&
      newRecencyConstraints[0].value?.toLocaleDateString() ===
        new Date(
          new Date().setFullYear(new Date().getFullYear() - recentYearsAgo)
        ).toLocaleDateString();
  },
  { deep: true }
);

function clearFilter() {
  searchContactModel.value = '';
  onValidToggle(false);
  onDiscussionsToggle(false);
  onRecentToggle(false);
  initFilters();
}
function initToggleFilters() {
  onValidToggle(true);
  onDiscussionsToggle(true);
  onRecentToggle(true);
}
initToggleFilters();
const areToggledFilters = computed(
  () =>
    Number(validToggle.value) +
    Number(discussionsToggle.value) +
    Number(recentToggle.value)
);

function onFilter(event: DataTableFilterEvent) {
  filteredContacts.value = event.filteredValue;
}

function setupSubscription() {
  // We are 100% sure that the user is authenticated in this component
  const user = $user.value;
  subscription = $supabaseClient.channel('*').on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'persons',
      filter: `user_id=eq.${user?.id}`,
    },
    (payload: RealtimePostgresChangesPayload<Contact>) => {
      const newContact = payload.new as Contact;
      contactsCache.set(newContact.email, newContact);
    }
  );
}

function refreshTable() {
  const contactCacheLength = contactsCache.size;
  const hasNewContacts = contactCacheLength > contactsLength.value;

  if (hasNewContacts) {
    isLoading.value = true;
    rows.value = Array.from(contactsCache.values());
    isLoading.value = false;
  }
}

async function refineContacts() {
  loadingLabel.value = 'Refining contacts...';
  const user = $user.value;
  // @ts-expect-error: Issue with @nuxt/supabase typing
  const refine = await $supabaseClient.rpc('refine_persons', {
    userid: user?.id,
  });

  if (refine.error) {
    throw refine.error;
  }
}

async function syncTable() {
  loadingLabel.value = 'Syncing...';
  const user = $user.value as User;
  rows.value = await getContacts(user.id);
  isLoading.value = false;
}

watch(activeMiningTask, async (isActive) => {
  if (isActive) {
    clearFilter();
    // If mining is active, update refined persons every 3 seconds
    setupSubscription();
    subscription.subscribe();
    if (contactsLength.value > 0) {
      contactsCache = new Map(rows.value.map((row) => [row.email, row]));
    }
    refreshInterval = window.setInterval(() => {
      refreshTable();
    }, 5000);
  } else {
    // Close realtime and re-open again later
    if (subscription) {
      await subscription.unsubscribe();
    }
    clearInterval(refreshInterval);
    contactsCache.clear();
    isLoading.value = true;
    await refineContacts();
    await syncTable();
    initToggleFilters();
    isLoading.value = false;
  }
});

/* *** Selection *** */
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
  selectAll.value =
    selectedContactsLength.value === filteredContactsLength.value;
};
const onRowUnselect = () => {
  // When a row is unchecked, the header checkbox must always be in an unchecked state.
  selectAll.value = false;
};

const implicitlySelectedContacts = computed(() => {
  // If (Filter) & (No selection) : user implicitly selected all filtered contacts
  if (
    selectedContactsLength.value === 0 &&
    filteredContactsLength.value !== contactsLength.value
  ) {
    return filteredContacts.value;
  }
  // (Partial selection) : user explicitly selected contacts partially
  if (
    selectedContactsLength.value !== 0 &&
    selectedContactsLength.value !== contactsLength.value
  ) {
    return selectedContacts.value;
  }
  // If (selection of All or None) && (No filter) : user implicitly selected all contacts
  return contacts.value;
});
const implicitlySelectedContactsLength = computed(
  () => implicitlySelectedContacts.value.length
);

const implicitSelectAll = computed(
  () => implicitlySelectedContactsLength.value === contactsLength.value
);

function copyContact(name: string, email: string) {
  $toast.add({
    severity: 'success',
    summary: 'Contact copied',
    detail: 'This contact email address has been copied to your clipboard',
    life: 3000,
  });
  navigator.clipboard.writeText(
    name && name !== '' ? `${name} <${email}>` : `<${email}>`
  );
}

/* *** Export CSV *** */

const { $api } = useNuxtApp();
const CreditsDialogRef = ref<InstanceType<typeof CreditsDialog>>();
const isExportDisabled = computed(
  () =>
    rows.value.length === 0 ||
    activeMiningTask.value ||
    leadminerStore.loadingStatusDns ||
    !implicitlySelectedContactsLength.value
);
function getFileName() {
  const { email } = $user.value as User;
  const currentDatetime = new Date().toISOString().slice(0, 10);
  const fileName = `leadminer-${email}-${currentDatetime}`;
  return fileName;
}

const openCreditModel = (
  hasDeficientCredits: boolean,
  {
    total,
    available,
    availableAlready,
  }: {
    total: number;
    available: number;
    availableAlready: number;
  }
) => {
  if (total === undefined || available === undefined) {
    return $toast.add({
      severity: 'error',
      summary: 'Error when verifying export CSV',
      life: 3000,
    });
  }
  return CreditsDialogRef.value?.openModal(
    hasDeficientCredits,
    total,
    available,
    availableAlready ?? 0
  );
};

async function exportTable(partialExport = false) {
  // if !contactsToExport, then export all contacts
  const contactsToExport = implicitSelectAll.value
    ? undefined
    : JSON.stringify(
        implicitlySelectedContacts.value.map((item: Contact) => item.email)
      );

  await $api('/export/csv', {
    method: 'POST',
    body: {
      partialExport,
      contactsToExport,
    },
    onResponse({ response }) {
      if (response.status === 402 || response.status === 266) {
        openCreditModel(response.status === 402, response._data);
        return;
      }

      if (response.status === 200 || response.status === 206) {
        saveCSVFile(response._data, `${getFileName()}.csv`);

        $toast.add({
          severity: 'success',
          summary: 'CSV Export',
          detail: 'Your contacts are successfully exported.',
          life: 3000,
        });
      }
    },
  });
}

const isFullscreen = ref(false);

const visibleColumns = ref(['contacts', 'occurrence']);
const screenStore = useScreenStore();
onMounted(() => {
  screenStore.init();
  visibleColumns.value = [
    'contacts',
    ...(screenStore.width > 550 ? ['occurrence'] : []),
    ...(screenStore.width > 700 ? ['recency'] : []),
    ...(screenStore.width > 800 ? ['tags'] : []),
    ...(screenStore.width > 950 ? ['status'] : []),
  ];
});
const visibleColumnsOptions = [
  { label: 'Source', value: 'source' },
  { label: 'contacts', value: 'contacts' },
  { label: 'occurrence', value: 'occurrence' },
  { label: 'recency', value: 'recency' },
  { label: 'replies', value: 'replied_conversations' },
  { label: 'tags', value: 'tags' },
  { label: 'reachable', value: 'status' },
  { label: 'recipient', value: 'recipient' },
  { label: 'sender', value: 'sender' },
  { label: 'seniority', value: 'seniority' },
];
function disabledColumns(column: { label: string; value: string }) {
  return column.value === 'contacts';
}
function onSelectColumnsChange() {
  // PrimeVue bug fix: MultiSelect: Can deselect disabled options https://github.com/primefaces/primevue/issues/5490
  if (!visibleColumns.value.includes('contacts')) {
    visibleColumns.value.push('contacts');
  }
}

/* Table dynamic Height */
const TableRef = ref();
const tablePosTop = ref<number>(
  TableRef.value?.$el.getBoundingClientRect().top ?? 0
);

const tableHeight = ref('37vh');
const scrollHeight = computed(() =>
  !isFullscreen.value ? tableHeight.value : ''
);

onMounted(() => {
  function observeTop() {
    const resizeObserver = new ResizeObserver(() => {
      tablePosTop.value = TableRef.value?.$el.getBoundingClientRect().top;
    });
    resizeObserver.observe(TableRef.value?.$el);
  }
  observeTop();

  watchEffect(() => {
    tableHeight.value = `${screenStore.height - tablePosTop.value - 140}px`;
  });
});

onUnmounted(() => {
  screenStore.destroy();
  clearInterval(refreshInterval);
});
</script>

<style>
.p-datatable,
.p-datatable-wrapper {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}
.fullscreenTable {
  position: fixed;
  z-index: 3;
  background-color: white;
  max-width: 100vw;
  max-height: 100vh;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
}

/* 
  PrimeVue fix DataTable - table is leaking up behind table header
  https://github.com/primefaces/primevue-tailwind/issues/197
  tailwind.css:2 
*/
table.p-datatable-table {
  border-collapse: separate;
}
</style>
