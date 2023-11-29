#!/bin/bash
set -e
set -o pipefail
pushd "$(dirname "$0")"
pushd ..

libs=(
  "core"
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
  npm run prettier-format
  npm run build
  popd
done
