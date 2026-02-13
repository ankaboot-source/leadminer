<template>
  <ContactInformationSidebar v-model:show="$contactInformationSidebar.status" />
  <DataTable
    v-show="showTable"
    ref="TableRef"
    v-model:selection="selectedContacts"
    v-model:filters="$filtersStore.filters"
    :loading="isLoading"
    resizable-columns
    reorderable-columns
    show-gridlines
    pt:tablecontainer:class="grow"
    class="rounded-md outline outline-surface-200 outline-offset-1"
    row-hover
    highlight-on-select
    :class="isFullscreen ? 'fullscreenTable' : ''"
    scrollable
    :scroll-height="scrollHeightTable"
    size="small"
    striped-rows
    :select-all="selectAll"
    :value="hardFilter ? jobDetailsContacts : contacts"
    data-key="email"
    paginator
    filter-display="menu"
    :global-filter-fields="[
      'email',
      'name',
      'location',
      'works_for',
      'job_title',
      'location_normalized',
    ]"
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
            !(
              $filtersStore.isDefaultFilters && !$filtersStore.areToggledFilters
            )
          "
        >
          <span>{{ t('try') }}</span>
          <Button
            size="small"
            icon="pi pi-filter-slash"
            class="mt-3 ml-2"
            :label="t('clearing_filters')"
            outlined
            @click="$filtersStore.clearFilter()"
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
          <ExportContacts
            :contacts-to-treat="contactsToTreat"
            :disable-export="isExportDisabled"
          />
        </div>

        <div>
          <CampaignButton :contacts="contactsToTreat"/>
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
              $filtersStore.isDefaultFilters && !$filtersStore.areToggledFilters
            "
            icon="pi pi-filter-slash"
            :label="$screenStore.size.md ? t('clear') : undefined"
            outlined
            @click="$filtersStore.clearFilter()"
          />
        </div>
        <!-- Settings -->
        <div>
          <Button @click="toggleSettingsPanel">
            {{ $screenStore.size.md ? t('filter') : undefined }}
            <span class="p-button-label">
              <OverlayBadge
                v-if="$filtersStore.areToggledFilters > 0"
                :value="$filtersStore.areToggledFilters"
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
                <div v-tooltip.left="t('toggle_valid_tooltip')">
                  {{ t('toggle_valid_label') }}
                </div>
                <ToggleSwitch
                  v-model="$filtersStore.validToggle"
                  @update:model-value="$filtersStore.onValidToggle"
                />
              </li>
              <li class="flex justify-between gap-2">
                <div
                  v-tooltip.left="
                    t('toggle_recent_tooltip', {
                      recentYearsAgo: $filtersStore.recentYearsAgo,
                    })
                  "
                >
                  {{ t('toggle_recent_label') }}
                </div>
                <ToggleSwitch
                  v-model="$filtersStore.recentToggle"
                  @update:model-value="$filtersStore.onRecentToggle"
                />
              </li>
              <li class="flex justify-between gap-2">
                <div v-tooltip.left="t('toggle_replies_tooltip')">
                  {{ t('toggle_replies_label') }}
                </div>
                <ToggleSwitch
                  v-model="$filtersStore.repliesToggle"
                  @update:model-value="$filtersStore.onRepliesToggle"
                />
              </li>
              <li class="flex justify-between gap-2">
                <div v-tooltip.left="t('toggle_name_tooltip')">
                  {{ t('toggle_name_label') }}
                </div>
                <ToggleSwitch
                  v-model="$filtersStore.nameToggle"
                  @update:model-value="$filtersStore.onNameToggle"
                />
              </li>
              <li class="flex justify-between gap-2">
                <div>
                  {{ t('toggle_location_label') }}
                </div>
                <ToggleSwitch
                  v-model="$filtersStore.locationToggle"
                  @update:model-value="$filtersStore.onLocationToggle"
                />
              </li>
              <li class="flex justify-between gap-2">
                <div v-tooltip.left="toggleJobDetailsTooltip">
                  {{ t('toggle_job_details_label') }}
                </div>
                <ToggleSwitch v-model="$filtersStore.jobDetailsToggle" />
              </li>
              <li class="flex justify-between gap-2">
                <div>
                  {{ t('toggle_phone_label') }}
                </div>
                <ToggleSwitch
                  v-model="$filtersStore.phoneToggle"
                  @update:model-value="$filtersStore.onPhoneToggle"
                />
              </li>
              <Divider class="my-0" />
              <MultiSelect
                v-model="$contactsStore.visibleColumns"
                :options="visibleColumnsOptions"
                :option-disabled="disabledColumns"
                option-label="label"
                class="min-w-56"
                fluid
                option-value="value"
                :selected-items-label="
                  t('visible_columns', $contactsStore.visibleColumns.length)
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
      class="border-l-0"
      style="width: 38px"
      :pt="{
        rowCheckbox: {
          root: {
            style: { 'z-index': 0 }, // https://github.com/primefaces/primevue/issues/5483
          },
        },
      }"
    />

    <!-- Contacts -->
    <Column field="contacts" class="max-w-[50svw]">
      <template #header>
        <div class="pr-2 hidden md:block">{{ t('contacts') }}</div>
        <div class="grow p-column-filter p-fluid p-column-filter-menu">
          <IconField icon-position="left">
            <InputIcon class="pi pi-search" />
            <InputText
              v-model="$filtersStore.searchContactModel"
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
              v-if="
                data.image && $contactsStore.visibleColumns.includes('image')
              "
              :src="getImageViaProxy(data.image)"
              class="cursor-pointer flex-none"
              image-class="size-12 rounded-full"
              @click="openContactInformation(data)"
            />

            <div class="min-w-0">
              <div
                v-if="
                  data.name && $contactsStore.visibleColumns.includes('name')
                "
                class="truncate cursor-pointer"
                @click="openContactInformation(data)"
              >
                {{ data.name }}
              </div>

              <div
                class="truncate cursor-pointer"
                :class="{
                  'font-extralight': !(
                    !data.name && $contactsStore.visibleColumns.includes('name')
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
                (data.same_as &&
                  $contactsStore.visibleColumns.includes('same_as')) ||
                (data.telephone &&
                  $contactsStore.visibleColumns.includes('telephone'))
              "
              class="flex md:hidden gap-2 flex-shrink-0"
            >
              <social-links-and-phones
                :social-links="data.same_as"
                :show-social-links="
                  $contactsStore.visibleColumns.includes('same_as')
                "
                :phones="data.telephone"
                :show-phones="
                  $contactsStore.visibleColumns.includes('telephone')
                "
                :small="true"
              />
            </div>
          </div>

          <div class="flex items-center gap-2 flex-shrink-0">
            <div
              v-if="
                (data.same_as &&
                  $contactsStore.visibleColumns.includes('same_as')) ||
                (data.telephone &&
                  $contactsStore.visibleColumns.includes('telephone'))
              "
              class="hidden md:flex gap-2 flex-shrink-0"
            >
              <social-links-and-phones
                :social-links="data.same_as"
                :show-social-links="
                  $contactsStore.visibleColumns.includes('same_as')
                "
                :phones="data.telephone"
                :show-phones="
                  $contactsStore.visibleColumns.includes('telephone')
                "
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
      v-if="$contactsStore.visibleColumns.includes('source')"
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
      v-if="$contactsStore.visibleColumns.includes('occurrence')"
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
      v-if="$contactsStore.visibleColumns.includes('recency')"
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
          update-model-type="single"
          show-icon
          class="p-column-filter"
        />
      </template>
    </Column>

    <!-- Replied conversations -->
    <Column
      v-if="$contactsStore.visibleColumns.includes('replied_conversations')"
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

    <!-- Temperature -->
    <Column
      v-if="$contactsStore.visibleColumns.includes('temperature')"
      field="temperature"
      data-type="numeric"
      sortable
      :show-filter-operator="false"
      :show-add-button="false"
      class="w-px temperatureColumn"
    >
      <template #header>
        <div v-tooltip.top="t('temperature_definition')">
          {{ $screenStore.size.md ? t('temperature') : '🔥' }}
        </div>
      </template>
      <template #filter="{ filterModel }">
        <InputNumber v-model="filterModel.value" />
      </template>
      <template #body="{ data }">
        <div
          v-if="data.temperature"
          v-tooltip.top="
            `${t('sender')}: ${data.sender}
              ${t('recipient')}: ${data.recipient}
              ${t('occurrence')}: ${data.occurrence}
              ${t('replies')}: ${data.replied_conversations}
              ${t('recency')}: ${data.recency?.toLocaleDateString()}
              ${t('seniority')}: ${data.seniority?.toLocaleDateString()}
            `
          "
          :style="getTemperatureStyle(data.temperature)"
          class="w-11 p-2 rounded-lg text-xs font-bold text-center mx-auto"
        >
          {{ data.temperature }}°
        </div>
      </template>
    </Column>

    <!-- Tags -->
    <Column
      v-if="$contactsStore.visibleColumns.includes('tags')"
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
      v-if="$contactsStore.visibleColumns.includes('status')"
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
      v-if="$contactsStore.visibleColumns.includes('recipient')"
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
      v-if="$contactsStore.visibleColumns.includes('sender')"
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
      v-if="$contactsStore.visibleColumns.includes('seniority')"
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
          update-model-type="single"
          show-icon
          class="p-column-filter"
        />
      </template>
    </Column>

    <!-- Given name -->
    <Column
      v-if="$contactsStore.visibleColumns.includes('given_name')"
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
      v-if="$contactsStore.visibleColumns.includes('family_name')"
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
      v-if="$contactsStore.visibleColumns.includes('alternate_name')"
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
      v-if="$contactsStore.visibleColumns.includes('alternate_email')"
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
      v-if="$contactsStore.visibleColumns.includes('location')"
      field="location"
      sortable
      :show-filter-operator="false"
      :show-add-button="false"
      :show-filter-match-modes="false"
      :pt="{
        filterremove: 'hidden',
        filterrule: { class: 'nth-[2]:hidden', disabled: true },
      }"
    >
      <!-- Last :pt uses object syntax to not fail on conditional elements -->
      <template #header>
        <div v-tooltip.top="$t('contact.location_definition')">
          {{ $t('contact.location') }}
        </div>
      </template>
      <template #filter="{ filterModel }">
        <InputText v-model="filterModel.value" />
      </template>
      <template #body="{ data }">
        <div>
          <NormalizedLocation :normalized-location="data.location_normalized" />
          {{ data.location }}
        </div>
      </template>
    </Column>

    <!-- Works for -->
    <Column
      v-if="$contactsStore.visibleColumns.includes('works_for')"
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
      v-if="$contactsStore.visibleColumns.includes('job_title')"
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
      v-if="$contactsStore.visibleColumns.includes('updated_at')"
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
          update-model-type="single"
          show-icon
          class="p-column-filter"
        />
      </template>
    </Column>

    <!-- Created at -->
    <Column
      v-if="$contactsStore.visibleColumns.includes('created_at')"
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
          update-model-type="single"
          show-icon
          class="p-column-filter"
        />
      </template>
    </Column>

    <!-- Mining ID	 -->
    <Column
      v-if="$contactsStore.visibleColumns.includes('mining_id')"
      field="mining_id"
      sortable
      :show-filter-operator="false"
      :show-add-button="false"
    >
      <template #header>
        <div v-tooltip.top="t('mining_id_definition')">
          {{ t('mining_id') }}
        </div>
      </template>
      <template #filter="{ filterModel }">
        <InputText v-model="filterModel.value" />
      </template>
    </Column>
  </DataTable>
</template>

<script setup lang="ts">
import type {
  DataTableFilterEvent,
  DataTableSelectAllChangeEvent,
} from 'primevue/datatable';
import { CampaignButton } from '@/utils/extras'
import { useFiltersStore } from '@/stores/filters';
import type { Contact } from '@/types/contact';
import NormalizedLocation from '~/components/icons/NormalizedLocation.vue';
import { useContactsStore } from '~/stores/contacts';
import {
  getStatusColor,
  getStatusLabel,
  getTagColor,
  getTagLabel,
  statuses,
  tags,
} from '~/utils/contacts';
import { getImageViaProxy } from '~/utils/images';
import Normalizer from '~/utils/normalizer';

const TableSkeleton = defineAsyncComponent(() => import('./TableSkeleton.vue'));
const SocialLinksAndPhones = defineAsyncComponent(
  () => import('@/components/icons/SocialLinksAndPhones.vue'),
);
const EnrichButton = defineAsyncComponent(
  () => import('../enrich/EnrichButton.vue'),
);
const ExportContacts = defineAsyncComponent(
  () => import('../buttons/ExportContacts.vue'),
);
const RemoveContactButton = defineAsyncComponent(
  () => import('../buttons/RemoveContactButton.vue'),
);
const ContactInformationSidebar = defineAsyncComponent(
  () => import('../ContactInformationSidebar.vue'),
);

const { showTable, origin } = defineProps<{
  showTable: boolean;
  origin: 'contacts' | 'mine';
}>();

const { t } = useI18n({
  useScope: 'local',
});
const { t: $t } = useI18n({
  useScope: 'global',
});

const MINING_ID_PARAM = 'mining_id';

// skipcq: JS-0321
const emptyFunction = () => {};

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
const $filtersStore = useFiltersStore();

const filteredContacts = ref<Contact[]>([]);
const filteredContactsLength = computed(() => filteredContacts.value?.length);

function getJobDetailsFieldsCount(contact: Contact): number {
  return Number(!!contact.job_title) + Number(!!contact.works_for?.length);
}

const jobDetailsContacts = computed(
  () => contacts.value?.filter((c) => getJobDetailsFieldsCount(c) >= 1) ?? [],
);

const hardFilter = computed(() => $filtersStore.jobDetailsToggle);
const jobDetailsFields = ['job_title', 'works_for'];
const toggleJobDetailsTooltip = `${t('toggle_job_details_tooltip')} (${jobDetailsFields.map((field) => $t(`contact.${field}`)).join(', ')})`;

/* *** Settings *** */
const settingsPanel = ref();
function toggleSettingsPanel(event: Event) {
  settingsPanel.value.toggle(event);
}

function onFilter($event: DataTableFilterEvent) {
  filteredContacts.value = $event.filteredValue;
}
function optimizeTableForMining() {
  $filtersStore.onNameToggle(true); // toggle on name filter on start mining
  rowsPerPage.value = 20; // Lower rows per page for better performance
}
watch(
  () => $leadminerStore.activeMiningTask,
  (isActive) => {
    if (isActive) {
      $filtersStore.clearFilter();
      optimizeTableForMining();
    } else {
      $filtersStore.toggleFilters();
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

const isExportDisabled = computed(
  () =>
    contactsLength.value === 0 ||
    $leadminerStore.activeMiningTask ||
    $leadminerStore.loadingStatusDns ||
    !implicitlySelectedContactsLength.value,
);

const isFullscreen = ref(false);

const $screenStore = useScreenStore();
const visibleColumnsOptions = [
  { label: t('emails'), value: 'contacts' },
  { label: t('source'), value: 'source' },
  { label: t('occurrence'), value: 'occurrence' },
  { label: t('recency'), value: 'recency' },
  { label: t('replies'), value: 'replied_conversations' },
  { label: t('temperature'), value: 'temperature' },
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
  { label: t('mining_id'), value: 'mining_id' },
];

function disabledColumns(column: { label: string; value: string }) {
  return column.value === 'contacts';
}
function onSelectColumnsChange() {
  // PrimeVue bug fix: MultiSelect: Can deselect disabled options https://github.com/primefaces/primevue/issues/5490
  if (!$contactsStore.visibleColumns.includes('contacts')) {
    $contactsStore.visibleColumns.push('contacts');
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

onBeforeMount(() => {
  isLoading.value = true;
});
onNuxtReady(async () => {
  $screenStore.init();
  $contactsStore.visibleColumns = [
    'contacts',
    'name',
    'same_as',
    'telephone',
    'image',
    'location',
    ...(origin === 'contacts' && $screenStore.width > 550
      ? ['temperature']
      : []),
    ...($screenStore.width > 700 ? ['tags'] : []),
    ...($screenStore.width > 800 ? ['status'] : []),
  ];

  await $contactsStore.reloadContacts();

  if (!$contactsStore.contactCount && (await $contactsStore.hasPersons())) {
    console.log(
      'Data in persons table but not in refinedpersons, refining contacts...',
    );
    await $contactsStore.refineContacts();
    await $contactsStore.reloadContacts();
  }
  const locationsToNormalize = $contactsStore.getLocationsToNormalize();

  if (locationsToNormalize.length > 0) {
    Normalizer.add(locationsToNormalize);
  }

  $contactsStore.subscribeToRealtimeUpdates();

  scrollHeightObserver.value = new ResizeObserver(() => {
    scrollHeight.value = document.documentElement.scrollHeight;
  });
  scrollHeightObserver.value.observe(document.documentElement);

  const miningId = getParam(MINING_ID_PARAM);
  if (miningId) {
    $filtersStore.filterByMiningId(miningId as string);
    $contactsStore.visibleColumns.push(MINING_ID_PARAM);
    removeQueryParam(MINING_ID_PARAM);
  }

  isLoading.value = false;
});

onUnmounted(() => {
  $screenStore.destroy();
  $contactsStore.$reset();
  scrollHeightObserver.value?.disconnect();
});

function getTemperatureStyle(temp: number | null) {
  if (temp === null) return null;

  const normalized = Math.min(Math.max(temp / 100, 0), 1);

  // Hue: yellow (45°) → pink-red (~0°)
  const hue = 45 - normalized * 45;

  // Lightness: keep pastel
  const lightnessBg = 95 - normalized * 10;
  const lightnessText = lightnessBg - 55;
  const borderLightness = lightnessBg - 15;

  const saturation = 75; // soft pastel

  const textColor = `hsl(${hue}, ${saturation}%, ${lightnessText}%)`;
  const borderColor = `hsl(${hue}, ${saturation}%, ${borderLightness}%)`;

  return {
    color: textColor,
    border: `1px solid ${borderColor}`,
  };
}
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

.p-datatable-paginator-bottom,
.p-datatable-header {
  border: 0;
}

/* Use passthrough if able */
.temperatureColumn
  > div
  > div.p-datatable-filter.p-datatable-popover-filter
  > button {
  height: 25px;
  width: 25px;
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
    "remove": "remove",
    "clear": "Clear",
    "filter": "Filter",
    "toggle_job_details_tooltip": "At least one job detail",
    "toggle_job_details_label": "Only with job details",
    "toggle_valid_tooltip": "Ensure the deliverability of your campaign",
    "toggle_valid_label": "Hide unreachable contacts",
    "toggle_replies_tooltip": "Contacts who previously engaged with you perform best",
    "toggle_replies_label": "At least one reply",
    "toggle_phone_label": "Only with phone number",
    "toggle_location_label": "Only with location",
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
    "temperature_definition": "The hotter, the more replies, recent activity, and engagement — and a higher chance of future replies.",
    "temperature": "Temperature",
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
    "mining_id_definition": "The mining ID of this contact",
    "mining_id": "Mining ID",
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
    "remove": "supprimer",
    "clear": "Vider",
    "filter": "Filtrer",
    "toggle_job_details_tooltip": "A au moins une détail",
    "toggle_job_details_label": "Avec les détails du poste",
    "toggle_valid_tooltip": "Assurez la délivrabilité de votre campagne",
    "toggle_valid_label": "Cacher les contacts injoignables",
    "toggle_replies_tooltip": "Les contacts qui ont déjà interagi avec vous ont les meilleures performances",
    "toggle_replies_label": "Au moins une réponse",
    "toggle_phone_label": "Avec numéro de téléphone",
    "toggle_location_label": "Avec localisation",
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
    "occurrence_definition": "Occurrences totales de ce contact",
    "occurrence": "Occurrence",
    "temperature_definition": "Plus la température est élevée, plus il y a de réponses, d'activité récente et d'engagement, et plus les chances d'obtenir des réponses futures sont élevées.",
    "temperature": "Temperature",
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
    "mining_id_definition": "ID d'extraction de ce contact",
    "mining_id": "ID d'extraction",
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
