#!/usr/bin/env bash
# Unsigned macOS DMG for the current machine's architecture (no code signing).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

unset ELECTRON_RUN_AS_NODE
export CSC_IDENTITY_AUTO_DISCOVERY=false

ARCH="$(uname -m)"
EB_ARCH="--arm64"
DMG_NAME="APIVerify-1.0.0-arm64.dmg"
if [[ "$ARCH" == "x86_64" ]]; then
  EB_ARCH="--x64"
  DMG_NAME="APIVerify-1.0.0-x64.dmg"
fi

bash "$ROOT_DIR/scripts/clean-packaging.sh" mac
bash "$ROOT_DIR/scripts/build-fresh.sh"
npx electron-builder --config electron-builder.mac-unsigned.yml --mac "$EB_ARCH"

# Enforce the portable size budget — fail loudly instead of shipping an
# oversized artifact (mirrors the zip check in recompress-portable-zip.sh).
echo
echo "Checking packaged artifact sizes against the portable budget..."
bash "$ROOT_DIR/scripts/check-portable-budget.sh" "$ROOT_DIR"/dist/*.dmg "$ROOT_DIR"/dist/*.zip

echo
echo "Fresh DMG ready: $ROOT_DIR/dist/$DMG_NAME"
echo "Open the DMG and drag APIVerify to Applications (replace any existing copy)."
