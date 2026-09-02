#!/usr/bin/env bash
# Portable Windows ZIP: extract anywhere and run apiverify.exe (no installer).
# Cross-compiles from macOS/Linux when run there; native build when run on Windows.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

unset ELECTRON_RUN_AS_NODE
export CSC_IDENTITY_AUTO_DISCOVERY=false

bash "$ROOT_DIR/scripts/clean-packaging.sh" win
bash "$ROOT_DIR/scripts/build-fresh.sh"
npx electron-builder --config electron-builder.portable.yml --win --x64

ZIP_PATH="$(find "$ROOT_DIR/dist" -maxdepth 1 -name 'APIVerify-*-portable-windows-*.zip' -print | head -n 1)"

echo
if [[ -n "$ZIP_PATH" ]]; then
  zip -j -9 "$ZIP_PATH" "$ROOT_DIR/build/PORTABLE.txt" >/dev/null || true
  bash "$ROOT_DIR/scripts/recompress-portable-zip.sh" "$ZIP_PATH"
  echo
  echo "Portable Windows ZIP ready:"
  echo "  $ZIP_PATH ($(du -h "$ZIP_PATH" | awk '{print $1}'))"
  echo
  echo "Copy this zip to any Windows PC, unzip, and run apiverify.exe."
  echo
  echo "Do not commit this zip to Git (100MB host limits). Use Downloads / LFS / releases."
else
  echo "Build finished. Check: $ROOT_DIR/dist/"
fi
