#!/usr/bin/env bash
# Signed macOS release: both archs, DMG + ZIP (requires code signing setup).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

unset ELECTRON_RUN_AS_NODE

bash "$ROOT_DIR/scripts/clean-packaging.sh" mac
bash "$ROOT_DIR/scripts/build-fresh.sh"
# Both archs explicitly (the parent config no longer lists them).
npx electron-builder --mac --arm64 --x64

# Enforce the portable size budget — fail loudly instead of shipping an
# oversized DMG. Zips are warn-only: the x64 signed zip can exceed the
# budget, and the DMG (not the zip) is the hard portable requirement.
echo
echo "Checking packaged artifact sizes against the portable budget..."
bash "$ROOT_DIR/scripts/check-portable-budget.sh" "$ROOT_DIR"/dist/*.dmg
bash "$ROOT_DIR/scripts/check-portable-budget.sh" --warn "$ROOT_DIR"/dist/*.zip

echo
echo "Signed macOS release artifacts are in: $ROOT_DIR/dist"
