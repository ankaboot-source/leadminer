# Sender Options Toast Design

## Context

The campaign composer sender dropdown currently includes unavailable senders as disabled options with inline reasons. Product feedback requires a different UX:

- show only available senders in the dropdown
- show unavailable sender reasons in a one-shot toast
- show this toast each time the dialog opens

Backend sender resolution is already correct and should remain unchanged.

## Goals

1. Keep sender selection list clean: available senders only.
2. Preserve visibility into unavailable senders via a single warning toast per dialog open.
3. Keep fallback sender behavior unchanged when no source sender is available.

## Non-goals

- No API contract change for `campaigns/sender-options`.
- No backend logic changes in `resolveSenderOptions`.
- No persistent banner or inline unavailable list in the dropdown.

## Approach

Implement Option 1 in `CampaignComposerDialog.vue`:

1. Keep all fetched options in a local temporary value.
2. Build unavailable reasons list from `available: false` options.
3. Emit one warning toast (per dialog open) after loading sender options:
   - dedupe repeated reason text
   - if reasons are empty, show a generic fallback message
4. Assign `senderOptions` using only `available: true` items.
5. Remove disabled-option UX and inline unavailable-count hint.

## Data Flow

1. User opens campaign dialog.
2. `loadSenderOptions()` calls `email-campaigns/campaigns/sender-options`.
3. Component receives options and fallback sender email.
4. Component:
   - computes unavailable reasons from raw options
   - triggers one warning toast for this load when at least one sender is unavailable
   - filters list to available options only
   - applies fallback sender option if no available options are returned
   - keeps selection on an available sender

## Error Handling

- Existing sender-options load failure toast remains unchanged.
- Unavailable sender warning toast is non-blocking and does not prevent send.
- If no reason is supplied, use generic translation text.

## i18n

Add toast strings in `en` and `fr`:

- title key for unavailable senders
- detail key with `{reasons}` interpolation
- generic fallback reason key when reason list is empty

## Testing / Verification

Manual checks in campaign composer:

1. With mixed senders (available + unavailable):
   - dropdown shows only available
   - one warning toast appears on open with deduped reasons
2. With all source senders unavailable and fallback available:
   - dropdown includes fallback sender only
   - one warning toast appears
3. Reopen dialog:
   - warning toast appears again once for that open
4. Sender-options request failure:
   - existing error toast behavior unchanged
