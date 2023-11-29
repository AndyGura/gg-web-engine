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
  sed -i 's/"@gg-web-engine\/core".*/"rxjs": "7.8.0",/' ./package.json
  sed -i '/prepublish/d' ./package.json
  npm install
  npm link @gg-web-engine/core
  npm run build
  npm link
  popd
done



