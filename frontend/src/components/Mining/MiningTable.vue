<template>
  <CreditsDialog
    ref="CreditsDialogRef"
    engagement-type="contacts"
    action-type="download"
    @secondary-action="exportTable(true)"
  />
  <ContactInformationSidebar v-model:show="$contactInformationSidebar.status" />
  <DataTable
    ref="TableRef"
    v-model:selection="selectedContacts"
    v-model:filters="filtersStore.filters"
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
    :current-page-report-template="`({currentPage} ${t('of')} {totalPages})`"
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
        <div class="font-semibold">{{ t('no_contacts_found') }}</div>
        <div
          v-if="filtersStore.areToggledFilters !== 0 && contactsLength !== 0"
        >
          {{ t('try_clearing_filters') }}
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
          v-tooltip.top="isExportDisabled && t('select_at_least_one_contact')"
        >
          <Button
            icon="pi pi-external-link"
            :label="screenStore.size.md ? t('export_csv') : undefined"
            :disabled="isExportDisabled"
            @click="exportTable()"
          />
        </div>
        <div class="ml-2">
          <template v-if="!implicitSelectAll">
            {{ implicitlySelectedContactsLength.toLocaleString() }}
            /
          </template>
          {{ contactsLength.toLocaleString() }}
          {{ t('contacts') }}
        </div>
        <div class="grow" />
        <div>
          <Button
            :disabled="filtersStore.isDefaultFilters"
            icon="pi pi-filter-slash"
            :label="screenStore.size.md ? t('clear') : undefined"
            outlined
            @click="filtersStore.clearFilter()"
          />
        </div>
        <!-- Settings -->
        <div>
          <Button @click="toggleSettingsPanel">
            <span class="p-button-label">
              <i
                v-if="filtersStore.areToggledFilters > 0"
                v-badge="filtersStore.areToggledFilters.toString()"
                class="pi pi-sliders-h"
              />
              <i v-else class="pi pi-sliders-h" />
            </span>
          </Button>
          <Popover ref="settingsPanel">
            <ul class="list-none p-0 m-0 flex flex-col gap-3">
              <li class="flex justify-between">
                <div v-tooltip.left="t('ensure_deliverability')">
                  {{ t('only_valid_contacts') }}
                </div>
                <ToggleSwitch
                  v-model="filtersStore.validToggle"
                  @update:model-value="filtersStore.onValidToggle"
                />
              </li>
              <li class="flex justify-between gap-2">
                <div v-tooltip.left="t('contacts_best_performance')">
                  {{ t('at_least_one_reply') }}
                </div>
                <ToggleSwitch
                  v-model="filtersStore.discussionsToggle"
                  @update:model-value="filtersStore.onDiscussionsToggle"
                />
              </li>
              <li class="flex justify-between gap-2">
                <div
                  v-tooltip.left="
                    t('gdpr_proof', {
                      recentYearsAgo: filtersStore.recentYearsAgo,
                    })
                  "
                >
                  {{ t('recent_contacts') }}
                </div>
                <ToggleSwitch
                  v-model="filtersStore.recentToggle"
                  @update:model-value="filtersStore.onRecentToggle"
                />
              </li>
              <Divider class="my-0" />
              <MultiSelect
                v-model="visibleColumns"
                :options="visibleColumnsOptions"
                :option-disabled="disabledColumns"
                option-label="label"
                option-value="value"
                style="width: 14rem"
                :selected-items-label="
                  t('visible_columns', visibleColumns.length)
                "
                :max-selected-labels="0"
                @change="onSelectColumnsChange"
              />
            </ul>
          </Popover>
        </div>
        <div>
          <Button
            :icon="`pi pi-window-${isFullscreen ? 'minimize' : 'maximize'}`"
            @click="isFullscreen = !isFullscreen"
          />
        </div>
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
        <div class="pr-2">{{ t('contacts') }}</div>
        <div class="p-column-filter p-fluid p-column-filter-menu">
          <IconField icon-position="left">
            <InputIcon class="pi pi-search" />
            <InputText
              v-model="filtersStore.searchContactModel"
              :placeholder="t('search_contacts')"
            />
          </IconField>
        </div>
      </template>
      <template #body="{ data }">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-2 grow">
            <img
              v-if="data.image && visibleColumns.includes('image')"
              :src="data.image"
              style="width: 48px"
              class="cursor-pointer rounded-full"
              @click="openContactInformation(data)"
            />
            <span>
              <template v-if="data.name && visibleColumns.includes('name')">
                <div class="font-medium">{{ data.name }}</div>
                <div>{{ data.email }}</div>
              </template>
              <div v-else class="font-medium">{{ data.email }}</div>
            </span>
          </div>
          <div
            v-if="data.same_as && visibleColumns.includes('same_as')"
            class="flex gap-2 pt-1 pr-6"
          >
            <NuxtLink
              v-for="(same_as, index) in data.same_as"
              :key="index"
              :to="same_as"
              target="_blank"
              rel="noopener"
            >
              <i
                :class="`pi pi-${$contactInformationSidebar.getSameAsIcon(
                  same_as
                )}`"
                class="text-xl"
              />
            </NuxtLink>
          </div>
          <div>
            <Button
              rounded
              text
              icon="pi pi-id-card"
              :aria-label="t('contact_information')"
              @click="openContactInformation(data)"
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
        <div v-tooltip.top="t('source_definition')">
          {{ t('source') }}
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
        <div v-tooltip.top="t('occurence_definition')">
          {{ t('occurrence') }}
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
        <div v-tooltip.top="t('recency_definition')">
          {{ t('recency') }}
        </div>
      </template>
      <template #body="{ data }">
        {{ data.recency?.toLocaleDateString() }}
      </template>
      <template #filter="{ filterModel }">
        <DatePicker
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
        <div v-tooltip.top="t('replies_definition')">{{ t('replies') }}</div>
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
        <div v-tooltip.top="t('categorize_contacts')">{{ t('tags') }}</div>
      </template>
      <template #body="{ data }">
        <div class="flex flex-wrap gap-1">
          <Tag
            v-for="tag of data.tags"
            :key="tag"
            :value="getTagLabel(tag)"
            :severity="getTagColor(tag)"
            class="capitalize"
          />
        </div>
      </template>
      <template #filter="{ filterModel }">
        <MultiSelect
          v-model="filterModel.value"
          :options="tags()"
          option-value="value"
          option-label="label"
          :placeholder="t('any')"
          class="p-column-filter"
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
        <div v-tooltip.top="t('reachable_definition')">
          {{ t('reachable') }}
        </div>
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
          :options="statuses()"
          option-value="value"
          option-label="label"
          :placeholder="t('any')"
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
        <div v-tooltip.top="t('recipient_definition')">
          {{ t('recipient') }}
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
        <div v-tooltip.top="t('sender_definition')">
          {{ t('sender') }}
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
        <div v-tooltip.top="t('seniority_definition')">
          {{ t('seniority') }}
        </div>
      </template>
      <template #body="{ data }">
        {{ data.seniority?.toLocaleDateString() }}
      </template>
      <template #filter="{ filterModel }">
        <DatePicker
          v-model="filterModel.value"
          show-icon
          class="p-column-filter"
        />
      </template>
    </Column>

    <!-- Given name -->
    <Column
      v-if="visibleColumns.includes('given_name')"
      field="given_name"
      sortable
      :show-filter-operator="false"
      :show-add-button="false"
    >
      <template #header>
        <div v-tooltip.top="$t('contact.given_name_definition')">
          {{ $t('contact.given_name') }}
        </div>
      </template>
      <template #filter="{ filterModel }">
        <InputText v-model="filterModel.value" />
      </template>
    </Column>

    <!-- Family name -->
    <Column
      v-if="visibleColumns.includes('family_name')"
      field="family_name"
      sortable
      :show-filter-operator="false"
      :show-add-button="false"
    >
      <template #header>
        <div v-tooltip.top="$t('contact.family_name_definition')">
          {{ $t('contact.family_name') }}
        </div>
      </template>
      <template #filter="{ filterModel }">
        <InputText v-model="filterModel.value" />
      </template>
    </Column>

    <!-- Alternate names -->
    <Column
      v-if="visibleColumns.includes('alternate_names')"
      field="alternate_names"
      sortable
      :show-filter-operator="false"
      :show-add-button="false"
    >
      <template #header>
        <div v-tooltip.top="$t('contact.alternate_names_definition')">
          {{ $t('contact.alternate_names') }}
        </div>
      </template>
      <template #filter="{ filterModel }">
        <InputText v-model="filterModel.value" />
      </template>
    </Column>

    <!-- Address -->
    <Column
      v-if="visibleColumns.includes('address')"
      field="address"
      sortable
      :show-filter-operator="false"
      :show-add-button="false"
    >
      <template #header>
        <div v-tooltip.top="$t('contact.address_definition')">
          {{ $t('contact.address') }}
        </div>
      </template>
      <template #filter="{ filterModel }">
        <InputText v-model="filterModel.value" />
      </template>
    </Column>

    <!-- Works for -->
    <Column
      v-if="visibleColumns.includes('works_for')"
      field="works_for"
      sortable
      :show-filter-operator="false"
      :show-add-button="false"
    >
      <template #header>
        <div v-tooltip.top="$t('contact.works_for_definition')">
          {{ $t('contact.works_for') }}
        </div>
      </template>
      <template #filter="{ filterModel }">
        <InputText v-model="filterModel.value" />
      </template>
    </Column>

    <!-- Job title	 -->
    <Column
      v-if="visibleColumns.includes('job_title')"
      field="job_title"
      sortable
      :show-filter-operator="false"
      :show-add-button="false"
    >
      <template #header>
        <div v-tooltip.top="$t('contact.job_title_definition')">
          {{ $t('contact.job_title') }}
        </div>
      </template>
      <template #filter="{ filterModel }">
        <InputText v-model="filterModel.value" />
      </template>
    </Column>
  </DataTable>
</template>

<script setup lang="ts">
import { type User } from '@supabase/supabase-js';
import type DataTable from 'primevue/datatable';
import type {
  DataTableFilterEvent,
  DataTableSelectAllChangeEvent,
} from 'primevue/datatable';

import CreditsDialog from '@/components/Credits/InsufficientCreditsDialog.vue';
import ContactInformationSidebar from '@/components/Mining/ContactInformationSidebar.vue';
import { useFiltersStore } from '@/stores/filters';
import type { Contact } from '@/types/contact';
import { useContactsStore } from '~/stores/contacts';
import { statuses, tags } from '~/utils/contacts';
import { saveCSVFile } from '~/utils/csv';

const { t } = useI18n({
  useScope: 'local',
});
const { t: $t } = useI18n({
  useScope: 'global',
});

const $toast = useToast();

const { tableData } = defineProps<{
  tableData: Contact[];
}>();

const $contactInformationSidebar = useMiningContactInformationSidebar();

function openContactInformation(data: Contact) {
  $contactInformationSidebar.show(data);
}

const $contactsStore = useContactsStore();
const leadminerStore = useLeadminerStore();

$contactsStore.setContacts(tableData);

const isLoading = ref(false);
const loadingLabel = ref('');
const contacts = computed(() => $contactsStore.contacts);
const contactsLength = computed(() => contacts.value?.length);

const activeMiningTask = computed(
  () => leadminerStore.miningTask !== undefined
);

const $user = useSupabaseUser() as Ref<User>;
const $supabaseClient = useSupabaseClient();

/* *** Filters *** */

const filtersStore = useFiltersStore();

const filteredContacts = ref<Contact[]>([]);
const filteredContactsLength = computed(() => filteredContacts.value.length);

/* *** Settings *** */
const settingsPanel = ref();
function toggleSettingsPanel(event: Event) {
  settingsPanel.value.toggle(event);
}

function onFilter(event: DataTableFilterEvent) {
  filteredContacts.value = event.filteredValue;
  $contactsStore.filtered = event.filteredValue;
}

async function refineContacts() {
  loadingLabel.value = t('refining_contacts');
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
  loadingLabel.value = t('syncing');
  const user = $user.value;
  $contactsStore.setContacts(await getContacts(user.id));
  isLoading.value = false;
}

watch(activeMiningTask, async (isActive) => {
  if (isActive) {
    filtersStore.clearFilter();
  } else {
    isLoading.value = true;
    await refineContacts();
    await syncTable();
    filtersStore.toggleFilters();
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

/* *** Export CSV *** */

const { $api } = useNuxtApp();
const CreditsDialogRef = ref<InstanceType<typeof CreditsDialog>>();
const isExportDisabled = computed(
  () =>
    contacts.value.length === 0 ||
    activeMiningTask.value ||
    leadminerStore.loadingStatusDns ||
    !implicitlySelectedContactsLength.value
);
function getFileName() {
  const { email } = $user.value;
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
      summary: t('error_verifying_export_csv'),
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
          summary: t('csv_export'),
          detail: t('contacts_exported_successfully'),
          life: 3000,
        });
      }
    },
  });
}

const isFullscreen = ref(false);

const visibleColumns = ref(['contacts']);
const screenStore = useScreenStore();
const visibleColumnsOptions = [
  { label: t('emails'), value: 'contacts' },
  { label: t('source'), value: 'source' },
  { label: t('occurrence'), value: 'occurrence' },
  { label: t('recency'), value: 'recency' },
  { label: t('replies'), value: 'replied_conversations' },
  { label: t('tags'), value: 'tags' },
  { label: t('reachable'), value: 'status' },
  { label: t('recipient'), value: 'recipient' },
  { label: t('sender'), value: 'sender' },
  { label: t('seniority'), value: 'seniority' },
  { label: $t('contact.given_name'), value: 'given_name' },
  { label: $t('contact.family_name'), value: 'family_name' },
  { label: $t('contact.alternate_names'), value: 'alternate_names' },
  { label: $t('contact.address'), value: 'address' },
  { label: $t('contact.works_for'), value: 'works_for' },
  { label: $t('contact.job_title'), value: 'job_title' },
  { label: $t('contact.name'), value: 'name' },
  { label: $t('contact.same_as'), value: 'same_as' },
  { label: $t('contact.image'), value: 'image' },
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

function observeTop() {
  const resizeObserver = new ResizeObserver(() => {
    tablePosTop.value = TableRef.value?.$el.getBoundingClientRect().top;
  });
  resizeObserver.observe(TableRef.value?.$el);
}

onMounted(() => {
  screenStore.init();
  visibleColumns.value = [
    'contacts',
    'name',
    'same_as',
    'image',
    ...(screenStore.width > 550 ? ['occurrence'] : []),
    ...(screenStore.width > 700 ? ['recency'] : []),
    ...(screenStore.width > 800 ? ['tags'] : []),
    ...(screenStore.width > 950 ? ['status'] : []),
  ];
  observeTop();
  watchEffect(() => {
    tableHeight.value = `${screenStore.height - tablePosTop.value - 140}px`;
  });
  $contactsStore.subscribeRealtime($user.value);
});

onUnmounted(() => {
  screenStore.destroy();
  $contactsStore.unsubscribeRealtime();
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

<i18n lang="json">
{
  "en": {
    "of": "of",
    "no_contacts_found": "No contacts found",
    "try_clearing_filters": "Try clearing filters",
    "select_at_least_one_contact": "Select at least one contact to export",
    "export_csv": "Export CSV",
    "clear": "Clear",
    "ensure_deliverability": "Ensure the deliverability of your campaign",
    "only_valid_contacts": "Only valid contacts",
    "contacts_best_performance": "Contacts who previously engaged with you perform best",
    "at_least_one_reply": "At least one reply",
    "gdpr_proof": "- Less than {recentYearsAgo} years \n- GDPR Proof",
    "recent_contacts": "Recent contacts",
    "visible_columns": "{n} Visible field | {n} Visible fields",
    "contacts": "Contacts",
    "emails": "Emails",
    "search_contacts": "Search contacts",
    "source_definition": "The mailbox this contact has been mined from",
    "source": "Source",
    "occurence_definition": "Total occurrences of this contact",
    "occurrence": "Occurrence",
    "recency": "Recency",
    "recency_definition": "When was the last time this contact was seen",
    "replies_definition": "How many times this contact replied",
    "replies": "Replies",
    "tags": "Tags",
    "categorize_contacts": "Categorize your contacts",
    "reachable_definition": "How reachable is your contact",
    "reachable": "Reachable",
    "recipient_definition": "How many times the contact has received emails",
    "sender_definition": "How many times the contact has sent emails",
    "seniority_definition": "Oldest date this contact has been seen",
    "recipient": "Recipient",
    "sender": "Sender",
    "seniority": "Seniority",
    "refining_contacts": "Refining contacts...",
    "syncing": "Syncing...",
    "error_verifying_export_csv": "Error when verifying export CSV",
    "csv_export": "CSV Export",
    "contacts_exported_successfully": "Your contacts are successfully exported.",
    "any": "Any",
    "contact_information": "Contact Information"
  },
  "fr": {
    "of": "sur",
    "no_contacts_found": "Aucun contact trouvé",
    "try_clearing_filters": "Essayez de supprimer les filtres",
    "select_at_least_one_contact": "Sélectionnez au moins un contact à exporter",
    "export_csv": "Export CSV",
    "clear": "Vider",
    "ensure_deliverability": "Assurez la délivrabilité de votre campagne",
    "only_valid_contacts": "Seulement les contacts valides",
    "contacts_best_performance": "Les contacts qui ont déjà interagi avec vous ont les meilleures performances",
    "at_least_one_reply": "Au moins une réponse",
    "gdpr_proof": "- Moins de {recentYearsAgo} ans \n- Conforme au RGPD",
    "recent_contacts": "Contacts récents",
    "visible_columns": "{n} Champ visible | {n} Champs visibles",
    "contacts": "Contacts",
    "emails": "Emails",
    "search_contacts": "Rechercher des contacts",
    "source_definition": "La boîte mail d'où ce contact est extrait",
    "source": "Source",
    "occurence_definition": "Occurrences totales de ce contact",
    "occurrence": "Occurrence",
    "recency": "Récence",
    "recency_definition": "Dernière fois que ce contact a été vu",
    "replies_definition": "Nombre de réponses de ce contact",
    "replies": "Réponses",
    "tags": "Étiquettes",
    "categorize_contacts": "Catégoriser vos contacts",
    "reachable_definition": "Délivrabilité du contact",
    "reachable": "Joignable",
    "recipient_definition": "Nombre de fois que le contact a reçu des emails",
    "sender_definition": "Nombre de fois que le contact a envoyé des emails",
    "seniority_definition": "La date la plus ancienne où ce contact a été vu",
    "recipient": "Destinataire",
    "sender": "Expéditeur",
    "seniority": "Ancienneté",
    "refining_contacts": "Affinement des contacts...",
    "syncing": "Synchronisation...",
    "error_verifying_export_csv": "Erreur lors de la vérification de l'exportation CSV",
    "csv_export": "Exportation CSV",
    "contacts_exported_successfully": "Vos contacts ont été exportés avec succès.",
    "any": "N'importe lequel",
    "contact_information": "Information de contact"
  }
}
</i18n>
