#!/bin/bash
set -e

examples=(
  "primitives-three-ammo"
  "primitives-three-rapier3d"
  "primitives-pixi-matter"
  "primitives-pixi-rapier2d"
  "glb-loader-three-ammo"
  "glb-loader-three-rapier3d"
  "fly-city-three-ammo"
)
for ix in ${!examples[*]}
do
    pushd ./${examples[$ix]}
    npm run build
    popd
done
