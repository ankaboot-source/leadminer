import { FilterService } from '@primevue/core/api';
import { useDebounceFn } from '@vueuse/core';
import { defineStore } from 'pinia';
import {
  ANY_SELECTED,
  createConstraint,
  DEFAULT_FILTERS,
  DEFAULT_TOGGLES,
  GLOBAL_SEARCH,
  LOCATION_MATCH,
  MAX_YEARS_AGO_TO_FILTER,
  NOT_EMPTY,
} from '~/utils/filters-defaults';

type TogglesType = {
  valid: boolean;
  recent: boolean;
  name: boolean;
  replies: boolean;
  telephone: boolean;
  location: boolean;
  hideUnsubscribed: boolean;
};

const VALID_STATUSES = ['VALID', 'UNKNOWN', null /*'UNVERIFIED'*/];

const searchContactModel = ref('');
const filters = ref(JSON.parse(JSON.stringify(DEFAULT_FILTERS)));
const nameToggle = ref(false);
const validToggle = ref(false);
const repliesToggle = ref(false);
const recentToggle = ref(false);
const phoneToggle = ref(false);
const locationToggle = ref(false);
const jobDetailsToggle = ref(false);
const hideUnsubscribedToggle = ref(true);

const isDefaultFilters = computed(
  () => JSON.stringify(filters.value) === JSON.stringify(DEFAULT_FILTERS),
);
const areToggledFilters = computed(
  () =>
    Number(validToggle.value) +
    Number(recentToggle.value) +
    Number(nameToggle.value) +
    Number(repliesToggle.value) +
    Number(phoneToggle.value) +
    Number(locationToggle.value) +
    Number(hideUnsubscribedToggle.value) +
    Number(jobDetailsToggle.value),
);

function checkValidStatus(statusValue = filters.value.status.value) {
  return Boolean(
    statusValue.length === VALID_STATUSES.length &&
      statusValue.every((status: string) => VALID_STATUSES.includes(status)),
  );
}

function updatedStatusValue() {
  const isValidStatus = checkValidStatus();
  if (!isValidStatus && validToggle.value) {
    return VALID_STATUSES;
  } else if (isValidStatus && !validToggle.value) {
    return [];
  }
  return null;
}

function onValidToggle(toggle?: boolean) {
  if (toggle !== undefined) {
    validToggle.value = toggle;
  }

  if (filters.value.status.value === null) {
    filters.value.status.value = [];
  }

  const updatedStatus = updatedStatusValue();
  if (updatedStatus) {
    filters.value.status.value = updatedStatus;
  }
}

function onRepliesToggle(toggle?: boolean) {
  if (toggle !== undefined) {
    repliesToggle.value = toggle;
  }
  filters.value.replied_conversations.constraints = [
    { value: repliesToggle.value ? 1 : null, matchMode: 'gte' },
  ];
}

function onRecentToggle(toggle?: boolean) {
  if (toggle !== undefined) {
    recentToggle.value = toggle;
  }
  filters.value.recency.constraints?.splice(1);
  filters.value.recency.constraints[0].value = recentToggle.value
    ? new Date(
        new Date().setFullYear(
          new Date().getFullYear() - MAX_YEARS_AGO_TO_FILTER,
        ),
      )
    : null;
}

function onPhoneToggle(toggle?: boolean) {
  if (toggle !== undefined) {
    phoneToggle.value = toggle;
    filters.value.telephone.value = toggle || null;
  }
}

function onLocationToggle(toggle?: boolean) {
  if (toggle !== undefined) {
    locationToggle.value = toggle;
    filters.value.location.constraints[1] = createConstraint(NOT_EMPTY, toggle);
    if (!toggle) return;
    const $contactsStore = useContactsStore();
    // make column visible
    if (!$contactsStore.visibleColumns.includes('location')) {
      $contactsStore.visibleColumns.push('location');
    }
  }
}

function onNameToggle(toggle?: boolean) {
  if (toggle !== undefined) {
    nameToggle.value = toggle;
    filters.value.name.value = toggle || null;
  }
}

function onHideUnsubscribedToggle(toggle?: boolean) {
  if (toggle !== undefined) {
    hideUnsubscribedToggle.value = toggle;
  }

  filters.value.consent_status.value = hideUnsubscribedToggle.value
    ? ['legitimate_interest', 'opt_in']
    : [];
}

function watchStatusToggle() {
  return watch(
    () => filters.value.status.value,
    () => {
      validToggle.value = checkValidStatus();
    },
  );
}
function watchRepliesToggle() {
  return watch(
    () => filters.value.replied_conversations.constraints,
    (newRepliesValue) => {
      repliesToggle.value =
        newRepliesValue.length === 1 &&
        newRepliesValue[0].value === 1 &&
        newRepliesValue[0].matchMode === 'gte';
    },
  );
}

function watchRecencyToggle() {
  return watch(
    () => filters.value.recency.constraints,
    (newRecencyConstraints) => {
      recentToggle.value =
        newRecencyConstraints.length === 1 &&
        newRecencyConstraints[0].value?.toLocaleDateString() ===
          new Date(
            new Date().setFullYear(
              new Date().getFullYear() - MAX_YEARS_AGO_TO_FILTER,
            ),
          ).toLocaleDateString();
    },
    { deep: true },
  );
}

function watchLocationToggle() {
  return watch(
    () => filters.value.location.constraints[1],
    (newLocationValue) => {
      locationToggle.value = newLocationValue?.value === true;
    },
  );
}

function watchHideUnsubscribedToggle() {
  return watch(
    () => filters.value.consent_status.value,
    (newConsentValue) => {
      if (!newConsentValue || newConsentValue.length === 0) {
        hideUnsubscribedToggle.value = false;
        return;
      }

      const set = new Set(newConsentValue);
      hideUnsubscribedToggle.value =
        newConsentValue.length === 2 &&
        set.has('legitimate_interest') &&
        set.has('opt_in') &&
        !set.has('opt_out');
    },
    { deep: true },
  );
}

function syncTogglesWithFilters() {
  validToggle.value = checkValidStatus(filters.value.status.value);
  repliesToggle.value =
    filters.value.replied_conversations.constraints.length === 1 &&
    filters.value.replied_conversations.constraints[0].value === 1 &&
    filters.value.replied_conversations.constraints[0].matchMode === 'gte';
  recentToggle.value =
    filters.value.recency.constraints.length === 1 &&
    filters.value.recency.constraints[0].value?.toLocaleDateString() ===
      new Date(
        new Date().setFullYear(
          new Date().getFullYear() - MAX_YEARS_AGO_TO_FILTER,
        ),
      ).toLocaleDateString();
  nameToggle.value = Boolean(filters.value.name.value);
  phoneToggle.value = Boolean(filters.value.telephone.value);
  locationToggle.value = Boolean(
    filters.value.location.constraints?.[1]?.value,
  );

  const consentValues = filters.value.consent_status.value ?? [];
  const consentSet = new Set(consentValues);
  hideUnsubscribedToggle.value =
    consentValues.length === 2 &&
    consentSet.has('legitimate_interest') &&
    consentSet.has('opt_in') &&
    !consentSet.has('opt_out');
}

function registerFiltersAndStartWatchers() {
  const $contactsStore = useContactsStore();

  // Filter registration
  FilterService.register(ANY_SELECTED, (value, filter) =>
    !filter ? true : filter.some((item: string) => value.includes(item)),
  );
  FilterService.register(NOT_EMPTY, (value, filter) =>
    filter ? !(value === undefined || value === null || value === '') : true,
  );

  FilterService.register(LOCATION_MATCH, (value, filter) => {
    if (!filter) return true;
    if (!value) return false;

    const searchTerm = filter.toLowerCase();
    const searchValue = value.toLowerCase();

    // Check original location
    if (searchValue.includes(searchTerm)) return true;

    // Check normalized display name
    const displayName = $contactsStore.combinedLocations
      ?.find((data) => data.location === value)
      ?.display_name?.toLowerCase();

    return displayName?.includes(searchTerm) ?? false;
  });

  FilterService.register(GLOBAL_SEARCH, (value, filter) => {
    if (!filter) return true;
    if (value == null) return false;

    // Handle location_normalized field
    if (typeof value === 'object') {
      try {
        value = value.display_name;
      } catch {
        return false;
      }
    }

    return String(value).toLowerCase().includes(String(filter).toLowerCase());
  });

  const debouncedUpdate = useDebounceFn((newValue: string) => {
    filters.value.global.value = newValue;
  }, 500);

  watch(searchContactModel, (newValue: string) => {
    debouncedUpdate(newValue);
  });

  watchStatusToggle();
  watchRepliesToggle();
  watchRecencyToggle();
  watchLocationToggle();
  watchHideUnsubscribedToggle();
}

function toggleFilters(toggles: TogglesType | boolean = DEFAULT_TOGGLES) {
  if (typeof toggles === 'boolean') {
    toggles = {
      valid: toggles,
      recent: toggles,
      name: toggles,
      replies: toggles,
      telephone: toggles,
      location: toggles,
      hideUnsubscribed: toggles,
    };
  }

  onNameToggle(toggles.name);
  onValidToggle(toggles.valid);
  onRecentToggle(toggles.recent);
  onRepliesToggle(toggles.replies);
  onPhoneToggle(toggles.telephone);
  onLocationToggle(toggles.location);
  onHideUnsubscribedToggle(toggles.hideUnsubscribed);
}

function clearFilter() {
  searchContactModel.value = '';
  jobDetailsToggle.value = false;
  $reset();
  toggleFilters(DEFAULT_TOGGLES);
}

function filterByMiningId(miningId: string) {
  filters.value.mining_id.constraints[0].value = miningId;
}

function $reset() {
  filters.value = structuredClone(DEFAULT_FILTERS);
  syncTogglesWithFilters();
}

export const useFiltersStore = defineStore('filters', () => {
  registerFiltersAndStartWatchers();
  return {
    recentYearsAgo: MAX_YEARS_AGO_TO_FILTER,

    filters,
    searchContactModel,
    nameToggle,
    validToggle,
    repliesToggle,
    recentToggle,
    phoneToggle,
    locationToggle,
    jobDetailsToggle,
    hideUnsubscribedToggle,

    areToggledFilters,
    isDefaultFilters,

    onValidToggle,
    onRepliesToggle,
    onRecentToggle,
    onNameToggle,
    onPhoneToggle,
    onLocationToggle,
    onHideUnsubscribedToggle,

    toggleFilters,
    clearFilter,

    filterByMiningId,

    $reset,
  };
});
