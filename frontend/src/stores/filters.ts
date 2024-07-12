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
  email: {
    value: null,
    matchMode: FilterMatchMode.CONTAINS,
  },

  // Source
  source: {
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

  given_name: {
    value: null,
    matchMode: FilterMatchMode.CONTAINS,
  },
  family_name: {
    value: null,
    matchMode: FilterMatchMode.CONTAINS,
  },
  alternate_names: {
    value: null,
    matchMode: FilterMatchMode.CONTAINS,
  },
  address: {
    value: null,
    matchMode: FilterMatchMode.CONTAINS,
  },
  works_for: {
    value: null,
    matchMode: FilterMatchMode.CONTAINS,
  },
  job_title: {
    value: null,
    matchMode: FilterMatchMode.CONTAINS,
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
    }
  );

  const discussionsToggle = ref(false); // replies: >=1
  function onDiscussionsToggle(toggle?: boolean) {
    if (toggle !== undefined) {
      discussionsToggle.value = toggle;
    }
    filters.value.replied_conversations.value = discussionsToggle.value
      ? 1
      : null;
  }
  watch(
    () => filters.value.replied_conversations.value,
    (newRepliesValue) => {
      discussionsToggle.value = newRepliesValue === 1;
    }
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
          new Date().setFullYear(new Date().getFullYear() - recentYearsAgo)
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
            new Date().setFullYear(new Date().getFullYear() - recentYearsAgo)
          ).toLocaleDateString();
    },
    { deep: true }
  );

  function toggleFilters(value = true) {
    onValidToggle(value);
    onDiscussionsToggle(value);
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
      Number(discussionsToggle.value) +
      Number(recentToggle.value)
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
    discussionsToggle,
    onDiscussionsToggle,
    recentToggle,
    recentYearsAgo,
    onRecentToggle,
  };
});
