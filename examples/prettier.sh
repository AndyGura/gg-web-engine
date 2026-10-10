#!/bin/bash
# Formats every example listed in examples.json with the repo's own prettier config (../.prettierrc),
# the same config the packages use. Pass --check to only report files that would change (exit 1
# if any), as CI would.
#
# Usage: bash examples/prettier.sh [--check]
set -e
set -o pipefail
cd "$(dirname "$0")"

mode="--write"
if [ "$1" == "--check" ]; then
  mode="--check"
fi

examples=($(node -p "require('./examples.json').examples.map(e => e.dir).join(' ')"))
patterns=()
for dir in "${examples[@]}"; do
  patterns+=("$dir/**/*.{ts,js,mjs,json,html,css}")
done

# prettier is a devDependency of the packages workspace, hoisted into the repo root's node_modules
npx --prefix .. prettier --config ../.prettierrc \
  --ignore-path ../.gitignore \
  "${patterns[@]}" \
  "!*/*/node_modules/**" "!*/*/dist/**" "!*/*/package-lock.json" \
  $mode
