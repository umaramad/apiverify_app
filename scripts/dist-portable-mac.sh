#!/usr/bin/env bash
# Portable macOS ZIP: extract anywhere and run APIVerify.app (no install).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

unset ELECTRON_RUN_AS_NODE
export CSC_IDENTITY_AUTO_DISCOVERY=false

ARCH="$(uname -m)"
EB_ARCH="--arm64"
if [[ "$ARCH" == "x86_64" ]]; then
  EB_ARCH="--x64"
fi

bash "$ROOT_DIR/scripts/clean-packaging.sh" mac
bash "$ROOT_DIR/scripts/build-fresh.sh"
npx electron-builder --config electron-builder.portable.yml --mac "$EB_ARCH"

ZIP_PATH="$(find "$ROOT_DIR/dist" -maxdepth 1 -name 'APIVerify-*-portable-macos-*.zip' -print | head -n 1)"

echo
if [[ -n "$ZIP_PATH" ]]; then
  zip -j -9 "$ZIP_PATH" "$ROOT_DIR/build/PORTABLE.txt" >/dev/null || true
  bash "$ROOT_DIR/scripts/recompress-portable-zip.sh" "$ZIP_PATH"
  echo
  echo "Portable macOS ZIP ready:"
  echo "  $ZIP_PATH ($(du -h "$ZIP_PATH" | awk '{print $1}'))"
  echo
  echo "Copy this zip to any Mac, unzip, and open APIVerify.app."
  echo "If macOS blocks the app (unsigned), right-click → Open once."
  echo
  echo "Do not commit this zip to Git (100MB host limits). Use Downloads / LFS / releases."
else
  echo "Build finished. Check: $ROOT_DIR/dist/"
fi
