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

wait_package_publish() {
    local package_name="$1"
    local desired_version="$2"
    local timeout_seconds=300
    echo Waiting $package_name@$desired_version to be available before continuation
    start_time=$(date +%s)
    sleep 30
    while true; do
        current_version=$(npm view "$package_name" version)
        end_time=$(date +%s)
        elapsed_time=$((end_time - start_time))
        if [ "$current_version" = "$desired_version" ]; then
            return
        else
          echo "$current_version != $desired_version"
        fi
        if [ $elapsed_time -ge $timeout_seconds ]; then
            echo "NPM package was not fully published after 5 minutes"
            exit 1
        fi
        sleep 30
    done
}

pushd ./packages/core
sed -i 's/"version": "[0-9.]*",/"version": "'$1'",/' package.json
rm -rf node_modules/ package-lock.json dist/ && npm i && npm run prettier-format && npm run build
npm publish
wait_package_publish "@gg-web-engine/core" $1
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

for ix in ${!libs[*]}
do
  wait_package_publish "@gg-web-engine/${libs[$ix]}" $1
done

echo NPM packages published, re-linking examples...
examples=()
while read line; do
  examples+=("$line")
done < ./examples/examples-list.txt
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
sed -i "s/\(const sbBranchSuffix = '\)[^']*\(';\)/\1$1\2/" ./examples/index.html

echo "Reminder: "
echo "1) double-check readme code example"
echo "2) deploy examples"
echo "3) check stackblitz of all examples"
