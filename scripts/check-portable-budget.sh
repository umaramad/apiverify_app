#!/usr/bin/env bash
# Enforce the portable-artifact size budget (default 95MiB).
#
# Usage: bash scripts/check-portable-budget.sh [--warn] <file>...
#   - FAILS (exit 1) if any file exceeds the budget (strict mode).
#   - --warn  : report over-budget files but exit 0 (does not block the build).
#   - Warns when a file is within 5MB of the budget in either mode.
#   - Override the budget with APIVERIFY_SIZE_BUDGET_MB.
#
# Sizes are compared in BYTES against a 95MiB ceiling (95 * 1024 * 1024),
# matching the inline check in recompress-portable-zip.sh. `du -m` is NOT
# used: on macOS it reports inflated block counts for DMG/ZIP files.

set -euo pipefail

BUDGET_MB="${APIVERIFY_SIZE_BUDGET_MB:-95}"
BUDGET_BYTES=$((BUDGET_MB * 1024 * 1024))
WARN_AT_BYTES=$((BUDGET_BYTES - 5 * 1024 * 1024))
WARN_ONLY=0
FAILED=0
SEEN=0

if [[ "${1:-}" == "--warn" ]]; then
  WARN_ONLY=1
  shift
fi

for f in "$@"; do
  if [[ ! -f "$f" ]]; then
    echo "  (skip) $f — not found" >&2
    continue
  fi
  SEEN=1
  SIZE_BYTES="$(wc -c < "$f" | tr -d ' ')"
  SIZE_PRETTY="$(awk -v b="$SIZE_BYTES" 'BEGIN{printf "%.1f", b/1024/1024}')"
  if (( SIZE_BYTES > BUDGET_BYTES )); then
    echo "  ✗ FAIL  $f  ${SIZE_PRETTY}MB — exceeds the ${BUDGET_MB}MB portable budget" >&2
    FAILED=1
  elif (( SIZE_BYTES > WARN_AT_BYTES )); then
    echo "  ! warn  $f  ${SIZE_PRETTY}MB — within 5MB of the ${BUDGET_MB}MB budget"
  else
    echo "  ✓ ok    $f  ${SIZE_PRETTY}MB (budget ${BUDGET_MB}MB)"
  fi
done

if (( SEEN == 0 )); then
  echo "ERROR: no artifacts matched — check the glob/path passed to check-portable-budget.sh." >&2
  exit 1
fi

if (( FAILED )); then
  if (( WARN_ONLY )); then
    echo "WARNING: one or more artifacts exceed the ${BUDGET_MB}MB budget (warn-only mode)." >&2
    exit 0
  fi
  echo "ERROR: one or more artifacts exceed the ${BUDGET_MB}MB portable budget." >&2
  exit 1
fi

echo "OK: all artifacts are within the ${BUDGET_MB}MB portable budget."
