import {
  FilterMatchMode,
  FilterOperator,
  FilterService,
} from '@primevue/core/api';
import { defineStore } from 'pinia';

const ANY_SELECTED = 'ANY_SELECTED';
FilterService.register(ANY_SELECTED, (value, filter) =>
  !filter ? true : filter.some((item: string) => value.includes(item)),
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
  email: {
    value: null,
    matchMode: FilterMatchMode.CONTAINS,
  },

  // Source
  source: {
    operator: FilterOperator.AND,
    constraints: [{ value: null, matchMode: FilterMatchMode.CONTAINS }],
  },

  recency: {
    operator: FilterOperator.AND,
    constraints: [{ value: null, matchMode: FilterMatchMode.DATE_AFTER }],
  },

  occurrence: {
    operator: FilterOperator.AND,
    constraints: [
      { value: null, matchMode: FilterMatchMode.GREATER_THAN_OR_EQUAL_TO },
    ],
  },

  // Replies
  replied_conversations: {
    operator: FilterOperator.AND,
    constraints: [
      { value: null, matchMode: FilterMatchMode.GREATER_THAN_OR_EQUAL_TO },
    ],
  },

  tags: { value: null, matchMode: ANY_SELECTED },

  status: { value: [], matchMode: FilterMatchMode.IN },

  recipient: {
    operator: FilterOperator.AND,
    constraints: [
      { value: null, matchMode: FilterMatchMode.GREATER_THAN_OR_EQUAL_TO },
    ],
  },

  sender: {
    operator: FilterOperator.AND,
    constraints: [
      { value: null, matchMode: FilterMatchMode.GREATER_THAN_OR_EQUAL_TO },
    ],
  },

  seniority: {
    operator: FilterOperator.AND,
    constraints: [{ value: null, matchMode: FilterMatchMode.DATE_AFTER }],
  },

  given_name: {
    operator: FilterOperator.AND,
    constraints: [{ value: null, matchMode: FilterMatchMode.CONTAINS }],
  },
  family_name: {
    operator: FilterOperator.AND,
    constraints: [{ value: null, matchMode: FilterMatchMode.CONTAINS }],
  },
  alternate_names: {
    operator: FilterOperator.AND,
    constraints: [{ value: null, matchMode: FilterMatchMode.CONTAINS }],
  },
  address: {
    operator: FilterOperator.AND,
    constraints: [{ value: null, matchMode: FilterMatchMode.CONTAINS }],
  },
  works_for: {
    operator: FilterOperator.AND,
    constraints: [{ value: null, matchMode: FilterMatchMode.CONTAINS }],
  },
  job_title: {
    operator: FilterOperator.AND,
    constraints: [{ value: null, matchMode: FilterMatchMode.CONTAINS }],
  },
};

export const useFiltersStore = defineStore('filters', () => {
  const filters = ref(JSON.parse(JSON.stringify(defaultFilters)));
  function $reset() {
    filters.value = JSON.parse(JSON.stringify(defaultFilters));
  }
  const isDefaultFilters = computed(
    () => JSON.stringify(filters.value) === JSON.stringify(defaultFilters),
  );

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

  const debouncedUpdate = debounce((newValue: string) => {
    filters.value.global.value = newValue;
  }, 500);
  const searchContactModel = ref('');

  watch(searchContactModel, (newValue: string) => {
    debouncedUpdate(newValue);
  });

  const validToggle = ref(false); // status: valid
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
    },
  );

  const repliesToggle = ref(false); // replies: >=1
  function onRepliesToggle(toggle?: boolean) {
    if (toggle !== undefined) {
      repliesToggle.value = toggle;
    }
    filters.value.replied_conversations.constraints = [
      { value: repliesToggle.value ? 1 : null, matchMode: 'gte' },
    ];
  }
  watch(
    () => filters.value.replied_conversations.constraints,
    (newRepliesValue) => {
      repliesToggle.value =
        newRepliesValue.length === 1 &&
        newRepliesValue[0].value === 1 &&
        newRepliesValue[0].matchMode === 'gte';
    },
  );

  const recentToggle = ref(false); // recency: <3 years
  const recentYearsAgo = 3;
  function onRecentToggle(toggle?: boolean) {
    if (toggle !== undefined) {
      recentToggle.value = toggle;
    }
    filters.value.recency.constraints?.splice(1);
    filters.value.recency.constraints[0].value = recentToggle.value
      ? new Date(
          new Date().setFullYear(new Date().getFullYear() - recentYearsAgo),
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
            new Date().setFullYear(new Date().getFullYear() - recentYearsAgo),
          ).toLocaleDateString();
    },
    { deep: true },
  );

  function toggleFilters(value = true) {
    onValidToggle(value);
    onRepliesToggle(value);
    onRecentToggle(value);
  }

  function clearFilter() {
    searchContactModel.value = '';
    toggleFilters(false);
    $reset();
  }

  const areToggledFilters = computed(
    () =>
      Number(validToggle.value) +
      Number(repliesToggle.value) +
      Number(recentToggle.value),
  );

  return {
    filters,
    $reset,
    isDefaultFilters,
    searchContactModel,
    areToggledFilters,
    toggleFilters,
    clearFilter,
    validToggle,
    onValidToggle,
    repliesToggle,
    onRepliesToggle,
    recentToggle,
    recentYearsAgo,
    onRecentToggle,
  };
});
