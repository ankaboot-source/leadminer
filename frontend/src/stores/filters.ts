import { defineStore } from 'pinia';
import { FilterMatchMode, FilterOperator, FilterService } from 'primevue/api';

const ANY_SELECTED = 'ANY_SELECTED';
FilterService.register(ANY_SELECTED, (value, filter) =>
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
  tags: { value: null, matchMode: ANY_SELECTED },

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

export const useFiltersStore = defineStore('filters', () => {
  const filters = ref(JSON.parse(JSON.stringify(defaultFilters)));
  function $reset() {
    filters.value = JSON.parse(JSON.stringify(defaultFilters));
  }
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

  return {
    filters,
    $reset,
    isDefaultFilters,
    debouncedUpdate,
  };
});
