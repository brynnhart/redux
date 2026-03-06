#!/usr/bin/env bash
set -euo pipefail

# Fetches Synchronet's LORD JavaScript door game source into a local vendor folder.
# Usage:
#   ./scripts/fetch-lord-source.sh [target-dir]
# Example:
#   ./scripts/fetch-lord-source.sh ./vendor/lord

TARGET_DIR="${1:-./vendor/lord}"
WORK_DIR="$(mktemp -d)"
REPO_URL="https://github.com/SynchronetBBS/sbbs.git"
SUBDIR="xtrn/lord"

cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

echo "Cloning Synchronet repository with sparse checkout..."
git clone --filter=blob:none --sparse "$REPO_URL" "$WORK_DIR/sbbs"
cd "$WORK_DIR/sbbs"
git sparse-checkout set "$SUBDIR"

mkdir -p "$TARGET_DIR"
cp -R "$SUBDIR"/. "$TARGET_DIR"/

echo "LORD source copied to: $TARGET_DIR"
