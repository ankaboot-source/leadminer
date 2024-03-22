<template>
  <CreditsDialog
    ref="CreditsDialogRef"
    engagement-type="contacts"
    action-type="download"
    @secondary-action="exportTable"
  />
  <DataTable
    v-model:selection="selectedContacts"
    v-model:filters="filters"
    scrollable
    scroll-height="60vh"
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
    current-page-report-template="({currentPage} of {totalPages}) {totalRecords}"
    :rows="150"
    :rows-per-page-options="[150, 500, 1000]"
    :is-loading="isLoading"
    @filter="onFilter($event)"
    @select-all-change="onSelectAllChange"
    @row-select="onRowSelect"
    @row-unselect="onRowUnselect"
  >
    <template #empty>
      {{
        defaultOnFilters !== 0 && contactsLength !== 0
          ? 'No contacts found. Try adjusting or clearing filters'
          : 'No contacts found.'
      }}
    </template>
    <template #loading>{{ loadingLabel }}</template>
    <template #header>
      <div class="flex items-center gap-1">
        <Button
          type="button"
          :icon="isLoading ? 'pi pi-refresh pi-spin' : 'pi pi-refresh'"
          text
          @click="refreshTable()"
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
        <div>Contacts</div>
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
          :disable="isExportDisabled"
          @click="verifyExport"
        />
        <!-- Settings -->
        <Button
          icon="pi pi-sliders-h"
          :badge="defaultOnFilters ? defaultOnFilters.toString() : undefined"
          @click="toggleSettingsPanel"
        />
        <OverlayPanel ref="settingsPanel">
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
              <div v-tooltip.left="'- Less than 3 years \n- GDPR Proof'">
                Recent contacts
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
    <Column selection-mode="multiple" />

    <!-- Contacts -->
    <Column field="email">
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

    <!-- Occurrence -->
    <Column
      field="occurrence"
      header="Occurrence"
      sortable
      data-type="numeric"
      :show-filter-operator="false"
      :show-add-button="false"
    >
      <template #filter="{ filterModel }">
        <InputNumber v-model="filterModel.value" />
      </template>
    </Column>

    <!-- Recency -->
    <Column field="recency" header="Recency" sortable data-type="date">
      <template #body="{ data }">
        {{ data.recency.toLocaleString() }}
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
      field="replied_conversations"
      header="Replies"
      data-type="numeric"
      sortable
      :show-filter-operator="false"
      :show-add-button="false"
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
      :show-filter-operator="false"
      :show-filter-match-modes="false"
      :show-add-button="false"
      :filter-menu-style="{ width: '14rem' }"
    >
      <template #body="{ data }">
        <div class="flex flex-wrap gap-1">
          <Tag
            v-for="tag of data.tags"
            :key="tag"
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
      filter-field="status"
      header="Reachable"
      sortable
      :show-filter-operator="false"
      :show-filter-match-modes="false"
      :show-add-button="false"
      :filter-menu-style="{ width: '14rem' }"
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
import {
  type RealtimeChannel,
  type RealtimePostgresChangesPayload,
  type User,
} from '@supabase/supabase-js';
import { FilterMatchMode, FilterOperator, FilterService } from 'primevue/api';
import type {
  DataTableFilterEvent,
  DataTableSelectAllChangeEvent,
} from 'primevue/datatable';
import { exportFile } from 'quasar';
import { useLeadminerStore } from '../../stores/leadminer';
import type { Contact } from '../../types/contact';

import CreditsDialog from '@/components/Credits/InsufficientCreditsDialog.vue';

const $toast = useToast();

const tags = ['professional', 'newsletter', 'personal', 'group', 'chat'];
const statuses = ['UNKNOWN', 'INVALID', 'RISKY', 'VALID'];

function getStatusColor(status: string) {
  if (!status) return undefined;
  switch (status) {
    case 'UNKNOWN':
      return 'secondary';
    case 'INVALID':
      return 'danger';
    case 'RISKY':
      return 'warning';
    case 'VALID':
      return 'success';
    default:
      return undefined;
  }
}

function getTagColor(tag: string) {
  if (!tag) return undefined;
  switch (tag) {
    case 'personal':
      return 'success';
    case 'professional':
      return 'primary';
    case 'newsletter':
      return 'secondary';
    case 'group':
      return 'secondary';
    case 'chat':
      return 'secondary';
    default:
      return undefined;
  }
}

const leadminerStore = useLeadminerStore();
const rows = ref<Contact[]>([]);
const isLoading = ref(true);
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

function convertDates(data: Contact[]) {
  return [...data].map((d) => {
    if (d.recency) {
      d.recency = new Date(d.recency);
    }
    return d;
  });
}
async function getContacts(userId: string): Promise<Contact[]> {
  const { data, error } = await $supabaseClient.rpc(
    'get_contacts_table',
    // @ts-expect-error: Issue with @nuxt/supabase typing
    { userid: userId }
  );

  if (error) {
    throw error;
  }

  return data ? convertDates(data) : [];
}

async function syncTable() {
  loadingLabel.value = 'Syncing...';
  const user = $user.value as User;
  rows.value = await getContacts(user.id);
  isLoading.value = false;
}

watch(activeMiningTask, async (isActive) => {
  if (isActive) {
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
    isLoading.value = false;
  }
});

await useAsyncData('refine', () => refineContacts());
await useAsyncData('contacts', () => syncTable());

onUnmounted(() => {
  clearInterval(refreshInterval);
});

/* *** Filters *** */
const filters = ref();
const searchContactModel = ref('');
const ANY_SELECTED = ref('ANY_SELECTED');
FilterService.register(ANY_SELECTED.value, (value, filter) =>
  !filter ? true : filter.some((item: string) => value.includes(item))
);
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
function onFilter(event: DataTableFilterEvent) {
  filteredContacts.value = event.filteredValue;
}

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
  selectAll.value = selectedContacts.value.length === contactsLength.value;
};
const onRowUnselect = () => {
  // When a row is unchecked, the header checkbox must always be in an unchecked state.
  selectAll.value = false;
};

function copyContact(name: string, email: string) {
  $toast.add({
    severity: 'success',
    summary: 'Copied contact!',
    detail: 'Copied contact to clipboard',
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
    leadminerStore.loadingStatusDns
);
function getFileName() {
  const { email } = $user.value as User;
  const currentDatetime = new Date().toISOString().slice(0, 10);
  const fileName = `leadminer-${email}-${currentDatetime}`;
  return fileName;
}
async function exportTable() {
  await $api('/imap/export/csv', {
    async onResponse({ response }) {
      if (response.status === 204) {
        return;
      }
      const status = exportFile(
        `${getFileName()}.csv`,
        response._data,
        'text/csv'
      );

      if (status !== true) {
        throw new Error('Browser denied file download...');
      }

      await leadminerStore.syncUserCredits();

      $toast.add({
        severity: 'success',
        summary: 'Emails exported successfully',
        life: 3000,
      });
    },
  });
}

const openCreditModel = ({
  total,
  available,
}: {
  total: number;
  available: number;
}) => {
  if (total === undefined || available === undefined) {
    return $toast.add({
      severity: 'error',
      summary: 'Error when verifying export CSV',
      life: 3000,
    });
  }
  return CreditsDialogRef.value?.openModal(total, available);
};

async function verifyExport() {
  await $api('/imap/export/csv/verify', {
    async onResponse({ response }) {
      if (response.status === 204) {
        return;
      }

      if (response.status !== 206) {
        await exportTable();
      } else {
        openCreditModel(response._data);
      }
    },
  });
}

/* *** Settings *** */
const settingsPanel = ref();
function toggleSettingsPanel(event: Event) {
  settingsPanel.value.toggle(event);
}
const validToggle = ref(true); // status: valid
function onValidToggle() {
  filters.value.status.value = validToggle.value ? ['VALID'] : null;
}
const discussionsToggle = ref(true); // replies: >=1
function onDiscussionsToggle() {
  filters.value.replied_conversations.value = discussionsToggle.value
    ? 1
    : null;
}

const recentToggle = ref(true); // recency: <3 years
function onRecentToggle(yearsAgo: number) {
  filters.value.recency.constraints[0].value = recentToggle.value
    ? new Date(new Date().setFullYear(new Date().getFullYear() - yearsAgo))
    : null;
}
function clearFilter() {
  validToggle.value = false;
  discussionsToggle.value = false;
  recentToggle.value = false;
  searchContactModel.value = '';
  initFilters();
}
function initDefaultFilters() {
  onValidToggle();
  onDiscussionsToggle();
  onRecentToggle(3);
}
initDefaultFilters();
const defaultOnFilters = computed(
  () =>
    Number(validToggle.value) +
    Number(discussionsToggle.value) +
    Number(recentToggle.value)
);
</script>
