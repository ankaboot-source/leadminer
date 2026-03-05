# Short URLs for Email Tracking (Design)

Goal

- Replace long Supabase function URLs in email tracking (open/click/unsubscribe) with short frontend-domain paths.
- Keep existing tokens and tracking data model unchanged.

Scope

- Nuxt server routes for /o/:token, /c/:token, /u/:token to proxy to the email-campaigns edge function.
- Email-campaigns edge function generates short links using the frontend domain.
- No new database columns or tokens.

Architecture

- Nuxt/Nitro handles public short routes and forwards requests to Supabase edge function paths.
- Edge function remains the source of truth for tracking, logging events, and redirects.
- URL base for short links: FRONTEND_HOST (preferred) or public Supabase URL fallback.

Data Flow

- Email send flow generates tracking URLs using buildOpenTrackingUrl/buildClickTrackingUrl/buildUnsubscribeUrl.
- Email HTML includes short links and pixel URL.
- Nuxt routes proxy to:
  - /track/open/:token (returns 1x1 GIF)
  - /track/click/:token (logs click, 302 to original URL)
  - /unsubscribe/:token (updates consent, 302 to frontend success/failure)

Error Handling

- Missing token in Nuxt route returns 400.
- Missing SAAS_SUPABASE_PROJECT_URL in frontend config returns 500.
- Invalid tracking token returns 404 from edge function.
- Redirect responses include CORS headers for consistency.

Risks and Mitigations

- Misconfigured FRONTEND_HOST could break unsubscribe redirects: ensure env is set in edge function runtime.
- Proxy failures return explicit errors to aid debugging.
- No new persistence changes reduces migration risk.

Testing

- Local end-to-end: create campaign, verify /o, /c, /u links resolve and log events.
- Verify redirects preserve status codes and headers.
- Spot-check unsubscribe success/failure paths.
