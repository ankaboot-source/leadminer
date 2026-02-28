# Campaigns Initial Loading Skeleton Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Sources-style skeleton to Campaigns during initial load only, while keeping existing list visible during refreshes.

**Architecture:** Implement the skeleton directly in `campaigns.vue` with a `v-if` block that mirrors the existing pattern in `sources.vue`. Keep all store logic unchanged and drive rendering purely from `$campaignsStore.isLoading` and `$campaignsStore.campaigns.length`. Maintain current DataView and action dialogs in the `v-else` path.

**Tech Stack:** Nuxt 3, Vue 3 `script setup`, PrimeVue (`Skeleton`, `DataView`, `Button`, `Tag`), Tailwind utility classes.

---

### Task 1: Add initial-load skeleton block to Campaigns page

**Files:**

- Modify: `frontend/src/pages/campaigns.vue`

**Step 1: Write the failing test**

- Add a rendering test for `campaigns.vue` that expects skeleton cards when loading is true and campaigns list is empty.
- If a page-level test harness does not exist, document a manual failing check in dev mode before coding.

**Step 2: Run test to verify it fails**

Run: `npm run test --prefix ./frontend -- --run <campaigns-page-test-file>`
Expected: FAIL because no campaign skeleton markup exists yet.

**Step 3: Write minimal implementation**

- In template, insert `v-if="$campaignsStore.isLoading && !$campaignsStore.campaigns.length"` block above `DataView`.
- Render 3 skeleton campaign cards with:
  - header placeholders (subject + sender)
  - action/tag placeholders on the right
  - 5 metric placeholders in grid to match campaign stats layout
- Keep existing `DataView` and dialogs in `v-else` unchanged.

**Step 4: Run test to verify it passes**

Run: `npm run test --prefix ./frontend -- --run <campaigns-page-test-file>`
Expected: PASS for loading skeleton behavior.

**Step 5: Commit**

```bash
git add frontend/src/pages/campaigns.vue
git commit -m "feat: add initial loading skeleton to campaigns page"
```

### Task 2: Verify no skeleton during refresh with existing campaigns

**Files:**

- Modify: `frontend/src/pages/campaigns.vue` (only if conditional fix needed)
- Test: `frontend/src/pages/campaigns.vue` rendering test file (or manual checklist)

**Step 1: Write the failing test**

- Add a test asserting no skeleton is shown when `isLoading` is true but campaigns list is non-empty.

**Step 2: Run test to verify it fails**

Run: `npm run test --prefix ./frontend -- --run <campaigns-page-test-file>`
Expected: FAIL if condition is too broad.

**Step 3: Write minimal implementation**

- Ensure skeleton guard remains exactly:
  - loading true
  - campaigns length equals zero

**Step 4: Run test to verify it passes**

Run: `npm run test --prefix ./frontend -- --run <campaigns-page-test-file>`
Expected: PASS for refresh behavior.

**Step 5: Commit**

```bash
git add frontend/src/pages/campaigns.vue <campaigns-page-test-file>
git commit -m "test: enforce campaigns skeleton only on initial empty load"
```

### Task 3: Validation and PR update

**Files:**

- Modify: none expected

**Step 1: Lint touched page**

Run: `npm run lint --prefix ./frontend -- src/pages/campaigns.vue`
Expected: no new lint errors from touched file.

**Step 2: Run targeted tests**

Run: `npm run test --prefix ./frontend -- --run <campaigns-page-test-file>`
Expected: passing tests for loading state rendering.

**Step 3: Manual validation**

- Open `/campaigns` with empty initial list: skeleton appears.
- After first fetch: skeleton disappears and cards render.
- Trigger refresh with existing cards: cards stay visible, no skeleton flash.

**Step 4: Push branch**

```bash
git push -u origin <branch>
```

**Step 5: Update or create PR**

If PR already exists for this branch, update PR description with the skeleton change; otherwise create a new PR.
