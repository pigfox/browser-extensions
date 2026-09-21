#!/usr/bin/env bash
# Rebuilds each extension from its Firefox sources zip in a fresh temp directory
# (following SOURCE_BUILD.md) and checks the result matches the Firefox zip.
# Run `pnpm zip` first.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
failed=0

for ext_dir in "$repo_root"/extensions/*/; do
  name="$(basename "$ext_dir")"
  sources_zip="$(ls "$ext_dir".output/*-sources.zip)"
  firefox_zip="$(ls "$ext_dir".output/*-firefox.zip)"
  work="$(mktemp -d)"
  trap 'rm -rf "$work"' EXIT

  echo "==> $name: rebuilding from $(basename "$sources_zip") in $work"
  mkdir "$work/src" "$work/expected"
  unzip -q "$sources_zip" -d "$work/src"
  unzip -q "$firefox_zip" -d "$work/expected"

  (
    cd "$work/src"
    pnpm install --frozen-lockfile --reporter=silent
    pnpm --filter "./extensions/*" exec wxt build -b firefox > "$work/build.log" 2>&1 || {
      cat "$work/build.log"
      exit 1
    }
  )

  rebuilt="$work/src/extensions/$name/.output/firefox-mv3"
  if diff -r "$work/expected" "$rebuilt"; then
    echo "==> $name: OK ($(find "$rebuilt" -type f | wc -l) files, byte-identical)"
  else
    echo "==> $name: MISMATCH between rebuilt sources and $(basename "$firefox_zip")"
    failed=1
  fi

  rm -rf "$work"
  trap - EXIT
done

exit "$failed"
