#!/bin/bash
set -e
set -o pipefail
pushd "$(dirname "$0")"
pushd ..

# Portable in-place sed: BSD sed (macOS, for anyone running this by hand) requires an explicit
# backup-suffix argument to -i; GNU sed (the release_action.yml runner) doesn't accept the split
# -i .bak form — `-i.bak` + cleanup works identically on both.
sedi() {
  sed -i.bak "$1" "$2" && rm -f "$2.bak"
}

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
    sedi 's/"version": "[0-9.]*",/"version": "'$2'",/' package.json
    sedi 's/"@gg-web-engine\/core": "[0-9.]*",/"@gg-web-engine\/core": "'$2'",/' package.json
    # --workspaces=false: install as a standalone project against the just-published registry
    # version of @gg-web-engine/core (this is the sanity check that the published tarball actually
    # works), not the local packages/core via the packages/* workspace. It also keeps these
    # parallel installs from racing on the shared root package-lock.json/node_modules.
    rm -rf node_modules/ package-lock.json dist/ && npm i --workspaces=false && npm run prettier-format && npm run build
    popd
}

wait_package_publish() {
    local package_name="$1"
    local desired_version="$2"
    local timeout_seconds=300
    echo Waiting $package_name@$desired_version to be available before continuation
    start_time=$(date +%s)
    while true; do
        current_version=$(npm view "$package_name" version --force)
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
sedi 's/"version": "[0-9.]*",/"version": "'$1'",/' package.json
# --workspaces=false: see the comment in upgrade() above — keep this a standalone install/build,
# not resolved through the packages/* workspace.
rm -rf node_modules/ package-lock.json dist/ && npm i --workspaces=false && npm run prettier-format && npm run build
npm publish

echo sleeping 30s...
sleep 30
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

echo sleeping 30s...
sleep 30
for ix in ${!libs[*]}
do
  wait_package_publish "@gg-web-engine/${libs[$ix]}" $1
done

echo NPM packages published, re-linking examples...
examples=()
while IFS= read -r line || [ -n "$line" ]; do
  examples+=("$line")
done < ./examples/examples-list.txt
upgrade_example() {
    pushd ./examples/$1
    sedi 's/"@gg-web-engine\/core": "[0-9.]*",/"@gg-web-engine\/core": "'$2'",/' package.json
    for ix in ${!libs[*]}
    do
      sedi 's/"@gg-web-engine\/'${libs[$ix]}'": "[0-9.]*",/"@gg-web-engine\/'${libs[$ix]}'": "'$2'",/' package.json
    done
    rm -rf node_modules/ package-lock.json dist/ && npm i
    popd
}
for ix in ${!examples[*]}
do
  upgrade_example ${examples[$ix]} $1 &
done
wait
sedi "s/\(const sbBranchSuffix = '\)[^']*\(';\)/\1$1\2/" ./examples/index.html

echo "Reminder: "
echo "1) double-check readme code example"
echo "2) deploy examples"
echo "3) check stackblitz of all examples"
