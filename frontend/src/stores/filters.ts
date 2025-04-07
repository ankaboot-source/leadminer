import { FilterService } from '@primevue/core/api';
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
  fullname: boolean;
  replies: boolean;
};

// skipcq: JS-0323
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return function _(...args: Parameters<T>): void {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), wait);
  };
}

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

function onFullnameToggle(toggle?: boolean) {
  if (toggle !== undefined) {
    fullnameToggle.value = toggle;
    filters.value.name.value = toggle || null;
  }
}

function watchSearchModel() {
  const debouncedUpdate = debounce((newValue: string) => {
    filters.value.global.value = newValue;
  }, 500);

  return watch(searchContactModel, (newValue: string) => {
    debouncedUpdate(newValue);
  });
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

function toggleFilters(toggles: TogglesType | boolean = DEFAULT_TOGGLES) {
  if (typeof toggles === 'boolean') {
    toggles = {
      valid: toggles,
      recent: toggles,
      fullname: toggles,
      replies: toggles,
    };
  }

  onFullnameToggle(toggles.fullname);
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
    fullnameToggle,
    validToggle,
    repliesToggle,
    recentToggle,

    areToggledFilters,
    isDefaultFilters,

    onValidToggle,
    onRepliesToggle,
    onRecentToggle,
    onFullnameToggle,

    toggleFilters,
    clearFilter,

    $reset,
  };
});
