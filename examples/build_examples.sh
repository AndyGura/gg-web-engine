#!/bin/bash
set -e

examples=()
while read line; do
  examples+=("$line")
done < ./examples-list.txt
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
