# Frontend

The Nuxt 4 application: 16 pages under `src/pages/` and 11 Pinia stores under
`src/stores/`. It starts mining runs, consumes progress over SSE, and renders
contacts and campaigns.

```bash
npm run test    # Vitest
npm run lint    # ESLint
```

The Vitest suite in `src/tests/` is **not** run by CI, so run it yourself before
opening a pull request. CI checks lint and formatting only.

Design conventions live in [`DESIGN.md`](DESIGN.md). For where the frontend sits
among the other processes, see [`docs/architecture.md`](../docs/architecture.md).
