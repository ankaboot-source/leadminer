<template>
  <component
    :is="CreditsDialog"
    ref="CreditsDialogExportRef"
    engagement-type="contact"
    action-type="export"
    @secondary-action="exportTable(true)"
  />
  <ContactInformationSidebar v-model:show="$contactInformationSidebar.status" />
  <DataTable
    v-show="showTable"
    ref="TableRef"
    v-model:selection="selectedContacts"
    v-model:filters="filtersStore.filters"
    :loading="isLoading"
    resizable-columns
    reorderable-columns
    show-gridlines
    pt:tablecontainer:class="grow"
    row-hover
    highlight-on-select
    :class="isFullscreen ? 'fullscreenTable' : ''"
    scrollable
    :scroll-height="scrollHeightTable"
    size="small"
    striped-rows
    :select-all="selectAll"
    :value="hardFilter ? enrichedContacts : contacts"
    data-key="email"
    paginator
    filter-display="menu"
    :global-filter-fields="['email', 'name']"
    removable-sort
    paginator-template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
    :current-page-report-template="`({currentPage} ${$t('of')} {totalPages})`"
    :rows="rowsPerPage"
    :rows-per-page-options="rowsPerPageOptions"
    @filter="onFilter($event)"
    @select-all-change="onSelectAllChange"
    @row-select="onRowSelect"
    @row-unselect="onRowUnselect"
  >
    <template #empty>
      <div v-if="!isLoading" class="text-center py-5">
        <div class="font-semibold">{{ t('no_contacts_found') }}</div>
        <div
          v-if="
            contactsLength !== 0 &&
            !(filtersStore.isDefaultFilters && !filtersStore.areToggledFilters)
          "
        >
          <span>{{ t('try') }}</span>
          <Button
            size="small"
            icon="pi pi-filter-slash"
            class="mt-3 ml-2"
            :label="t('clearing_filters')"
            outlined
            @click="filtersStore.clearFilter()"
          />
        </div>
      </div>
    </template>
    <template #loading>
      <TableSkeleton v-if="tablePosTop === 0" />
      <div v-else class="text-center">
        <ProgressSpinner />
        <div class="font-semibold text-white">{{ loadingLabel }}</div>
      </div>
    </template>
    <template #header>
      <div class="flex items-center gap-1">
        <div>
          <EnrichButton
            source="datatable"
            :enrichment-realtime-callback="emptyFunction"
            :enrichment-request-response-callback="emptyFunction"
            :contacts-to-enrich="implicitlySelectedContacts"
            :enrich-all-contacts="$contactsStore.selectedEmails === undefined"
          />
        </div>

        <div>
          <Button
            id="export-csv"
            v-tooltip.top="
              isExportDisabled &&
              t('select_at_least_one_contact', { action: t('export') })
            "
            icon="pi pi-external-link"
            :label="$screenStore.size.md ? t('export_csv') : undefined"
            :disabled="isExportDisabled"
            @click="exportTable()"
          />
        </div>

        <div
          v-tooltip.top="
            (isExportDisabled || !selectedContactsLength) &&
            t('select_at_least_one_contact', { action: t('remove') })
          "
        >
          <RemoveContactButton
            :contacts-to-delete="contactsToTreat"
            :contacts-to-delete-length="selectedContactsLength"
            :is-remove-disabled="isExportDisabled || !selectedContactsLength"
            :deselect-contacts="deselectContacts"
          />
        </div>
        <div class="ml-2 leading-none">
          <i v-if="isLoading" class="pi pi-spin pi-spinner" />
          <template v-else>
            <template v-if="!implicitSelectAll && contactsLength">
              {{
                implicitlySelectedContactsLength.toLocaleString() +
                ($screenStore.size.md ? ' ' : '') +
                '/' +
                ($screenStore.size.md ? ' ' : '') +
                contactsLength.toLocaleString()
              }}
            </template>
            <template v-else>
              {{ contactsLength?.toLocaleString() ?? 0 }}
            </template>
          </template>
          <template v-if="$screenStore.size.md">
            {{ ' ' + t('contacts') }}
          </template>
        </div>
        <div class="grow" />
        <div>
          <Button
            :disabled="
              filtersStore.isDefaultFilters && !filtersStore.areToggledFilters
            "
            icon="pi pi-filter-slash"
            :label="$screenStore.size.md ? t('clear') : undefined"
            outlined
            @click="filtersStore.clearFilter()"
          />
        </div>
        <!-- Settings -->
        <div>
          <Button @click="toggleSettingsPanel">
            {{ $screenStore.size.md ? t('filter') : undefined }}
            <span class="p-button-label">
              <OverlayBadge
                v-if="filtersStore.areToggledFilters > 0"
                :value="filtersStore.areToggledFilters"
                pt:pcbadge:root:class="bg-white text-black outline-none"
              >
                <i class="pi pi-sliders-h" />
              </OverlayBadge>

              <i v-else class="pi pi-sliders-h" />
            </span>
          </Button>
          <Popover ref="settingsPanel">
            <ul class="list-none p-0 m-0 flex flex-col gap-3">
              <li class="flex justify-between gap-2">
                <div v-tooltip.left="toggleEnrichTooltip">
                  {{ t('toggle_enriched_label') }}
                </div>
                <ToggleSwitch v-model="filtersStore.enrichedToggle" />
              </li>
              <li class="flex justify-between gap-2">
                <div v-tooltip.left="t('toggle_valid_tooltip')">
                  {{ t('toggle_valid_label') }}
                </div>
                <ToggleSwitch
                  v-model="filtersStore.validToggle"
                  @update:model-value="filtersStore.onValidToggle"
                />
              </li>
              <li class="flex justify-between gap-2">
                <div v-tooltip.left="t('toggle_name_tooltip')">
                  {{ t('toggle_name_label') }}
                </div>
                <ToggleSwitch
                  v-model="filtersStore.nameToggle"
                  @update:model-value="filtersStore.onNameToggle"
                />
              </li>
              <li class="flex justify-between gap-2">
                <div
                  v-tooltip.left="
                    t('toggle_recent_tooltip', {
                      recentYearsAgo: filtersStore.recentYearsAgo,
                    })
                  "
                >
                  {{ t('toggle_recent_label') }}
                </div>
                <ToggleSwitch
                  v-model="filtersStore.recentToggle"
                  @update:model-value="filtersStore.onRecentToggle"
                />
              </li>
              <li class="flex justify-between gap-2">
                <div v-tooltip.left="t('toggle_replies_tooltip')">
                  {{ t('toggle_replies_label') }}
                </div>
                <ToggleSwitch
                  v-model="filtersStore.repliesToggle"
                  @update:model-value="filtersStore.onRepliesToggle"
                />
              </li>
              <li class="flex justify-between gap-2">
                <div>
                  {{ t('toggle_phone_label') }}
                </div>
                <ToggleSwitch
                  v-model="filtersStore.phoneToggle"
                  @update:model-value="filtersStore.onPhoneToggle"
                />
              </li>

              <Divider class="my-0" />
              <MultiSelect
                v-model="visibleColumns"
                :options="visibleColumnsOptions"
                :option-disabled="disabledColumns"
                option-label="label"
                class="min-w-56"
                fluid
                option-value="value"
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
        <div class="pr-2 hidden md:block">{{ t('contacts') }}</div>
        <div class="grow p-column-filter p-fluid p-column-filter-menu">
          <IconField icon-position="left">
            <InputIcon class="pi pi-search" />
            <InputText
              v-model="filtersStore.searchContactModel"
              :placeholder="t('search_contacts')"
              class="w-full"
            />
          </IconField>
        </div>
      </template>
      <template #body="{ data }">
        <div class="flex items-center justify-between gap-2 w-full min-w-0">
          <div class="flex items-center gap-2 min-w-0">
            <Image
              v-if="data.image && visibleColumns.includes('image')"
              :src="getImageViaProxy(data.image)"
              class="cursor-pointer flex-none"
              image-class="size-12 rounded-full"
              @click="openContactInformation(data)"
            />

            <div class="min-w-0">
              <div
                v-if="data.name && visibleColumns.includes('name')"
                class="truncate cursor-pointer"
                @click="openContactInformation(data)"
              >
                {{ data.name }}
              </div>

              <div
                class="truncate cursor-pointer"
                :class="{
                  'font-extralight': !(
                    !data.name && visibleColumns.includes('name')
                  ),
                }"
                @click="openContactInformation(data)"
              >
                {{ data.email }}
              </div>
            </div>

            <!-- RIGHT -->
            <div
              v-if="
                (data.same_as && visibleColumns.includes('same_as')) ||
                (data.telephone && visibleColumns.includes('telephone'))
              "
              class="flex md:hidden gap-2 flex-shrink-0"
            >
              <social-links-and-phones
                :social-links="data.same_as"
                :show-social-links="visibleColumns.includes('same_as')"
                :phones="data.telephone"
                :show-phones="visibleColumns.includes('telephone')"
                :small="true"
              />
            </div>
          </div>

          <div class="flex items-center gap-2 flex-shrink-0">
            <div
              v-if="
                (data.same_as && visibleColumns.includes('same_as')) ||
                (data.telephone && visibleColumns.includes('telephone'))
              "
              class="hidden md:flex gap-2 flex-shrink-0"
            >
              <social-links-and-phones
                :social-links="data.same_as"
                :show-social-links="visibleColumns.includes('same_as')"
                :phones="data.telephone"
                :show-phones="visibleColumns.includes('telephone')"
                :small="true"
              />
            </div>
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
        <div v-tooltip.top="t('occurrence_definition')">
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
            class="capitalize font-normal"
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
          class="p-column-filter font-normal"
          display="chip"
        >
          <template #option="{ option }">
            <Tag
              :value="option.label"
              :severity="getTagColor(option.value)"
              class="capitalize font-normal"
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
          class="font-normal"
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
            <Tag
              :value="option.label"
              :severity="option.color"
              class="font-normal"
            />
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
      v-if="visibleColumns.includes('alternate_name')"
      field="alternate_name"
      sortable
      :show-filter-operator="false"
      :show-add-button="false"
    >
      <template #header>
        <div v-tooltip.top="$t('contact.alternate_names_definition')">
          {{ $t('contact.alternate_name') }}
        </div>
      </template>
      <template #filter="{ filterModel }">
        <InputText v-model="filterModel.value" />
      </template>
      <template #body="{ data }">
        <div>{{ data.alternate_name?.join(', ') }}</div>
      </template>
    </Column>

    <!-- Alternate emails -->
    <Column
      v-if="visibleColumns.includes('alternate_email')"
      field="alternate_email"
      sortable
      :show-filter-operator="false"
      :show-add-button="false"
    >
      <template #header>
        <div v-tooltip.top="$t('contact.alternate_emails_definition')">
          {{ $t('contact.alternate_email') }}
        </div>
      </template>
      <template #filter="{ filterModel }">
        <InputText v-model="filterModel.value" />
      </template>
      <template #body="{ data }">
        <div>{{ data.alternate_email?.join(', ') }}</div>
      </template>
    </Column>

    <!-- Location -->
    <Column
      v-if="visibleColumns.includes('location')"
      field="location"
      sortable
      :show-filter-operator="false"
      :show-add-button="false"
    >
      <template #header>
        <div v-tooltip.top="$t('contact.location_definition')">
          {{ $t('contact.location') }}
        </div>
      </template>
      <template #filter="{ filterModel }">
        <InputText v-model="filterModel.value" />
      </template>
      <template #body="{ data }">
        <div>{{ data.location?.join(', ') }}</div>
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

    <!-- Updated at -->
    <Column
      v-if="visibleColumns.includes('updated_at')"
      field="updated_at"
      sortable
      data-type="date"
    >
      <template #header>
        <div v-tooltip.top="$t('contact.updated_at_definition')">
          {{ $t('contact.updated_at') }}
        </div>
      </template>
      <template #body="{ data }">
        <div v-tooltip.bottom="data.updated_at?.toLocaleString()">
          {{ data.updated_at?.toLocaleDateString() ?? data.updated_at }}
        </div>
      </template>
      <template #filter="{ filterModel }">
        <DatePicker
          v-model="filterModel.value"
          show-icon
          class="p-column-filter"
        />
      </template>
    </Column>

    <!-- Created at -->
    <Column
      v-if="visibleColumns.includes('created_at')"
      field="created_at"
      sortable
      data-type="date"
    >
      <template #header>
        <div v-tooltip.top="$t('contact.created_at_definition')">
          {{ $t('contact.created_at') }}
        </div>
      </template>
      <template #body="{ data }">
        <div v-tooltip.bottom="data.created_at?.toLocaleString()">
          {{ data.created_at?.toLocaleDateString() ?? data.created_at }}
        </div>
      </template>
      <template #filter="{ filterModel }">
        <DatePicker
          v-model="filterModel.value"
          show-icon
          class="p-column-filter"
        />
      </template>
    </Column>
  </DataTable>
</template>

<script setup lang="ts">
import type {
  DataTableFilterEvent,
  DataTableSelectAllChangeEvent,
} from 'primevue/datatable';

import { useFiltersStore } from '@/stores/filters';
import type { Contact } from '@/types/contact';
import {
  CreditsDialog,
  CreditsDialogExportRef,
  openCreditsDialog,
} from '@/utils/credits';
import { useContactsStore } from '~/stores/contacts';
import {
  getStatusColor,
  getStatusLabel,
  getTagColor,
  getTagLabel,
  statuses,
  tags,
} from '~/utils/contacts';
import { saveCSVFile } from '~/utils/csv';
import { getImageViaProxy } from '~/utils/images';

const TableSkeleton = defineAsyncComponent(() => import('./TableSkeleton.vue'));
const SocialLinksAndPhones = defineAsyncComponent(
  () => import('../../icons/SocialLinksAndPhones.vue'),
);
const EnrichButton = defineAsyncComponent(
  () => import('../Buttons/EnrichButton.vue'),
);
const RemoveContactButton = defineAsyncComponent(
  () => import('../Buttons/RemoveContactButton.vue'),
);
const ContactInformationSidebar = defineAsyncComponent(
  () => import('../ContactInformationSidebar.vue'),
);

const { showTable } = defineProps<{
  showTable: boolean;
}>();

const { t } = useI18n({
  useScope: 'local',
});
const { t: $t } = useI18n({
  useScope: 'global',
});

// skipcq: JS-0321
const emptyFunction = () => {};

const $toast = useToast();

const $user = useSupabaseUser();
const $contactsStore = useContactsStore();
const $leadminerStore = useLeadminerStore();
const $contactInformationSidebar = useMiningContactInformationSidebar();

const isLoading = ref(true);
const loadingLabel = ref('');

const contacts = computed(() => $contactsStore.contactsList);
const contactsLength = computed(() => $contactsStore.contactCount);

const DEFAULT_ROWS_PER_PAGE = 150;
const rowsPerPageOptions = [20, 50, 150, 500, 1000];
const rowsPerPage = ref(DEFAULT_ROWS_PER_PAGE);

function openContactInformation(data: Contact) {
  $contactInformationSidebar.show(data);
}

/* *** Filters *** */
const filtersStore = useFiltersStore();

const filteredContacts = ref<Contact[]>([]);
const filteredContactsLength = computed(() => filteredContacts.value?.length);

const enrichedContacts = computed(
  () => contacts.value?.filter((c) => getEnrichedFieldsCount(c) >= 2) ?? [],
);

const hardFilter = computed(() => filtersStore.enrichedToggle);
const enrichedFields = [
  'same_as',
  'location',
  'job_title',
  'works_for',
  'image',
  'telephone',
];
const toggleEnrichTooltip = `${t('toggle_enriched_tooltip')} (${enrichedFields.map((field) => $t(`contact.${field}`)).join(', ')})`;
function getEnrichedFieldsCount(contact: Contact): number {
  return (
    Number(!!contact.same_as?.length) +
    Number(!!contact.location?.length) +
    Number(!!contact.job_title) +
    Number(!!contact.works_for?.length) +
    Number(!!contact.image) +
    Number(!!contact.telephone?.length)
  );
}

/* *** Settings *** */
const settingsPanel = ref();
function toggleSettingsPanel(event: Event) {
  settingsPanel.value.toggle(event);
}

function onFilter($event: DataTableFilterEvent) {
  filteredContacts.value = $event.filteredValue;
}
function optimizeTableForMining() {
  filtersStore.onNameToggle(true); // toggle on name filter on start mining
  rowsPerPage.value = 20; // Lower rows per page for better performance
}
watch(
  () => $leadminerStore.activeMiningTask,
  (isActive) => {
    if (isActive) {
      $leadminerStore.cleaningFinished = false;
      filtersStore.clearFilter();
      optimizeTableForMining();
    } else {
      $leadminerStore.cleaningFinished = true;
      filtersStore.toggleFilters();
      rowsPerPage.value = DEFAULT_ROWS_PER_PAGE;
    }
  },
);

/* *** Selection *** */
const selectedContacts = ref<Contact[]>([]);
const selectedContactsLength = computed(() => selectedContacts.value.length);
const selectAll = ref(false);

function deselectContacts() {
  selectAll.value = false;
  selectedContacts.value = [];
}
const onSelectAllChange = (event: DataTableSelectAllChangeEvent) => {
  if (event.checked) {
    selectAll.value = true;
    selectedContacts.value = filteredContacts.value; // all data according to your needs
  } else deselectContacts();
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
  if (contacts.value === undefined) return [];
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
  () => implicitlySelectedContacts.value.length,
);

const implicitSelectAll = computed(
  () => implicitlySelectedContactsLength.value === contactsLength.value,
);

const contactsToTreat = computed<string[] | undefined>(() =>
  implicitSelectAll.value
    ? undefined
    : implicitlySelectedContacts.value.map((item: Contact) => item.email),
);

watch(
  contactsToTreat,
  () => {
    $contactsStore.selectedEmails = contactsToTreat.value;
  },
  { deep: true, immediate: true },
);

watch(implicitlySelectedContactsLength, () => {
  $contactsStore.selectedContactsCount = implicitlySelectedContactsLength.value;
});

/* *** Export CSV *** */

const { $api } = useNuxtApp();
const isExportDisabled = computed(
  () =>
    contactsLength.value === 0 ||
    $leadminerStore.activeMiningTask ||
    $leadminerStore.loadingStatusDns ||
    !implicitlySelectedContactsLength.value,
);
function getFileName() {
  if (!$user.value) return;
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
  },
) => {
  if (total === undefined || available === undefined) {
    return $toast.add({
      severity: 'error',
      summary: t('error_verifying_export_csv'),
      life: 3000,
    });
  }
  return openCreditsDialog(
    CreditsDialogExportRef,
    hasDeficientCredits,
    total,
    available,
    availableAlready ?? 0,
  );
};

async function exportTable(partialExport = false) {
  await $api('/contacts/export/csv', {
    method: 'POST',
    body: {
      partialExport,
      emails: contactsToTreat.value,
      exportAllContacts: contactsToTreat.value === undefined,
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
          life: 8000,
        });
      }
    },
  });
}

const isFullscreen = ref(false);

const visibleColumns = ref(['contacts']);
const $screenStore = useScreenStore();
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
  { label: $t('contact.alternate_name'), value: 'alternate_name' },
  { label: $t('contact.alternate_email'), value: 'alternate_email' },
  { label: $t('contact.location'), value: 'location' },
  { label: $t('contact.works_for'), value: 'works_for' },
  { label: $t('contact.job_title'), value: 'job_title' },
  { label: $t('contact.name'), value: 'name' },
  { label: $t('contact.same_as'), value: 'same_as' },
  { label: $t('contact.telephone'), value: 'telephone' },
  { label: $t('contact.image'), value: 'image' },
  { label: $t('contact.updated_at'), value: 'updated_at' },
  { label: $t('contact.created_at'), value: 'created_at' },
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
const tablePosTop = ref(0);

const tableHeight = ref('flex');
const scrollHeightTable = computed(() =>
  !isFullscreen.value ? tableHeight.value : '',
);
const scrollHeight = ref($screenStore.height);

function observeTop() {
  const stopWatch = watch(
    () => TableRef.value,
    (newValue) => {
      if (newValue) {
        const resizeObserver = new ResizeObserver(() => {
          tablePosTop.value = newValue.$el.getBoundingClientRect().top;
        });
        resizeObserver.observe(newValue.$el);
        try {
          stopWatch(); // This throws a ReferenceError once its called before it has been initialized.
        } catch (error) {
          if (!(error instanceof ReferenceError)) {
            throw error;
          }
          /* empty */
        }
      }
    },
    { immediate: true },
  );
}

const isExceedingScreenHeight = computed(
  () => scrollHeight.value !== $screenStore.height,
);
const stopShowTableFirstTimeWatcher = watch(
  () => contactsLength.value,
  () => {
    if (contactsLength.value !== undefined) {
      if (isLoading.value) {
        isLoading.value = false;
      }
      if (contactsLength.value > 0) {
        observeTop();
        watchEffect(() => {
          tableHeight.value = isExceedingScreenHeight.value
            ? `${$screenStore.height - tablePosTop.value - 120}px`
            : 'flex';
        });
        try {
          stopShowTableFirstTimeWatcher(); // This throws a ReferenceError once its called before it has been initialized.
        } catch (error) {
          if (!(error instanceof ReferenceError)) {
            throw error;
          }
          /* empty */
        }
      }
    }
  },
  { deep: true, immediate: true },
);
const scrollHeightObserver = ref<ResizeObserver | null>(null);

onBeforeMount(() => (isLoading.value = true));
onNuxtReady(async () => {
  $screenStore.init();
  visibleColumns.value = [
    'contacts',
    'name',
    'same_as',
    'telephone',
    'image',
    ...($screenStore.width > 550 ? ['occurrence'] : []),
    ...($screenStore.width > 700 ? ['recency'] : []),
    ...($screenStore.width > 800 ? ['tags'] : []),
    ...($screenStore.width > 950 ? ['status'] : []),
  ];

  await $contactsStore.reloadContacts();

  $contactsStore.subscribeToRealtimeUpdates();

  scrollHeightObserver.value = new ResizeObserver(() => {
    scrollHeight.value = document.documentElement.scrollHeight;
  });
  scrollHeightObserver.value.observe(document.documentElement);

  isLoading.value = false;
});

onUnmounted(() => {
  $screenStore.destroy();
  $contactsStore.$reset();
  scrollHeightObserver.value?.disconnect();
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
    "try": "Try",
    "clearing_filters": "Clearing filters",
    "select_at_least_one_contact": "Select at least one contact to {action}",
    "export_csv": "Export CSV",
    "export": "export",
    "remove": "remove",
    "clear": "Clear",
    "filter": "Filter",
    "toggle_enriched_tooltip": "Has at least 2 enriched fields",
    "toggle_enriched_label": "Only enriched contacts",
    "toggle_valid_tooltip": "Ensure the deliverability of your campaign",
    "toggle_valid_label": "Only valid contacts",
    "toggle_replies_tooltip": "Contacts who previously engaged with you perform best",
    "toggle_replies_label": "At least one reply",
    "toggle_phone_label": "Only with phone number",
    "toggle_name_label": "Only with name",
    "toggle_name_tooltip": "Named contacts engage more",
    "toggle_recent_tooltip": "- Less than {recentYearsAgo} years \n- GDPR Proof",
    "toggle_recent_label": "Recent contacts",
    "visible_columns": "{n} Visible field | {n} Visible fields",
    "contacts": "Contacts",
    "emails": "Emails",
    "search_contacts": "Search contacts",
    "source_definition": "The mailbox this contact has been mined from",
    "source": "Source",
    "occurrence_definition": "Total occurrences of this contact",
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
    "try": "Essayez de",
    "clearing_filters": "Vider les filtres",
    "select_at_least_one_contact": "Sélectionnez au moins un contact à {action}",
    "export": "exporter",
    "remove": "supprimer",
    "export_csv": "Export CSV",
    "clear": "Vider",
    "filter": "Filtrer",
    "toggle_enriched_tooltip": "A au moins 2 champs enrichis",
    "toggle_enriched_label": "Contacts enrichis",
    "toggle_valid_tooltip": "Assurez la délivrabilité de votre campagne",
    "toggle_valid_label": "Contacts valides",
    "toggle_replies_tooltip": "Les contacts qui ont déjà interagi avec vous ont les meilleures performances",
    "toggle_replies_label": "Au moins une réponse",
    "toggle_phone_label": "Avec numéro de téléphone",
    "toggle_name_label": "Avec nom complet",
    "toggle_name_tooltip": "Les contacts connus par leur nom complet répondent davantage",
    "toggle_recent_tooltip": "- Moins de {recentYearsAgo} ans \n- Conforme au RGPD",
    "toggle_recent_label": "Contacts récents",
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
