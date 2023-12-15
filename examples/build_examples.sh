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
  "ammo-car-three-ammo"
  "collision-groups-three-ammo"
  "collision-groups-three-rapier3d"
  "collision-groups-pool-three-ammo"
)
build_example() {
    pushd ./$1
#    npm i
#    sh ../../etc/switch_example_to_local_gg.sh .
    npm run build
#    npm run start
    popd
}
for ix in ${!examples[*]}
do
  build_example ${examples[$ix]}  # &
done
wait
