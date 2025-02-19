#!/bin/bash
set -e
export AWS_DEFAULT_PROFILE=andygura
# examples page
aws s3 cp index.html s3://gg-web-engine-demos/index.html
# example assets
aws s3 sync ./assets s3://gg-web-engine-demos/assets --include "*" --exclude "*.blend" --cache-control max-age

examples=()
while IFS= read -r line || [ -n "$line" ]; do
  examples+=("$line")
done < ./examples-list.txt
for ix in ${!examples[*]}
do
    pushd ./${examples[$ix]}/dist
    aws s3 sync . s3://gg-web-engine-demos/${examples[$ix]} --include "*" --cache-control max-age
    popd
done

aws cloudfront create-invalidation --distribution-id EZ2XUTR3GCFD1 --paths '/*'
