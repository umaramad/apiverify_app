#!/usr/bin/env bash
# Fast local macOS package: native arch only, .app bundle, no code signing.

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
npx electron-builder --config electron-builder.mac-fast.yml --mac "$EB_ARCH"

APP_PATH=""
if [[ -d "$ROOT_DIR/dist/mac-arm64/APIVerify.app" ]]; then
  APP_PATH="$ROOT_DIR/dist/mac-arm64/APIVerify.app"
elif [[ -d "$ROOT_DIR/dist/mac/APIVerify.app" ]]; then
  APP_PATH="$ROOT_DIR/dist/mac/APIVerify.app"
fi

echo
if [[ -n "$APP_PATH" ]]; then
  echo "Fresh APIVerify.app ready: $APP_PATH"
else
  echo "Build finished. Check: $ROOT_DIR/dist/mac-arm64/ or $ROOT_DIR/dist/mac/"
fi
echo "For a .dmg installer from the same latest code, run: npm run dist:unsigned"
