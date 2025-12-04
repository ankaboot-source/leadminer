import { FilterMatchMode, FilterOperator } from '@primevue/core';

// Filter configuration helpers
export function createConstraint(matchMode: string, value: unknown = null) {
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
export const LOCATION_MATCH = 'LOCATION_MATCH';
export const MAX_YEARS_AGO_TO_FILTER = 3;
export const DEEP_CONTAINS = 'DEEP_CONTAINS'; // Contains but for objects as well as strings

export const DEFAULT_TOGGLES = {
  valid: true,
  recent: false,
  name: false,
  replies: false,
  telephone: false,
  location: false,
};

export const DEFAULT_FILTERS = {
  global: createConstraint(DEEP_CONTAINS),
  name: { value: null, matchMode: NOT_EMPTY },
  telephone: { value: null, matchMode: NOT_EMPTY },
  tags: { value: null, matchMode: ANY_SELECTED },
  status: { value: [], matchMode: FilterMatchMode.IN },
  location: createOperatorFilter(createConstraint(LOCATION_MATCH)),
  ...Object.fromEntries(
    [
      'source',
      'given_name',
      'family_name',
      'alternate_name',
      'works_for',
      'job_title',
      'mining_id',
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
    [
      'occurrence',
      'replied_conversations',
      'recipient',
      'sender',
      'temperature',
    ].map((key) => [
      key,
      createOperatorFilter(
        createConstraint(FilterMatchMode.GREATER_THAN_OR_EQUAL_TO),
      ),
    ]),
  ),
};
