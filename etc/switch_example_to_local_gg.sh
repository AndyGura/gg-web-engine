#!/bin/bash
# Points one example at local (unpublished) @gg-web-engine/* package builds instead of the
# versions pinned in its package.json, via `npm link` against the packages/*/dist that `npm
# install`/`npm run build`/`npm run build:watch` at the repo root produce. See
# gg-engine-core-development / gg-engine-examples for the full workflow.
#
# Usage: bash etc/switch_example_to_local_gg.sh examples/<example-dir>
#
# Idempotent: always resets package.json/tsconfig.json to their committed state first, so re-runs
# (e.g. after a fresh `npm install`) never compound edits. Undo with
# restore_example_from_local_gg.sh.
set -e
set -o pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"

# Portable in-place sed: BSD sed (macOS) requires an explicit (possibly empty) backup-suffix
# argument to -i, GNU sed (Linux/CI) doesn't accept the split -i .bak form — `-i.bak` + cleanup
# works identically on both.
function sedi {
  sed -i.bak "$1" "$2" && rm -f "$2.bak"
}

function fix_ammo_paths {
  grep -q '@gg-web-engine/ammo/node_modules/mini-signals' tsconfig.json ||
    sedi 's/\/mini-signals/\/@gg-web-engine\/ammo\/node_modules\/mini-signals/' tsconfig.json
}

function fix_three_paths {
  grep -q '"three":' tsconfig.json ||
    sedi 's/"paths": {/"paths": {\n"three": [".\/node_modules\/@gg-web-engine\/three\/node_modules\/three"],/' tsconfig.json
}

function fix_pixi_paths {
  grep -q '"pixi.js":' tsconfig.json ||
    sedi 's/"paths": {/"paths": {\n"pixi.js": [".\/node_modules\/@gg-web-engine\/pixi\/node_modules\/pixi.js"],/' tsconfig.json
}

# Examples that reference a shared examples/assets asset ship webpack.dev.config.js with a
# devServer.static block commented out by default (see gg-engine-examples's "Adding a shared asset
# under examples/assets"), since a standalone clone of just that example directory has no sibling
# ../assets folder to serve. Inside the full repo checkout that folder does exist, so local dev
# should serve it - uncomment the block if present.
function fix_dev_server_assets {
  [ -f webpack.dev.config.js ] || return 0
  grep -q '^  // devServer: {$' webpack.dev.config.js || return 0
  sedi 's|^  // devServer: {$|  devServer: {|' webpack.dev.config.js
  sedi "s|^  //   static: \[{ directory: path.resolve(__dirname, '../assets'), publicPath: '/assets' }\],\$|    static: [{ directory: path.resolve(__dirname, '../assets'), publicPath: '/assets' }],|" webpack.dev.config.js
  sedi 's|^  // },$|  },|' webpack.dev.config.js
}

pushd "$1"

# always start from the committed state so re-runs are idempotent instead of compounding patches
git checkout -- package.json tsconfig.json webpack.dev.config.js 2>/dev/null || true

libs=($(grep '@gg-web-engine/' package.json | awk -F'/|:' '{print $2}' | tr -d '", '))
link_paths=''
has_three=false
has_ammo=false
has_pixi=false
for ix in ${!libs[*]}
do
  link_paths=$link_paths' '"$repo_root"'/packages/'${libs[$ix]}
  if [ ${libs[$ix]} == three ]
  then
    has_three=true
  fi
  if [ ${libs[$ix]} == ammo ]
  then
    has_ammo=true
  fi
  if [ ${libs[$ix]} == pixi ]
  then
    has_pixi=true
  fi
done

# perform patch
sedi '/@gg-web-engine\//d' ./package.json
npm install
# link by local path rather than the global `npm link` store: no dependency on some other command
# having registered a global link first, and no risk of colliding with a same-named package linked
# globally by some other checkout of this repo.
npm link $link_paths
if [ $has_ammo == true ]
then
  fix_ammo_paths
fi
if [ $has_three == true ]
then
  fix_three_paths
fi
if [ $has_pixi == true ]
then
  fix_pixi_paths
fi
fix_dev_server_assets
popd
