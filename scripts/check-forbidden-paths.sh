#!/usr/bin/env sh
# Pre-commit guard: reject staging of AI-assistant artifacts.
# See AGENTS.md -> "Planning Documents" for the rule.
# Exit non-zero on violation; print clear remediation.

set -e

FORBIDDEN_PATTERNS='^(docs/plans/|\.opencode/|\.agents/|skills-lock\.json$)'

staged=$(git diff --cached --name-only --diff-filter=ACMR)

if [ -z "$staged" ]; then
  exit 0
fi

violations=$(printf '%s\n' "$staged" | grep -E "$FORBIDDEN_PATTERNS" || true)

if [ -n "$violations" ]; then
  echo ""
  echo "Refusing to commit: AI-assistant artifacts detected in staged files."
  echo ""
  echo "The following paths must not be committed (see AGENTS.md -> Planning Documents):"
  printf '%s\n' "$violations" | sed 's/^/  - /'
  echo ""
  echo "To unstage and continue, run:"
  echo "  git restore --staged <path>"
  echo ""
  exit 1
fi
