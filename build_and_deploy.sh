#!/usr/bin/env bash
# APIVerify — interactive build & deploy helper
# Run locally, build DMG / portable ZIP / Windows packages from latest source.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# Cursor/IDE terminals sometimes set this and break Electron native modules.
unset ELECTRON_RUN_AS_NODE

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info() { echo -e "${CYAN}$*${NC}"; }
ok() { echo -e "${GREEN}$*${NC}"; }
warn() { echo -e "${YELLOW}$*${NC}"; }
err() { echo -e "${RED}$*${NC}" >&2; }

require_npm() {
  if ! command -v npm >/dev/null 2>&1; then
    err "npm is not installed or not on PATH."
    exit 1
  fi
}

pause() {
  echo
  read -r -p "Press Enter to return to the menu..."
}

run_cmd() {
  info "→ $*"
  echo
  if "$@"; then
    echo
    ok "Done."
  else
    local code=$?
    echo
    err "Command failed (exit ${code})."
    return "$code"
  fi
}

show_build_outputs() {
  if [[ -d "$ROOT_DIR/out" ]]; then
    ok "Compiled source: $ROOT_DIR/out"
  fi
  if [[ -d "$ROOT_DIR/dist" ]]; then
    ok "Packaged artifacts: $ROOT_DIR/dist"
    ls -lt "$ROOT_DIR/dist" 2>/dev/null | head -16 || true
  fi
}

is_windows_shell() {
  local os
  os="$(uname -s 2>/dev/null || true)"
  [[ "$os" == MINGW* || "$os" == MSYS* || "$os" == CYGWIN* || "$os" == Windows_NT ]]
}

do_build() {
  info "Fresh compile from latest source (clears out/, then typecheck + electron-vite)..."
  if [[ -f "$ROOT_DIR/scripts/build-fresh.sh" ]]; then
    run_cmd bash "$ROOT_DIR/scripts/build-fresh.sh"
  else
    run_cmd npm run build
  fi
  show_build_outputs
}

do_run_local() {
  echo
  echo -e "${BOLD}Run locally${NC}"
  echo "  1) Development mode (hot reload) — npm run dev"
  echo "  2) Production preview (fresh compile, then run) — npm run start"
  echo "  3) Back"
  echo
  read -r -p "Choose [1-3]: " choice
  case "$choice" in
    1)
      info "Starting dev server (live source + hot reload)..."
      run_cmd npm run dev || true
      ;;
    2)
      info "Fresh compile, then production preview..."
      if [[ -f "$ROOT_DIR/scripts/build-fresh.sh" ]]; then
        run_cmd bash "$ROOT_DIR/scripts/build-fresh.sh"
      else
        run_cmd npm run build
      fi
      run_cmd npm run rebuild:electron
      info "Starting production preview..."
      run_cmd env -u ELECTRON_RUN_AS_NODE npx electron-vite preview --skipBuild || true
      ;;
    3)
      return 0
      ;;
    *)
      warn "Invalid choice."
      ;;
  esac
}

do_mac_dmg() {
  echo
  echo -e "${BOLD}macOS DMG / .app package${NC}"
  echo "  Compiles latest source, then packages an installer or .app."
  echo
  echo "  1) Fast .app only (current arch, no DMG) — npm run dist:fast"
  echo "  2) Unsigned DMG installer (current arch, recommended) — npm run dist:unsigned"
  echo "  3) Signed release (both archs, DMG + ZIP) — npm run dist:signed"
  echo "  4) Back"
  echo
  read -r -p "Choose [1-4]: " choice
  case "$choice" in
    1)
      run_cmd npm run dist:fast
      ;;
    2)
      run_cmd npm run dist:unsigned
      ;;
    3)
      warn "Signed release builds arm64 + x64 and can take 10–30+ minutes."
      read -r -p "Continue with signed release? [y/N]: " confirm
      [[ "$confirm" =~ ^[Yy]$ ]] || return 0
      run_cmd npm run dist:signed
      ;;
    4)
      return 0
      ;;
    *)
      warn "Invalid choice."
      return 0
      ;;
  esac

  echo
  show_build_outputs
}

do_portable() {
  echo
  echo -e "${BOLD}Portable package (no install — copy & run)${NC}"
  echo "  Extract on any machine; no installer or Node.js required on target."
  echo "  Portable macOS zip is recompressed toward the ~95MB size budget."
  echo
  echo "  1) Current platform only — npm run dist:portable"
  echo "  2) macOS portable ZIP — npm run dist:portable:mac"
  echo "  3) Windows portable ZIP (can build from macOS) — npm run dist:portable:win"
  echo "  4) Both Mac + Windows portable ZIPs — npm run dist:portable:all"
  echo "  5) Back"
  echo
  read -r -p "Choose [1-5]: " choice
  case "$choice" in
    1)
      run_cmd npm run dist:portable
      ;;
    2)
      run_cmd npm run dist:portable:mac
      ;;
    3)
      if ! is_windows_shell && [[ "$(uname -s)" != "Darwin" ]]; then
        warn "Windows portable zips are usually built on macOS or Windows."
        read -r -p "Continue anyway? [y/N]: " confirm
        [[ "$confirm" =~ ^[Yy]$ ]] || return 0
      fi
      run_cmd npm run dist:portable:win
      ;;
    4)
      warn "Builds both macOS and Windows portable zips; can take several minutes."
      read -r -p "Continue? [y/N]: " confirm
      [[ "$confirm" =~ ^[Yy]$ ]] || return 0
      run_cmd npm run dist:portable:all
      ;;
    5)
      return 0
      ;;
    *)
      warn "Invalid choice."
      return 0
      ;;
  esac

  echo
  show_build_outputs
}

do_win_release() {
  echo
  if ! is_windows_shell; then
    warn "Windows installers are usually built on Windows."
    warn "Cross-building from macOS may require Wine and extra setup."
    read -r -p "Continue anyway? [y/N]: " confirm
    [[ "$confirm" =~ ^[Yy]$ ]] || return 0
  fi

  info "Fresh compile + Windows NSIS installer..."
  run_cmd npm run build:win
  echo
  show_build_outputs
}

do_tests() {
  info "Running unit tests (vitest)..."
  run_cmd npm test || true
}

do_setup_new_machine() {
  echo
  echo -e "${BOLD}Setup on a new machine${NC}"
  echo "  Installs npm dependencies and rebuilds Electron native modules"
  echo "  (needed once after clone, or when node_modules is missing)."
  echo
  echo "  1) npm install + rebuild native modules (recommended first step)"
  echo "  2) npm install + rebuild + local build (compile to out/)"
  echo "  3) npm install + rebuild + run in development mode"
  echo "  4) Back"
  echo
  read -r -p "Choose [1-4]: " choice
  case "$choice" in
    1)
      do_npm_install
      ;;
    2)
      do_npm_install || return 0
      do_build || true
      ;;
    3)
      do_npm_install || return 0
      info "Starting development mode..."
      run_cmd npm run dev || true
      ;;
    4)
      return 0
      ;;
    *)
      warn "Invalid choice."
      ;;
  esac
}

do_npm_install() {
  info "Installing dependencies (npm install)..."
  run_cmd npm install || return 1
  info "Rebuilding Electron native modules (better-sqlite3)..."
  run_cmd npm run rebuild:electron || {
    warn "electron rebuild failed — try again after fixing Python/Xcode toolchain."
    return 1
  }
  ok "Dependencies ready. You can now Run locally or package a DMG/portable build."
}

show_menu() {
  echo
  echo -e "${BOLD}APIVerify — Build & Deploy${NC}"
  echo "────────────────────────────────────────"
  echo "  1) Setup new machine (npm install + rebuild)"
  echo "  2) Build only — fresh compile to out/"
  echo "  3) Run locally (dev or production preview)"
  echo "  4) Create macOS DMG / .app"
  echo "  5) Create portable ZIP (Mac / Windows)"
  echo "  6) Create Windows installer"
  echo "  7) Run tests"
  echo "  8) Exit"
  echo "────────────────────────────────────────"
  echo "  On a new machine: choose 1 first, then 3 to run."
}

usage() {
  cat <<'EOF'
Usage: ./build_and_deploy.sh [command]

Interactive menu (default) or one-shot command:

  menu              Interactive menu (default)
  setup | install   npm install + rebuild Electron natives (new machine)
  setup:build       setup + fresh local compile to out/
  local | dev       Run development mode (npm run dev)
  preview           Fresh build + production preview
  build             Fresh compile only
  dmg               Unsigned macOS DMG (npm run dist:unsigned)
  app               Fast macOS .app only (npm run dist:fast)
  portable          Portable ZIP for current platform
  portable:mac      macOS portable ZIP
  portable:win      Windows portable ZIP
  portable:all      Mac + Windows portable ZIPs
  win               Windows NSIS installer
  test              Run vitest
  help              Show this help

Examples:
  ./build_and_deploy.sh
  ./build_and_deploy.sh setup
  ./build_and_deploy.sh setup:build
  ./build_and_deploy.sh local
  ./build_and_deploy.sh dmg
  ./build_and_deploy.sh portable:mac
EOF
}

run_oneshot() {
  case "$1" in
    menu)
      return 1
      ;;
    setup|install|npm-install)
      do_npm_install
      ;;
    setup:build|install:build)
      do_npm_install || exit 1
      do_build
      ;;
    local|dev)
      run_cmd npm run dev || true
      ;;
    preview|start)
      if [[ -f "$ROOT_DIR/scripts/build-fresh.sh" ]]; then
        run_cmd bash "$ROOT_DIR/scripts/build-fresh.sh"
      else
        run_cmd npm run build
      fi
      run_cmd npm run rebuild:electron
      run_cmd env -u ELECTRON_RUN_AS_NODE npx electron-vite preview --skipBuild || true
      ;;
    build)
      do_build
      ;;
    dmg|unsigned)
      run_cmd npm run dist:unsigned
      show_build_outputs
      ;;
    app|fast)
      run_cmd npm run dist:fast
      show_build_outputs
      ;;
    signed)
      run_cmd npm run dist:signed
      show_build_outputs
      ;;
    portable)
      run_cmd npm run dist:portable
      show_build_outputs
      ;;
    portable:mac)
      run_cmd npm run dist:portable:mac
      show_build_outputs
      ;;
    portable:win)
      run_cmd npm run dist:portable:win
      show_build_outputs
      ;;
    portable:all)
      run_cmd npm run dist:portable:all
      show_build_outputs
      ;;
    win)
      do_win_release
      ;;
    test|tests)
      do_tests
      ;;
    help|-h|--help)
      usage
      ;;
    *)
      err "Unknown command: $1"
      echo
      usage
      exit 1
      ;;
  esac
}

main_menu() {
  while true; do
    show_menu
    read -r -p "Choose an option [1-8]: " option
    case "$option" in
      1)
        do_setup_new_machine
        pause
        ;;
      2)
        do_build || true
        pause
        ;;
      3)
        do_run_local
        pause
        ;;
      4)
        do_mac_dmg || true
        pause
        ;;
      5)
        do_portable || true
        pause
        ;;
      6)
        do_win_release || true
        pause
        ;;
      7)
        do_tests
        pause
        ;;
      8)
        ok "Goodbye."
        exit 0
        ;;
      *)
        warn "Invalid option. Please enter 1–8."
        ;;
    esac
  done
}

main() {
  require_npm

  if [[ ! -f "$ROOT_DIR/package.json" ]]; then
    err "package.json not found. Run this script from the project root."
    exit 1
  fi

  if [[ $# -gt 0 ]]; then
    if ! run_oneshot "$1"; then
      main_menu
    fi
    return 0
  fi

  main_menu
}

main "$@"
