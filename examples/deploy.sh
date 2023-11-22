#!/bin/bash
set -e
export AWS_DEFAULT_PROFILE=andygura
aws s3 cp index.html s3://gg-web-engine-demos/index.html
aws s3 sync ./assets s3://gg-web-engine-demos/assets --include "*" --exclude "*.blend" --cache-control max-age
aws cloudfront create-invalidation --distribution-id EZ2XUTR3GCFD1 --paths '/*'
