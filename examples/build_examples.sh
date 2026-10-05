#!/bin/bash
# Builds every example listed in examples.json into its own dist/ (see deploy.sh for publishing).
set -e
cd "$(dirname "$0")"

examples=($(node -p "require('./examples.json').examples.map(e => e.dir).join(' ')"))
build_example() {
    pushd ./$1
    rm -rf node_modules && rm -f package-lock.json && rm -rf dist
    npm i
#    sh ../../../etc/switch_example_to_local_gg.sh .
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
