#!/bin/bash
set -e

examples=(
  "primitives-three-ammo"
  "primitives-three-rapier3d"
)
for ix in ${!examples[*]}
do
    pushd ./${examples[$ix]}
    npm run build
    popd
done
