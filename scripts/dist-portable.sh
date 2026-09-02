#!/usr/bin/env bash
# Build portable ZIP for the current platform (macOS or Windows).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

case "$(uname -s)" in
  Darwin)
    bash "$ROOT_DIR/scripts/dist-portable-mac.sh"
    ;;
  MINGW*|MSYS*|CYGWIN*|Windows*)
    bash "$ROOT_DIR/scripts/dist-portable-win.sh"
    ;;
  *)
    echo "Portable packaging is supported on macOS and Windows." >&2
    echo "Run on one of those platforms, or use:" >&2
    echo "  npm run dist:portable:mac" >&2
    echo "  npm run dist:portable:win" >&2
    exit 1
    ;;
esac
