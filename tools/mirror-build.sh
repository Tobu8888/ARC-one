#!/usr/bin/env bash
#
# Mirrors the deployed Arc Studio build into the GitHub Pages copy.
#
#   tools/mirror-build.sh [targetDir]
#
# Arc Studio republishes to its own host on every deploy; the Pages copy is a
# snapshot and does not follow. Run this after a Studio deploy so the two agree,
# then commit the target directory.
#
# Asset paths are rewritten from absolute (/assets/...) to relative (./assets/...)
# so the page also works when served from a subdirectory.

set -euo pipefail

SOURCE="${ARCONE_BUILD_URL:-https://phulimphad-app-574d7c35-f816-4f63-8605-0c80b4e2ff0e.static.hf.space}"
TARGET="${1:-$HOME/Projects/arcone/pages-site}"

command -v curl >/dev/null || { echo "curl is required"; exit 1; }

echo "source : $SOURCE"
echo "target : $TARGET"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

curl -fsSL "$SOURCE/" -o "$tmp/index.html"

# Entry files referenced by index.html, plus any chunk the entry bundle imports.
mapfile -t entries < <(grep -oE '(src|href)="/assets/[^"]+"' "$tmp/index.html" | grep -oE '/assets/[^"]+')
if [ "${#entries[@]}" -eq 0 ]; then
  echo "no /assets references found in index.html, nothing to mirror"
  exit 1
fi

mkdir -p "$tmp/assets"
for path in "${entries[@]}"; do
  name="${path#/assets/}"
  curl -fsSL "$SOURCE$path" -o "$tmp/assets/$name"
  echo "  fetched $name"
done

# Lazy-loaded chunks appear as relative imports inside the entry bundle.
for f in "$tmp"/assets/*.js; do
  grep -oE '"\./[A-Za-z0-9_.-]+\.js"' "$f" 2>/dev/null | tr -d '".' | sed 's|^/||' || true
done | sort -u | while read -r chunk; do
  [ -z "$chunk" ] && continue
  [ -f "$tmp/assets/$chunk" ] && continue
  if curl -fsSL "$SOURCE/assets/$chunk" -o "$tmp/assets/$chunk"; then
    echo "  fetched chunk $chunk"
  fi
done

sed -i 's|="/assets/|="./assets/|g' "$tmp/index.html"

mkdir -p "$TARGET/assets"
rm -f "$TARGET"/assets/*
cp "$tmp/index.html" "$TARGET/index.html"
cp "$tmp"/assets/* "$TARGET/assets/"

echo
echo "mirrored $(ls "$TARGET/assets" | wc -l) asset file(s)"
echo "entry: $(grep -oE 'assets/[A-Za-z0-9_.-]+\.js' "$TARGET/index.html" | head -1)"
echo
echo "next: commit and push \"$TARGET\""
