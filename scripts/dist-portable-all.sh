#!/usr/bin/env bash
# Build portable ZIPs for macOS and Windows (cross-compile from macOS).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

bash "$ROOT_DIR/scripts/dist-portable-mac.sh"
bash "$ROOT_DIR/scripts/dist-portable-win.sh"

echo
echo "All portable builds:"
find "$ROOT_DIR/dist" -maxdepth 1 -name 'APIVerify-*-portable-*.zip' -print
