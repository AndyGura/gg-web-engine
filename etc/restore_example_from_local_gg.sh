#!/bin/bash
# Undoes switch_example_to_local_gg.sh: restores package.json/tsconfig.json/package-lock.json to
# their committed state and reinstalls from the registry, so the example goes back to the
# published @gg-web-engine/* versions it's pinned to.
#
# Usage: bash etc/restore_example_from_local_gg.sh examples/<example-dir>
set -e
set -o pipefail

pushd "$1"
git checkout -- package.json tsconfig.json package-lock.json 2>/dev/null || true
rm -rf node_modules
npm install
popd
