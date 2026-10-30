> **Proposal, not live doc.** Copy this file to `imap-autoconfig/AGENTS.md`. It is not read by agents where it sits now, and it is not the platform's source of truth for this repo — see [../../repo-map.md](../../repo-map.md).
> Verified against `imap-autoconfig@3e0fef6` (2026-10-30). Re-verify before copying.

# Agent instructions for `imap-autoconfig`

This package detects IMAP connection settings for an email address. Read `README.md` for the public behavior and the consumers. This file gives the commands and rules an agent needs before it changes the detector or publishes a version.

## What this repository owns

- The TypeScript detector (`src/`).
- The Jest tests (`tests/`).
- The `tsup` build configuration (`tsup.config.ts`).

## Commands

```bash
npm run lint
npm run build
npm run test
```

The scripts are in `package.json:12-14`. The build uses `tsup` (`package.json:27`) and the tests use `jest` (`package.json:37`).

## Rules

### Keep the public package name stable

The package is published as `@ankaboot.io/imap-autoconfig` (`package.json:2`). Two edge functions import that name (`supabase/functions/imap/index.ts:5`; `supabase/functions/email-campaigns/index.ts:4`). Renaming the package breaks both.

### Keep the default export shape stable

Both consumers instantiate the detector as `new IMAPSettingsDetector.default().detect(email)` (`supabase/functions/imap/index.ts:90`; `supabase/functions/email-campaigns/index.ts:609`). Changing the export shape breaks both call sites.

### Update the README example when you change the import style

The README shows `import IMAPSettingsDetector from 'imap-autoconfig'` (`README.md:16`), while the package name is `@ankaboot.io/imap-autoconfig` (`package.json:2`). The example is inconsistent with the package name. Fix the README when you touch the export or the package metadata.

## Gotchas

- The consuming edge function pins `^1.0.0` (`supabase/functions/email-campaigns/deno.json:7`), while the repository `package.json` declares `0.2.0` (`package.json:4`). Confirm which version is published before you bump the repository version.
- The repository has no `AGENTS.md` today. This file is a proposal.
- The package is a fork of `andris9/imap-autoconfig` (`README.md:51`). Keep the fork's license and attribution.

## Known gaps

- The README import example does not match the package name.
- The published npm version and the repository version are not the same.

## Related docs

- [./README.md](./README.md)
- [../../repo-map.md](../../repo-map.md)
- [../../../runbooks/deploy.md](../../../runbooks/deploy.md)
