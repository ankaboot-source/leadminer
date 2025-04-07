import { FilterOperator, FilterMatchMode } from '@primevue/core';

// Filter configuration helpers
function createConstraint(matchMode: string, value: unknown = null) {
  return {
    value,
    matchMode,
  };
}
function createOperatorFilter(
  ...constraints: ReturnType<typeof createConstraint>[]
) {
  return {
    operator: FilterOperator.AND,
    constraints,
  };
}

export const NOT_EMPTY = 'NOT_EMPTY';
export const ANY_SELECTED = 'ANY_SELECTED';
export const MAX_YEARS_AGO_TO_FILTER = 3;

export const DEFAULT_TOGGLES = {
  valid: true,
  recent: false,
  fullname: false,
  replies: false,
};

export const DEFAULT_FILTERS = {
  global: { value: null, matchMode: FilterMatchMode.CONTAINS },
  name: { value: null, matchMode: NOT_EMPTY },
  tags: { value: null, matchMode: ANY_SELECTED },
  status: { value: [], matchMode: FilterMatchMode.IN },
  ...Object.fromEntries(
    [
      'source',
      'given_name',
      'family_name',
      'alternate_name',
      'location',
      'works_for',
      'job_title',
    ].map((key) => [
      key,
      createOperatorFilter(createConstraint(FilterMatchMode.CONTAINS)),
    ]),
  ),
  ...Object.fromEntries(
    ['recency', 'seniority', 'updated_at', 'created_at'].map((key) => [
      key,
      createOperatorFilter(createConstraint(FilterMatchMode.DATE_AFTER)),
    ]),
  ),
  ...Object.fromEntries(
    ['occurrence', 'replied_conversations', 'recipient', 'sender'].map(
      (key) => [
        key,
        createOperatorFilter(
          createConstraint(FilterMatchMode.GREATER_THAN_OR_EQUAL_TO),
        ),
      ],
    ),
  ),
};
