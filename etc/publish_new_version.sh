#!/bin/bash
set -e
set -o pipefail
pushd "$(dirname "$0")"
pushd ..

libs=(
  "three"
  "ammo"
  "rapier2d"
  "rapier3d"
  "pixi"
  "matter"
)

upgrade() {
    pushd ./packages/$1
    sed -i 's/"version": "[0-9.]*",/"version": "'$2'",/' package.json
    sed -i 's/"@gg-web-engine\/core": "[0-9.]*",/"@gg-web-engine\/core": "'$2'",/' package.json
    rm -rf node_modules/ package-lock.json dist/ && npm i && npm run prettier-format && npm run build
    popd
}

pushd ./packages/core
sed -i 's/"version": "[0-9.]*",/"version": "'$1'",/' package.json
rm -rf node_modules/ package-lock.json dist/ && npm i && npm run prettier-format && npm run build
npm publish
echo Waiting 30s before continuation
sleep 30s
popd

pids=()
for ix in ${!libs[*]}
do
  upgrade ${libs[$ix]} $1 &
  pids+=($!)
done
for pid in "${pids[@]}"; do
  if ! wait $pid; then
    echo "Error: A background process failed."
    exit 1
  fi
done

for ix in ${!libs[*]}
do
  pushd ./packages/${libs[$ix]}
  npm publish
  popd
done

echo Waiting 30s before continuation
sleep 30s

echo NPM packages published, re-linking examples...
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
    pushd ./examples/$1
    sed -i 's/"@gg-web-engine\/core": "[0-9.]*",/"@gg-web-engine\/core": "'$2'",/' package.json
    for ix in ${!libs[*]}
    do
      sed -i 's/"@gg-web-engine\/'${libs[$ix]}'": "[0-9.]*",/"@gg-web-engine\/'${libs[$ix]}'": "'$2'",/' package.json
    done
    rm -rf node_modules/ package-lock.json dist/ && npm i
    popd
}
for ix in ${!examples[*]}
do
  build_example ${examples[$ix]} $1 &
done
wait

echo "Reminder: "
echo "1) double-check readme code example"
echo "2) deploy examples"
echo "3) check stackblitz of all examples"
