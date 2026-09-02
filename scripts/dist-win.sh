#!/usr/bin/env bash
# Windows NSIS installer from latest source.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

unset ELECTRON_RUN_AS_NODE

bash "$ROOT_DIR/scripts/clean-packaging.sh" win
bash "$ROOT_DIR/scripts/build-fresh.sh"
npx electron-builder --win

echo
echo "Windows installer artifacts are in: $ROOT_DIR/dist"
