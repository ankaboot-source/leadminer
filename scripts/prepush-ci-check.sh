#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

BASE_REF="origin/main"

if ! git rev-parse --verify --quiet "$BASE_REF" >/dev/null; then
  echo "[pre-push] Skipping checks: $BASE_REF not found. Run: git fetch origin main"
  exit 0
fi

MERGE_BASE="$(git merge-base HEAD "$BASE_REF")"
CHANGED_FILES="$(git diff --name-only "$MERGE_BASE"...HEAD)"

if [ -z "$CHANGED_FILES" ]; then
  echo "[pre-push] No changes detected against $BASE_REF."
  exit 0
fi

RUN_BACKEND=0
RUN_FRONTEND=0

while IFS= read -r file; do
  case "$file" in
    backend/*)
      RUN_BACKEND=1
      ;;
    frontend/*)
      RUN_FRONTEND=1
      ;;
  esac
done <<< "$CHANGED_FILES"

if [ "$RUN_BACKEND" -eq 0 ] && [ "$RUN_FRONTEND" -eq 0 ]; then
  echo "[pre-push] No backend/frontend changes detected."
  exit 0
fi

echo "[pre-push] Running CI-aligned checks..."

if [ "$RUN_BACKEND" -eq 1 ]; then
  echo "[pre-push] backend: test-ci:unit"
  npm run test-ci:unit --prefix ./backend
  echo "[pre-push] backend: lint"
  npm run lint --prefix ./backend
  echo "[pre-push] backend: prettier"
  npm run prettier --prefix ./backend
fi

if [ "$RUN_FRONTEND" -eq 1 ]; then
  echo "[pre-push] frontend: lint"
  npm run lint --prefix ./frontend
  echo "[pre-push] frontend: prettier"
  npm run prettier --prefix ./frontend
fi

echo "[pre-push] All checks passed."
