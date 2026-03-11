# SMS providers design: SMSGate + simple-sms-gateway + Twilio

Date: 2026-03-06
Status: approved

## Goal

Support three SMS providers for campaigns:

1. SMSGate
2. simple-sms-gateway
3. Twilio

Provider selection is manual per campaign (no automatic fallback chain).

## Confirmed decisions

- Use **Option A**: explicit 3-provider support.
- `simple-sms-gateway` credentials are **per-user profile config** (same model as SMSGate).
- Twilio remains **env-based** only.
- Campaign send-time logic uses only the selected provider.

## Approach considered

- Option A (chosen): explicit provider adapters and UI options.
- Option B: merge SMSGate and simple-sms-gateway into one generic provider.
- Option C: backend-only support without UI.

Option A was chosen for clarity and consistency with current architecture.

## Backend design

### Database

- Extend `private.sms_campaigns.provider` valid values to include `simple-sms-gateway`.
- Add profile config fields for `simple-sms-gateway` credentials (base URL, username, password) in `private.profiles`.

### Provider status/config endpoints

- Extend `GET /sms-campaigns/providers/status` with:
  - `simpleSmsGatewayConfigured`
  - `simpleSmsGatewayBaseUrl`
  - `simpleSmsGatewayUsername`
- Add `POST /sms-campaigns/providers/simple-sms-gateway` for saving per-user credentials.

### Provider abstraction

- Add `simple-sms-gateway-provider.ts` in `supabase/functions/sms-campaigns/providers/`.
- Extend provider factory in `providers/mod.ts` to support `simple-sms-gateway`.

### Campaign flow

- Create/preview request model accepts provider enum:
  - `smsgate`
  - `simple-sms-gateway`
  - `twilio`
- Validate selected provider configuration before create/preview.
- Processing uses campaign stored provider only (no fallback chain).

## Frontend design

- Add `simple-sms-gateway` to provider options in SMS composer.
- Show provider-specific config fields for SMSGate and simple-sms-gateway.
- Keep Twilio selectable only when available from provider status.
- Add simple-sms-gateway config panel in account settings (same UX pattern as SMSGate).

## Error handling

- Return explicit `*_NOT_CONFIGURED` errors for each provider.
- Preserve existing quota and validation behavior.

## Verification plan

- Run frontend lint and relevant edge-function checks.
- Validate provider status response includes all three providers.
- Preview/create/process campaigns successfully for each configured provider.
- Confirm `provider` and `provider_used` values match selected provider.

## Notes

- This file is kept in `docs/plans/` for local planning and should remain local.
