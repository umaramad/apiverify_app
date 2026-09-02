#!/usr/bin/env bash
# Compile latest source into out/ (typecheck + electron-vite production build).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

unset ELECTRON_RUN_AS_NODE

echo "→ Removing previous compile output (out/)..."
rm -rf "$ROOT_DIR/out"

echo "→ Compiling latest source (typecheck + electron-vite)..."
npm run build

echo "→ Fresh compile complete: $ROOT_DIR/out"
