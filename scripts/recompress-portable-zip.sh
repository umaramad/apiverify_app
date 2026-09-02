#!/usr/bin/env bash
# Recompress a portable ZIP with maximum zlib compression (macOS ditto).
# Usage: bash scripts/recompress-portable-zip.sh [path-to.zip]

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ZIP_PATH="${1:-}"

if [[ -z "$ZIP_PATH" ]]; then
  ZIP_PATH="$(find "$ROOT_DIR/dist" -maxdepth 1 -name 'APIVerify-*-portable-*.zip' -print | head -n 1 || true)"
fi

if [[ -z "$ZIP_PATH" || ! -f "$ZIP_PATH" ]]; then
  echo "No portable zip found. Pass a path or build one first." >&2
  exit 1
fi

BEFORE="$(wc -c < "$ZIP_PATH" | tr -d ' ')"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "Recompressing: $ZIP_PATH"
echo "  before: $(awk -v b="$BEFORE" 'BEGIN{printf "%.2f MB", b/1024/1024}')"

ditto -x -k "$ZIP_PATH" "$TMP_DIR/extracted"
# Prefer ditto zlib max; fallback to zip -9
OUT_TMP="$TMP_DIR/out.zip"
(
  cd "$TMP_DIR/extracted"
  # Single top-level item (app or win folder)
  ENTRY="$(ls -1 | head -n 1)"
  ditto -c -k --sequesterRsrc --keepParent --zlibCompressionLevel 9 "$ENTRY" "$OUT_TMP"
)

# Keep PORTABLE.txt inside the archive if present next to the zip build folder
if [[ -f "$ROOT_DIR/build/PORTABLE.txt" ]]; then
  (cd "$ROOT_DIR/build" && zip -9 -X -j "$OUT_TMP" PORTABLE.txt >/dev/null)
fi

mv -f "$OUT_TMP" "$ZIP_PATH"
AFTER="$(wc -c < "$ZIP_PATH" | tr -d ' ')"
echo "  after:  $(awk -v a="$AFTER" 'BEGIN{printf "%.2f MB", a/1024/1024}')"
if (( AFTER < BEFORE )); then
  SAVED=$((BEFORE - AFTER))
  echo "  saved:  $(awk -v s="$SAVED" 'BEGIN{printf "%.2f MB", s/1024/1024}')"
fi

# Soft warning for common Git host limits / project portable budget
if (( AFTER > 95 * 1024 * 1024 )); then
  echo
  echo "WARNING: Zip is still >95MB (portable size budget)."
  echo "Bitbucket/GitHub often reject files over 100MB — do not commit the zip."
  echo "Prefer Bitbucket Downloads / Git LFS / a release CDN."
  exit 1
fi

echo "OK: portable zip is under 95MB."
