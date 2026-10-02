#!/bin/bash
# Undoes switch_example_to_local_gg.sh: restores package.json/tsconfig.json/package-lock.json/
# webpack.dev.config.js/angular.json to their committed state and reinstalls from the registry, so
# the example goes back to the published @gg-web-engine/* versions it's pinned to (and, for an example with a
# shared examples/assets dependency, its devServer.static block back to commented-out).
#
# Usage: bash etc/restore_example_from_local_gg.sh examples/<example-dir>
set -e
set -o pipefail

pushd "$1"
# only the files this example tracks (one missing pathspec makes `git checkout` restore nothing at all)
git checkout -- $(git ls-files package.json tsconfig.json package-lock.json webpack.dev.config.js angular.json)
rm -rf node_modules
npm install
popd
