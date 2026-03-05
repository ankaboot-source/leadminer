# Shared HTTP Redirect Helper (Design)

Goal

- Centralize redirect response construction for edge functions so CORS headers are always included.

Scope

- Move buildRedirectResponse into shared utilities.
- Update email-campaigns to import shared helper.
- No behavior changes to redirect status or destination URLs.

Architecture

- New shared module: `supabase/functions/_shared/http.ts`.
- Helper uses existing `cors.ts` and returns a 302 with Location.
- Edge functions call helper instead of inline Response construction.

Components & Data Flow

- `_shared/http.ts`: `buildRedirectResponse(location)`.
- `email-campaigns/index.ts`: uses helper in `/track/click/:token` and `/unsubscribe/:token` paths.
- Future edge functions can reuse the helper to avoid CORS drift.

Error Handling

- No new error behavior; redirects remain 302 and preserve target URL.

Testing

- Deno unit test validates status, Location, and CORS headers for helper.
