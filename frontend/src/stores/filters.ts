import { FilterService } from '@primevue/core/api';
import { useDebounceFn } from '@vueuse/core';
import { defineStore } from 'pinia';
import {
  DEFAULT_TOGGLES,
  DEFAULT_FILTERS,
  ANY_SELECTED,
  MAX_YEARS_AGO_TO_FILTER,
  NOT_EMPTY,
} from '~/utils/filters-defaults';

type TogglesType = {
  valid: boolean;
  recent: boolean;
  name: boolean;
  replies: boolean;
};

const searchContactModel = ref('');
const filters = ref(JSON.parse(JSON.stringify(DEFAULT_FILTERS)));
const nameToggle = ref(false);
const validToggle = ref(false);
const repliesToggle = ref(false);
const recentToggle = ref(false);

const isDefaultFilters = computed(
  () => JSON.stringify(filters.value) === JSON.stringify(DEFAULT_FILTERS),
);
const areToggledFilters = computed(
  () =>
    Number(validToggle.value) +
    Number(recentToggle.value) +
    Number(nameToggle.value) +
    Number(repliesToggle.value),
);

function checkValidStatus() {
  return Boolean(
    filters.value.status.value.length === 1 &&
      filters.value.status.value[0] === 'VALID',
  );
}

function updatedStatusValue() {
  const isValidStatus = checkValidStatus();
  if (!isValidStatus && validToggle.value) {
    return ['VALID'];
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

function onNameToggle(toggle?: boolean) {
  if (toggle !== undefined) {
    nameToggle.value = toggle;
    filters.value.name.value = toggle || null;
  }
}

function watchStatusToggle() {
  return watch(
    () => filters.value.status.value,
    (newStatusValue) => {
      validToggle.value =
        newStatusValue?.length === 1 && newStatusValue[0] === 'VALID';
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

function registerFiltersAndStartWatchers() {
  // Filter registration
  FilterService.register(ANY_SELECTED, (value, filter) =>
    !filter ? true : filter.some((item: string) => value.includes(item)),
  );
  FilterService.register(NOT_EMPTY, (value) =>
    nameToggle.value
      ? !(value === undefined || value === null || value === '')
      : true,
  );

  const debouncedUpdate = useDebounceFn((newValue: string) => {
    filters.value.global.value = newValue;
  }, 500);

  watch(searchContactModel, (newValue: string) => {
    debouncedUpdate(newValue);
  });

  watchStatusToggle();
  watchRepliesToggle();
  watchRecencyToggle();
}

function toggleFilters(toggles: TogglesType | boolean = DEFAULT_TOGGLES) {
  if (typeof toggles === 'boolean') {
    toggles = {
      valid: toggles,
      recent: toggles,
      name: toggles,
      replies: toggles,
    };
  }

  onNameToggle(toggles.name);
  onValidToggle(toggles.valid);
  onRecentToggle(toggles.recent);
  onRepliesToggle(toggles.replies);
}

function clearFilter() {
  searchContactModel.value = '';
  toggleFilters(false);
  $reset();
}

function $reset() {
  filters.value = structuredClone(DEFAULT_FILTERS);
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

    areToggledFilters,
    isDefaultFilters,

    onValidToggle,
    onRepliesToggle,
    onRecentToggle,
    onNameToggle,

    toggleFilters,
    clearFilter,

    $reset,
  };
});
