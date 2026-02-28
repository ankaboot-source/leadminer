# Campaigns Loading Skeleton Design

## Context

The `Sources` page already shows a loading skeleton during the initial fetch when no data is available. The `Campaigns` page currently shows only `DataView` and empty state, which feels abrupt during first load.

## Goal

Show a loading skeleton in `Campaigns` with the same behavior as `Sources`:

- visible only during first load
- only when the campaigns list is still empty
- no skeleton during refresh when campaigns are already displayed

## UX Decision

Use an inline skeleton block in `campaigns.vue` (same pattern as `sources.vue`) with 3 placeholder cards and summary metric placeholders. Keep layout close to actual campaign cards to reduce visual jump when data appears.

## Scope

- Modify `frontend/src/pages/campaigns.vue` only.
- No store/API changes.
- No behavior changes to polling, refresh, or dialogs.

## Rendering Rule

Skeleton condition:

`$campaignsStore.isLoading && !$campaignsStore.campaigns.length`

This ensures:

- first load: skeleton appears
- subsequent refreshes with existing data: existing cards remain visible

## Verification

1. Open Campaigns with empty cache/session: skeleton appears before data.
2. After data loads: list replaces skeleton.
3. Click refresh with existing campaigns: keep list visible, no skeleton flash.
