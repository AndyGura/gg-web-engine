#!/bin/bash
set -e

examples=(
  "primitives-three-ammo"
  "primitives-three-rapier3d"
  "primitives-pixi-matter"
  "primitives-pixi-rapier2d"
  "glb-loader-three-ammo"
#  "fly-city"
)
for ix in ${!examples[*]}
do
    pushd ./${examples[$ix]}
    npm run build
    popd
done
