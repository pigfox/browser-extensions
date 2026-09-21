#!/usr/bin/env bash
# Runs Mozilla's addons-linter (via web-ext lint) on each Firefox zip.
# Warnings count as failures. Run `pnpm zip` first.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
web_ext="$repo_root/node_modules/.bin/web-ext"

for firefox_zip in "$repo_root"/extensions/*/.output/*-firefox.zip; do
  work="$(mktemp -d)"
  trap 'rm -rf "$work"' EXIT
  unzip -q "$firefox_zip" -d "$work"
  echo "==> $(basename "$firefox_zip")"
  "$web_ext" lint --source-dir "$work" --warnings-as-errors --no-config-discovery
  rm -rf "$work"
  trap - EXIT
done
