#!/bin/bash
set -e
set -o pipefail
pushd "$(dirname "$0")"
pushd ..
pushd packages/core
npm install
npm run build
npm link
popd

libs=(
  "three"
  "ammo"
  "rapier2d"
  "rapier3d"
  "pixi"
  "matter"
)
for ix in ${!libs[*]}
do
  pushd ./packages/${libs[$ix]}
  # -i.bak (with the suffix glued to -i) is the one invocation both BSD/macOS sed and GNU/Linux
  # sed (used by CI) accept identically; `sed -i ''` only works on BSD and breaks CI.
  sed -i.bak '1,/moduleNameMapper/ s/"@gg-web-engine\/core".*/"rxjs": "7.8.1",/' ./package.json
  sed -i.bak '/prepublish/d' ./package.json
  rm -f ./package.json.bak
  npm install
  npm link @gg-web-engine/core
  npm run build
  npm link
  popd
done



