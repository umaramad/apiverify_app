#!/usr/bin/env bash
# Remove stale packaged artifacts so the next build ships the latest compile.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCOPE="${1:-all}"

clean_mac() {
  echo "→ Removing stale macOS packages from dist/..."
  rm -rf "$ROOT_DIR/dist/mac" "$ROOT_DIR/dist/mac-arm64" "$ROOT_DIR/dist/APIVerify.app" || true
  rm -f "$ROOT_DIR/dist"/APIVerify-*.dmg || true
  rm -f "$ROOT_DIR/dist"/APIVerify-*-portable-macos-*.zip || true
  rm -f "$ROOT_DIR/dist"/APIVerify-*.zip || true
  rm -f "$ROOT_DIR/dist"/*.blockmap || true
}

clean_win() {
  echo "→ Removing stale Windows packages from dist/..."
  rm -f "$ROOT_DIR/dist"/*.exe || true
  rm -f "$ROOT_DIR/dist"/*-setup.exe || true
  rm -f "$ROOT_DIR/dist"/APIVerify-*-portable-windows-*.zip || true
  rm -rf "$ROOT_DIR/dist"/win-unpacked || true
}

case "$SCOPE" in
  mac)
    clean_mac
    ;;
  win)
    clean_win
    ;;
  all)
    clean_mac
    clean_win
    ;;
  *)
    echo "Usage: clean-packaging.sh [mac|win|all]" >&2
    exit 1
    ;;
esac
