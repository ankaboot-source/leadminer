> **Proposal, not live doc.** Copy this file to `imap-autoconfig/README.md`. It is not read by agents where it sits now, and it is not the platform's source of truth for this repo — see [../../repo-map.md](../../repo-map.md).
> Verified against `imap-autoconfig@3e0fef6` (2026-10-30). Re-verify before copying.

# imap-autoconfig

> IMAP settings detection for Leadminer. Read this if you need to know how the platform discovers an IMAP host for an email address, or how to build and test this package.

## TL;DR

- The package detects the IMAP host, port, and TLS setting for an email address (`README.md:3`).
- It is published as the npm package `@ankaboot.io/imap-autoconfig` (`package.json:2`).
- Leadminer consumes it in two Supabase edge functions: `supabase/functions/imap/index.ts:5` and `supabase/functions/email-campaigns/index.ts:4`.
- The package entry point exposes `IMAPSettingsDetector`.
- It is a fork of Andris Reinman's `imap-autoconfig` (`README.md:51`).

## What the package does

The detector takes an email address and returns the IMAP host, port, and secure flag (`README.md:33-49`). The TypeScript source is in `src/` and the tests are in `tests/`.

## How Leadminer consumes it

The package is imported by the `imap` and `email-campaigns` edge functions:

- `supabase/functions/imap/index.ts:5` imports `IMAPSettingsDetector` from `npm:@ankaboot.io/imap-autoconfig`.
- `supabase/functions/email-campaigns/index.ts:4` imports the same package.
- `supabase/functions/email-campaigns/deno.json:7` pins the package version as `^1.0.0`.

Both import sites call the detector with the package's default export: `new IMAPSettingsDetector.default().detect(email)` (`supabase/functions/imap/index.ts:90`; `supabase/functions/email-campaigns/index.ts:609`).

## Build and test

```bash
npm run lint
npm run build
npm run test
```

The scripts are declared in `package.json:12-14`. The build uses `tsup` and the tests use `jest` (`package.json:27`; `package.json:37`).

## Known gaps

- The README install command and the README import example disagree. The install command uses `@ankaboot.io/imap-autoconfig` (`README.md:10`); the import example uses `imap-autoconfig` (`README.md:16`). The actual package name is `@ankaboot.io/imap-autoconfig` (`package.json:2`).
- The repository has no `AGENTS.md`.
- The package version in `package.json` is `0.2.0` (`package.json:4`), while the consuming edge function pins `^1.0.0` (`supabase/functions/email-campaigns/deno.json:7`). The published npm version and the repository version are not the same.

## Related docs

- [./AGENTS.md](./AGENTS.md)
- [../../repo-map.md](../../repo-map.md)
- [../../maintenance/doc-health-audit.md](../../maintenance/doc-health-audit.md)
- [../../maintenance/backlog.md](../../maintenance/backlog.md)
