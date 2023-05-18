#!/bin/bash
pushd "$(dirname "$0")"
pushd ..
pushd packages/core
npm install
npm run build
npm link
popd

function switch_gg_module {
  sed -i 's/"@gg-web-engine\/core".*/"rxjs": "~7.8.0",/' ./package.json
  sed -i '/prepublish/d' ./package.json
  npm install
  npm link @gg-web-engine/core
  npm run build
  npm link
}
pushd packages/three
switch_gg_module
popd
pushd packages/ammo
switch_gg_module
popd
pushd packages/pixi
switch_gg_module
popd
pushd packages/matter
switch_gg_module
popd

function fix_ammo_paths {
  sed -i 's/\/mini-signals/\/@gg-web-engine\/ammo\/node_modules\/mini-signals/' tsconfig.json
  sed -i 's/"paths": {/"paths": {\n"ammo-js-typed": [".\/node_modules\/@gg-web-engine\/ammo\/node_modules\/ammo-js-typed"],/' tsconfig.json
}

function fix_three_paths {
  sed -i 's/"paths": {/"paths": {\n"three": [".\/node_modules\/@gg-web-engine\/three\/node_modules\/three"],/' tsconfig.json
}

pushd examples/angular-pixi-matterjs
sed -i '/@gg-web-engine\//d' ./package.json
npm install
npm link @gg-web-engine/core @gg-web-engine/pixi @gg-web-engine/matter
popd

pushd examples/angular-three-ammo
sed -i '/@gg-web-engine\//d' ./package.json
npm install
npm link @gg-web-engine/core @gg-web-engine/three @gg-web-engine/ammo
fix_ammo_paths
fix_three_paths
popd

pushd examples/model-loader
sed -i '/@gg-web-engine\//d' ./package.json
sed -i 's/"dependencies": {/"dependencies": {\n"three": "^0.151.3",/' package.json
npm install
npm link @gg-web-engine/core @gg-web-engine/three @gg-web-engine/ammo
fix_ammo_paths
fix_three_paths
popd

pushd examples/fly-city
sed -i '/@gg-web-engine\//d' ./package.json
sed -i 's/"dependencies": {/"dependencies": {\n"three": "^0.151.3",/' package.json
npm install
npm link @gg-web-engine/core @gg-web-engine/three @gg-web-engine/ammo
fix_ammo_paths
fix_three_paths
popd



