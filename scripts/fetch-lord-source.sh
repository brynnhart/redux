#!/usr/bin/env bash
set -euo pipefail

# Fetch Synchronet's LORD JavaScript door game source into a local folder.
# Usage:
#   ./scripts/fetch-lord-source.sh [target-dir] [git-ref]
# Examples:
#   ./scripts/fetch-lord-source.sh
#   ./scripts/fetch-lord-source.sh ./lord master

TARGET_DIR="${1:-./vendor/lord}"
GIT_REF="${2:-master}"
WORK_DIR="$(mktemp -d)"
REPO_URL="https://github.com/SynchronetBBS/sbbs.git"
SUBDIR="xtrn/lord"

cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

if ! command -v git >/dev/null 2>&1; then
  echo "error: git is required but was not found in PATH" >&2
  exit 1
fi

echo "Cloning Synchronet repository with sparse checkout (ref: $GIT_REF)..."
git clone --filter=blob:none --sparse --branch "$GIT_REF" "$REPO_URL" "$WORK_DIR/sbbs"
cd "$WORK_DIR/sbbs"
git sparse-checkout set "$SUBDIR"

mkdir -p "$TARGET_DIR"
cp -R "$SUBDIR"/. "$TARGET_DIR"/

echo "LORD source copied to: $TARGET_DIR"
