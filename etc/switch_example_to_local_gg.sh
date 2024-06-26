#!/bin/bash
set -e
set -o pipefail

function fix_ammo_paths {
  sed -i 's/\/mini-signals/\/@gg-web-engine\/ammo\/node_modules\/mini-signals/' tsconfig.json
}

function fix_three_paths {
  sed -i 's/"paths": {/"paths": {\n"three": [".\/node_modules\/@gg-web-engine\/three\/node_modules\/three"],/' tsconfig.json
}

function fix_pixi_paths {
  sed -i 's/"paths": {/"paths": {\n"pixi.js": [".\/node_modules\/@gg-web-engine\/pixi\/node_modules\/pixi.js"],/' tsconfig.json
}

pushd $1
libs=($(grep '@gg-web-engine/' package.json | awk -F'/|:' '{print $2}' | tr -d '", '))
link_libs=''
has_three=false
has_ammo=false
has_pixi=false
for ix in ${!libs[*]}
do
  link_libs=$link_libs' @gg-web-engine/'${libs[$ix]}
  if [ ${libs[$ix]} == three ]
  then
    has_three=true
  fi
  if [ ${libs[$ix]} == ammo ]
  then
    has_ammo=true
  fi
  if [ ${libs[$ix]} == pixi ]
  then
    has_pixi=true
  fi
done

# perform patch
sed -i '/@gg-web-engine\//d' ./package.json
npm install
npm link $link_libs
if [ $has_ammo == true ]
then
  fix_ammo_paths
fi
if [ $has_three == true ]
then
  fix_three_paths
fi
if [ $has_pixi == true ]
then
  fix_pixi_paths
fi
popd



