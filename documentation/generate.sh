#!/bin/bash
rm -rf docs site
packages=("core" "ammo" "three" "pixi" "matter" "rapier2d" "rapier3d")
for str in ${packages[@]}; do
  mkdir -p src/$str
  cp -R ../packages/$str/src/* src/$str
done

npm run run-doc-gen
rm -rf src
find docs -type f -name index.md -exec sed -i 's/\/modules/\/gg-web-engine\/modules/g' {} \; # fix paths, generated by docs-ts-mkdocs

mkdocs build