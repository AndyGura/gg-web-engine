#!/bin/bash
# Points one example at local (unpublished) @gg-web-engine/* package builds instead of the
# versions pinned in its package.json, via `npm link` against the packages/*/dist that `npm
# install`/`npm run build`/`npm run build:watch` at the repo root produce. See
# gg-engine-core-development / gg-engine-examples for the full workflow.
#
# Usage: bash etc/switch_example_to_local_gg.sh examples/<example-dir>
#
# Idempotent: always resets package.json and friends to their committed state first, so re-runs
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

# A linked package resolves its peer dependencies (pixi.js, three, rxjs, the rapier builds, ...) from
# its own real location - with the root npm workspace, the repo root's node_modules - while the
# example resolves them from its own node_modules. Two copies of one library break anything compared
# by identity (pixi's Texture.WHITE, three's classes, rxjs types), so replace the example's copy of
# every linked package's peer dependency with a symlink to the copy that package actually uses: one
# copy for webpack and tsc alike.
function dedupe_peer_deps {
  node - "$@" <<'NODE'
const fs = require('fs');
const path = require('path');
for (const pkgDir of process.argv.slice(2)) {
  const peers = Object.keys(require(path.join(pkgDir, 'package.json')).peerDependencies || {});
  for (const dep of peers.filter(d => !d.startsWith('@gg-web-engine/'))) {
    const own = path.join('node_modules', dep);
    if (!fs.existsSync(own)) continue;
    let target = null;
    for (let dir = pkgDir; !target; dir = path.dirname(dir)) {
      const candidate = path.join(dir, 'node_modules', dep);
      if (fs.existsSync(candidate)) target = fs.realpathSync(candidate);
      if (path.dirname(dir) === dir) break;
    }
    if (!target || fs.realpathSync(own) === target) continue;
    fs.rmSync(own, { recursive: true, force: true });
    fs.symlinkSync(target, own, 'dir');
    console.log(`deduped ${dep} -> ${target}`);
  }
}
NODE
}

# Examples that reference a shared examples/assets asset ship webpack.dev.config.js with a
# devServer.static block commented out by default (see gg-engine-examples's "Adding a shared asset
# under examples/assets"), since a standalone clone of just that example directory has no sibling
# ../assets folder to serve. Inside the full repo checkout that folder does exist, so local dev
# should serve it - uncomment the block if present. Angular examples have no webpack config;
# they ship a proxy.conf.mjs serving ../assets at /assets, which is switched on by pointing the
# dev-server's "proxyConfig" option at it in angular.json.
function fix_dev_server_assets {
  if [ -f angular.json ] && [ -f proxy.conf.mjs ]; then
    grep -q '"proxyConfig"' angular.json ||
      sedi 's|^\( *\)"builder": "@angular/build:dev-server",$|&\
\1"options": { "proxyConfig": "proxy.conf.mjs" },|' angular.json
  fi
  [ -f webpack.dev.config.js ] || return 0
  grep -q '^  // devServer: {$' webpack.dev.config.js || return 0
  sedi 's|^  // devServer: {$|  devServer: {|' webpack.dev.config.js
  sedi "s|^  //   static: \[{ directory: path.resolve(__dirname, '../../assets'), publicPath: '/assets' }\],\$|    static: [{ directory: path.resolve(__dirname, '../../assets'), publicPath: '/assets' }],|" webpack.dev.config.js
  sedi 's|^  // },$|  },|' webpack.dev.config.js
}

pushd "$1"

# always start from the committed state so re-runs are idempotent instead of compounding patches -
# only the files this example has (one missing pathspec makes `git checkout` restore nothing at all)
git checkout -- $(git ls-files package.json tsconfig.json webpack.dev.config.js angular.json)

libs=($(grep '@gg-web-engine/' package.json | awk -F'/|:' '{print $2}' | tr -d '", '))
link_paths=''
for ix in ${!libs[*]}
do
  link_paths=$link_paths' '"$repo_root"'/packages/'${libs[$ix]}
done

# perform patch
sedi '/@gg-web-engine\//d' ./package.json
npm install
# link by local path rather than the global `npm link` store: no dependency on some other command
# having registered a global link first, and no risk of colliding with a same-named package linked
# globally by some other checkout of this repo.
npm link $link_paths
dedupe_peer_deps $link_paths
fix_dev_server_assets
popd
