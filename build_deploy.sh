#!/usr/bin/env bash
# Compatibility wrapper — use build_and_deploy.sh going forward.
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/build_and_deploy.sh" "$@"
