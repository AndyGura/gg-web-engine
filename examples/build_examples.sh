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
  "collision-groups-pool-three-rapier3d"
)
build_example() {
    pushd ./$1
    rm -rf node_modules && rm -f package-lock.json && rm -rf dist
    npm i
#    sh ../../etc/switch_example_to_local_gg.sh .
    npm run build
#    npm run start
    popd
}

pids=()
for ix in ${!examples[*]}
do
  build_example ${examples[$ix]} &
  pids+=($!)
done
for pid in "${pids[@]}"; do
  if ! wait $pid; then
    echo "Error: A background process failed."
    exit 1
  fi
done
