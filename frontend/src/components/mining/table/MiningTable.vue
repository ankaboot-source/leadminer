<template>
  <ContactInformationSidebar v-model:show="$contactInformationSidebar.status" />
  <CampaignComposerDialog
    v-model:visible="sendCampaignDialogVisible"
    :selected-contacts="implicitlySelectedContacts"
  />
  <SmsCampaignComposerDialog
    v-model:visible="sendSmsCampaignDialogVisible"
    :selected-contacts="implicitlySelectedContacts"
    @campaign-created="onSmsCampaignCreated"
    @add-gateway="showAddGatewayDialog = true"
  />
  <Dialog
    v-model:visible="showAddGatewayDialog"
    modal
    :header="t('sms_fleet_management')"
    :style="{ width: '40rem', maxWidth: '95vw' }"
  >
    <SmsFleetManagement />
  </Dialog>
  <DataTable
    v-show="showTable"
    ref="TableRef"
    v-model:selection="selectedContacts"
    v-model:filters="filtersModel"
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
    :value="tableRows"
    data-key="email"
    paginator
    filter-display="menu"
    :global-filter-fields="globalFilterFields"
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
      <div class="text-center">
        <ProgressSpinner />
        <div class="font-semibold text-white">{{ loadingLabel }}</div>
      </div>
    </template>
    <template #header>
      <div class="flex items-center gap-1 flex-wrap md:flex-nowrap">
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
        <div
          v-tooltip.top="
            isSendByEmailDisabled &&
            isSendBySmsDisabled &&
            t('select_at_least_one_contact', {
              action: t('send_campaign').toLowerCase(),
            })
          "
          class="flex gap-2"
        >
          <SplitButton
            severity="contrast"
            :label="t('send_campaign')"
            :model="sendCampaignMenuItems"
            :disabled="isSendByEmailDisabled && isSendBySmsDisabled"
            :button-props="{
              disabled: isSendByEmailDisabled,
              onClick: () => openSendContactsDialog(),
            }"
            pt:label:class="hidden md:block"
          >
            <template #icon>
              <span class="p-button-icon p-button-icon-left">
                <i class="pi pi-send" />
              </span>
            </template>
          </SplitButton>
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

        <div class="mx-2 leading-none">
          <i v-if="isLoading" class="pi pi-spin pi-spinner" />
          <template v-else>
            <template v-if="!implicitSelectAll && contactsLength">
              {{
                formatContactsCountForHeader(implicitlySelectedContactsLength) +
                ($screenStore.size.md ? ' ' : '') +
                '/' +
                ($screenStore.size.md ? ' ' : '') +
                formatContactsCountForHeader(contactsLength)
              }}
            </template>
            <template v-else>
              {{ formatContactsCountForHeader(contactsLength ?? 0) }}
            </template>
          </template>
          <template v-if="$screenStore.size.md">
            {{ ' ' + t('contacts') }}
          </template>
        </div>
        <div class="hidden md:block md:grow" />
        <div class="ml-auto flex items-center gap-1 shrink-0">
          <div>
            <Button
              :disabled="
                $filtersStore.isDefaultFilters &&
                !$filtersStore.areToggledFilters
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
                  <div v-tooltip.left="t('toggle_hide_unsubscribed_tooltip')">
                    {{ t('toggle_hide_unsubscribed_label') }}
                  </div>
                  <ToggleSwitch
                    v-model="$filtersStore.hideUnsubscribedToggle"
                    @update:model-value="$filtersStore.onHideUnsubscribedToggle"
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
                <li>
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
                </li>
              </ul>
            </Popover>
          </div>
        </div>
        <div class="hidden md:block">
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
              v-model="searchContactModel"
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
              v-if="data.image && columnVisibility.image"
              :src="getImageViaProxy(data.image)"
              class="cursor-pointer flex-none"
              image-class="size-12 rounded-full"
              @click="openContactInformation(data)"
            />

            <div class="min-w-0">
              <div
                v-if="data.name && columnVisibility.name"
                class="truncate cursor-pointer"
                @click="openContactInformation(data)"
              >
                {{ data.name }}
              </div>

              <div
                class="truncate cursor-pointer"
                :class="{
                  'font-extralight': !(!data.name && columnVisibility.name),
                }"
                @click="openContactInformation(data)"
              >
                {{ data.email }}
              </div>
            </div>

            <!-- RIGHT -->
            <div
              v-if="
                showSocialLinksAndPhones(data) &&
                (columnVisibility.same_as || columnVisibility.telephone)
              "
              class="flex md:hidden gap-2 flex-shrink-0"
            >
              <social-links-and-phones
                :social-links="data.same_as"
                :show-social-links="columnVisibility.same_as"
                :phones="data.telephone"
                :show-phones="columnVisibility.telephone"
                :small="true"
              />
            </div>
          </div>

          <div class="flex items-center gap-2 flex-shrink-0">
            <div
              v-if="
                showSocialLinksAndPhones(data) &&
                (columnVisibility.same_as || columnVisibility.telephone)
              "
              class="hidden md:flex gap-2 flex-shrink-0"
            >
              <social-links-and-phones
                :social-links="data.same_as"
                :show-social-links="columnVisibility.same_as"
                :phones="data.telephone"
                :show-phones="columnVisibility.telephone"
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
      v-if="columnVisibility.source"
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
      v-if="columnVisibility.occurrence"
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
      v-if="columnVisibility.recency"
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
      v-if="columnVisibility.replied_conversations"
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
      v-if="columnVisibility.temperature"
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
      v-if="columnVisibility.tags"
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
            v-for="tag of getVisibleTags(data.tags)"
            :key="tag"
            :value="getTagLabel(tag)"
            :severity="getTagColor(tag)"
            class="capitalize font-normal"
          />
          <span
            v-if="getHiddenTagsCount(data.tags)"
            class="text-xs text-surface-600 px-1"
          >
            +{{ getHiddenTagsCount(data.tags) }}
          </span>
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
      v-if="columnVisibility.status"
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
        <span class="state-pill" :class="getStatusClass(data.status)">{{
          getStatusLabel(data.status)
        }}</span>
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

    <!-- Consent -->
    <Column
      v-if="columnVisibility.consent_status"
      field="consent_status"
      filter-field="consent_status"
      sortable
      :show-filter-operator="false"
      :show-filter-match-modes="false"
      :show-add-button="false"
      :filter-menu-style="{ width: '14rem' }"
    >
      <template #header>
        <div v-tooltip.top="t('consent_definition')">
          {{ t('consent') }}
        </div>
      </template>
      <template #body="{ data }">
        <div v-tooltip.bottom="getConsentTooltip(data)">
          <span
            class="state-pill"
            :class="getConsentClass(data.consent_status)"
            >{{ getConsentLabel(data.consent_status) }}</span
          >
        </div>
      </template>
      <template #filter="{ filterModel }">
        <MultiSelect
          v-model="filterModel.value"
          :options="consentStatuses()"
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
      v-if="columnVisibility.recipient"
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
      v-if="columnVisibility.sender"
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
      v-if="columnVisibility.seniority"
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
      v-if="columnVisibility.given_name"
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
      v-if="columnVisibility.family_name"
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
      v-if="columnVisibility.alternate_name"
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
      v-if="columnVisibility.alternate_email"
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
      v-if="columnVisibility.location"
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
      v-if="columnVisibility.works_for"
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
      v-if="columnVisibility.job_title"
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
      v-if="columnVisibility.updated_at"
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
      v-if="columnVisibility.created_at"
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
      v-if="columnVisibility.mining_id"
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
import { useDebounceFn } from '@vueuse/core';
// import { CampaignButton } from '@/utils/extras';
import { useFiltersStore } from '@/stores/filters';
import type { Contact } from '@/types/contact';
import NormalizedLocation from '~/components/icons/NormalizedLocation.vue';
import { useContactsStore } from '~/stores/contacts';
import {
  buildColumnVisibility,
  toStateClass,
} from '~/utils/mining-table-performance';
import {
  consentStatuses,
  getConsentColor,
  getConsentLabel,
  getStatusColor,
  getStatusLabel,
  getTagColor,
  getTagLabel,
  statuses,
  tags,
} from '~/utils/contacts';
import { getImageViaProxy } from '~/utils/images';
import {
  resolveContactsLoadingStrategy,
  resolveMiningTableRows,
} from '~/utils/mining-table';
import Normalizer from '~/utils/normalizer';

const SocialLinksAndPhones = defineAsyncComponent(
  () => import('@/components/icons/SocialLinksAndPhones.vue'),
);
const EnrichButton = defineAsyncComponent(
  () => import('../enrich/EnrichButton.vue'),
);
const ExportContacts = defineAsyncComponent(
  () => import('../buttons/ExportContacts.vue'),
);

const ContactInformationSidebar = defineAsyncComponent(
  () => import('../ContactInformationSidebar.vue'),
);
const CampaignComposerDialog = defineAsyncComponent(
  () => import('~/components/campaigns/CampaignComposerDialog.vue'),
);
const SmsCampaignComposerDialog = defineAsyncComponent(
  () => import('~/components/campaigns/SmsCampaignComposerDialog.vue'),
);
const SmsFleetManagement = defineAsyncComponent(
  () => import('~/components/sms-fleet/SmsFleetManagement.vue'),
);
const RemoveContactButton = defineAsyncComponent(
  () => import('~/components/mining/buttons/RemoveContactButton.vue'),
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
const visibleColumns = computed({
  get: () => $contactsStore.visibleColumns,
  set: (value: string[]) => {
    $contactsStore.visibleColumns = value;
  },
});

const DEFAULT_ROWS_PER_PAGE = 150;
const rowsPerPageOptions = [20, 50, 150, 500, 1000];
const rowsPerPage = ref(DEFAULT_ROWS_PER_PAGE);
const globalFilterFields = [
  'email',
  'name',
  'location',
  'works_for',
  'job_title',
  'location_normalized',
];

function openContactInformation(data: Contact) {
  $contactInformationSidebar.show(data);
}

/* *** Filters *** */
const $filtersStore = useFiltersStore();
const filtersModel = computed({
  get: () => $filtersStore.filters,
  set: (value) => {
    $filtersStore.filters = value;
  },
});
const searchContactModel = computed({
  get: () => $filtersStore.searchContactModel,
  set: (value: string) => {
    $filtersStore.searchContactModel = value;
  },
});

const filteredContacts = ref<Contact[]>([]);
const filteredContactsLength = computed(() => filteredContacts.value?.length);

function getJobDetailsFieldsCount(contact: Contact): number {
  return (
    Number(Boolean(contact.job_title)) +
    Number(Boolean(contact.works_for?.length))
  );
}

const jobDetailsContacts = computed(
  () => contacts.value?.filter((c) => getJobDetailsFieldsCount(c) >= 1) ?? [],
);

const hardFilter = computed(() => $filtersStore.jobDetailsToggle);

const sourceRows = computed(() =>
  hardFilter.value ? jobDetailsContacts.value : (contacts.value ?? []),
);
watch(
  sourceRows,
  (rows) => {
    filteredContacts.value = rows;
  },
  { immediate: true },
);
const columnVisibility = computed(() =>
  buildColumnVisibility(visibleColumns.value),
);
const jobDetailsFields = ['job_title', 'works_for'];
const toggleJobDetailsTooltip = `${t('toggle_job_details_tooltip')} (${jobDetailsFields.map((field) => $t(`contact.${field}`)).join(', ')})`;
const tableRows = computed(() =>
  resolveMiningTableRows({
    hardFilter: hardFilter.value,
    contacts: contacts.value,
    jobDetailsContacts: jobDetailsContacts.value,
  }),
);

const contactsLoadingStrategy = computed(() =>
  resolveContactsLoadingStrategy({ showTable }),
);

/* *** Settings *** */
const settingsPanel = ref();
function toggleSettingsPanel(event: Event) {
  settingsPanel.value.toggle(event);
}

const applyFilteredContacts = useDebounceFn((rows: Contact[]) => {
  filteredContacts.value = rows;
}, 100);

function onFilter($event: DataTableFilterEvent) {
  applyFilteredContacts(
    ($event.filteredValue as Contact[] | undefined) ?? sourceRows.value,
  );
}

function showSocialLinksAndPhones(contact: Contact) {
  return Boolean(contact.same_as?.length || contact.telephone?.length);
}

function getVisibleTags(tagValues?: string[] | null) {
  return (tagValues ?? []).slice(0, 2);
}

function getHiddenTagsCount(tagValues?: string[] | null) {
  const values = tagValues ?? [];
  return Math.max(values.length - 2, 0);
}

function getStatusClass(status: Contact['status']) {
  return toStateClass(getStatusColor(status));
}

function getConsentClass(consentStatus: Contact['consent_status']) {
  return toStateClass(getConsentColor(consentStatus));
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

const updateSelectedEmails = useDebounceFn((emails: string[] | undefined) => {
  $contactsStore.selectedEmails = emails;
}, 120);

const updateSelectedContactsCount = useDebounceFn((count: number) => {
  $contactsStore.selectedContactsCount = count;
}, 120);

watch(
  contactsToTreat,
  (value) => {
    updateSelectedEmails(value);
  },
  { immediate: true },
);

watch(implicitlySelectedContactsLength, () => {
  updateSelectedContactsCount(implicitlySelectedContactsLength.value);
});

/* *** Export CSV *** */

const isExportDisabled = computed(
  () =>
    contactsLength.value === 0 ||
    $leadminerStore.activeMiningTask ||
    $leadminerStore.loadingStatusDns ||
    !implicitlySelectedContactsLength.value,
);

const sendCampaignDialogVisible = ref(false);
const sendSmsCampaignDialogVisible = ref(false);
const showAddGatewayDialog = ref(false);

const isSendByEmailDisabled = computed(() => isExportDisabled.value);

const isSendBySmsDisabled = computed(() => {
  const hasPhones = implicitlySelectedContacts.value.some(
    (c) => c.telephone && c.telephone.length > 0,
  );
  return !hasPhones || isExportDisabled.value;
});

const sendCampaignMenuItems = computed(() => [
  {
    label: t('send_email_campaign'),
    icon: 'pi pi-envelope',
    command: () => {
      openSendContactsDialog();
    },
    disabled: isSendByEmailDisabled.value,
  },
  {
    label: t('send_sms_campaign'),
    icon: 'pi pi-comments',
    command: () => {
      openSendSmsContactsDialog();
    },
    disabled: isSendBySmsDisabled.value,
  },
]);

function openSendContactsDialog() {
  sendCampaignDialogVisible.value = true;
}

function openSendSmsContactsDialog() {
  sendSmsCampaignDialogVisible.value = true;
}

function onSmsCampaignCreated(_campaignId: string) {
  // skipcq: JS-0099 - Placeholder for future SMS campaign tracking
}

const isFullscreen = ref(false);

const $screenStore = useScreenStore();

function formatContactsCountForHeader(count: number) {
  if ($screenStore.size.md || count < 1000) {
    return count.toLocaleString();
  }

  return new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 0,
  })
    .format(count)
    .replace(/\s/g, '')
    .toLowerCase();
}

const visibleColumnsOptions = [
  { label: t('emails'), value: 'contacts' },
  { label: t('source'), value: 'source' },
  { label: t('occurrence'), value: 'occurrence' },
  { label: t('recency'), value: 'recency' },
  { label: t('replies'), value: 'replied_conversations' },
  { label: t('temperature'), value: 'temperature' },
  { label: t('tags'), value: 'tags' },
  { label: t('reachable'), value: 'status' },
  { label: t('consent'), value: 'consent_status' },
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
  if (!visibleColumns.value.includes('contacts')) {
    visibleColumns.value.push('contacts');
  }
}

function getDefaultVisibleColumns() {
  return ['contacts', 'location', 'works_for', 'job_title', 'actions'];
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
const _scrollHeightObserver = ref<ResizeObserver | null>(null);
let idlePrefetchTimeoutId: ReturnType<typeof setTimeout> | null = null;
let idlePrefetchCallbackId: number | null = null;
let contactsLoadPromise: Promise<void> | null = null;
const hasLoadedContacts = ref(false);

function clearIdlePrefetch() {
  if (idlePrefetchTimeoutId) {
    clearTimeout(idlePrefetchTimeoutId);
    idlePrefetchTimeoutId = null;
  }

  if (typeof window === 'undefined' || idlePrefetchCallbackId === null) {
    return;
  }

  if ('cancelIdleCallback' in window) {
    window.cancelIdleCallback(idlePrefetchCallbackId);
  }

  idlePrefetchCallbackId = null;
}

async function loadContactsData() {
  if (hasLoadedContacts.value) {
    return;
  }

  if (contactsLoadPromise) {
    await contactsLoadPromise;
    return;
  }

  contactsLoadPromise = (async () => {
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
    hasLoadedContacts.value = true;
  })();

  try {
    await contactsLoadPromise;
  } finally {
    contactsLoadPromise = null;
    isLoading.value = false;
  }
}

function scheduleIdleContactsPrefetch() {
  clearIdlePrefetch();

  const runPrefetch = () => {
    idlePrefetchTimeoutId = null;
    idlePrefetchCallbackId = null;
    void loadContactsData();
  };

  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    idlePrefetchCallbackId = window.requestIdleCallback(runPrefetch, {
      timeout: 1500,
    });
    return;
  }

  idlePrefetchTimeoutId = setTimeout(runPrefetch, 350);
}

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
});

onBeforeMount(() => {
  isLoading.value = true;
});
onNuxtReady(async () => {
  $screenStore.init();
  $filtersStore.initializeTableFilters(origin);
  $contactsStore.initializeVisibleColumns(getDefaultVisibleColumns(), origin);

  if (contactsLoadingStrategy.value === 'immediate') {
    await loadContactsData();
  } else {
    isLoading.value = false;
    scheduleIdleContactsPrefetch();
  }
  const locationsToNormalize = $contactsStore.getLocationsToNormalize();

  if (origin === 'mine' && locationsToNormalize.length > 0) {
    Normalizer.add(locationsToNormalize);
  }

  $contactsStore.subscribeToRealtimeUpdates();

  const miningId = getParam(MINING_ID_PARAM);
  if (miningId) {
    $filtersStore.filterByMiningId(miningId as string);
    visibleColumns.value.push(MINING_ID_PARAM);
    removeQueryParam(MINING_ID_PARAM);
  }

  if (contactsLoadingStrategy.value === 'immediate') {
    isLoading.value = false;
  }
});

watch(
  () => showTable,
  (isVisible) => {
    if (!isVisible || hasLoadedContacts.value) {
      return;
    }

    clearIdlePrefetch();
    isLoading.value = true;
    void loadContactsData();
  },
);

onUnmounted(() => {
  clearIdlePrefetch();
  $screenStore.destroy();
  $contactsStore.$reset();
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

function getConsentTooltip(data: Contact) {
  if (!data.consent_changed_at) return undefined;

  const date = data.consent_changed_at.toLocaleString();

  if (data.consent_status === 'opt_out') {
    return t('consent_tooltip_opt_out', { date });
  }

  return t('consent_tooltip_default', { date });
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

.p-datatable .p-datatable-tbody > tr > td {
  height: 48px;
  vertical-align: middle;
}

.state-pill {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.1rem 0.5rem;
  font-size: 0.75rem;
  line-height: 1.2;
  font-weight: 500;
}

.state-success {
  color: #166534;
  background: #dcfce7;
}

.state-warn {
  color: #92400e;
  background: #fef3c7;
}

.state-danger {
  color: #991b1b;
  background: #fee2e2;
}

.state-secondary {
  color: #334155;
  background: #e2e8f0;
}

.state-info {
  color: #0c4a6e;
  background: #e0f2fe;
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
    "toggle_hide_unsubscribed_tooltip": "Hide contacts who opted out from receiving your campaign emails",
    "toggle_hide_unsubscribed_label": "Hide unsubscribed contacts",
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
    "consent_definition": "Legal basis used to contact this person",
    "consent": "Consent",
    "consent_legitimate_interest": "Legitimate interest",
    "consent_opt_out": "Opt-out",
    "consent_opt_in": "Opt-in",
    "consent_tooltip_default": "Updated on {date}",
    "consent_tooltip_opt_out": "Opted out on {date}",
    "consent_all": "All",
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
    "send_email_campaign": "Send email campaign",
    "send_sms_campaign": "Send SMS campaign",
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
    "toggle_hide_unsubscribed_tooltip": "Masquer les contacts qui se sont désinscrits de vos campagnes email",
    "toggle_hide_unsubscribed_label": "Cacher les contacts désinscrits",
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
    "consent_definition": "Base légale utilisée pour contacter cette personne",
    "consent": "Consentement",
    "consent_legitimate_interest": "Intérêt légitime",
    "consent_opt_out": "Opposition (opt-out)",
    "consent_opt_in": "Consentement (opt-in)",
    "consent_tooltip_default": "Mis à jour le {date}",
    "consent_tooltip_opt_out": "Désinscrit le {date}",
    "consent_all": "Tous",
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
    "send_email_campaign": "Envoyer une campagne email",
    "send_sms_campaign": "Envoyer une campagne SMS",
    "any": "N'importe lequel",
    "contact_information": "Information de contact"
  }
}
</i18n>
