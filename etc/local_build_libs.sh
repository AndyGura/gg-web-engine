#!/bin/bash
set -e
set -o pipefail
pushd "$(dirname "$0")"
pushd ..
pushd packages/core
npm run prettier-format
npm run build
popd
pushd packages/three
npm run prettier-format
npm run build
popd
pushd packages/ammo
npm run prettier-format
npm run build
popd
pushd packages/pixi
npm run prettier-format
npm run build
popd
pushd packages/matter
npm run prettier-format
npm run build
popd


