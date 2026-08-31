# Define variables
AMMOJS_GIT_REPO=https://github.com/AndyGura/ammo.js.git
AMMOJS_GIT_COMMIT=c3d7c801e49c0f41273874e643da4794e1915bf8
BULLET_GIT_REPO=https://github.com/bulletphysics/bullet3.git
BULLET_GIT_COMMIT=2c204c49e56ed15ec5fcfa71d199ab6d6570b3f5 # 3.25 release
REPLACE_SRC_DIR=./patch_files
REPLACE_DEST_DIR=./ammo.js

clean-all:
	rm -rf ./ammo.js && rm -rf ./ammo_patches.txt && rm -rf ./bullet_patches.txt

fetch_ammo:
	git clone $(AMMOJS_GIT_REPO)

switch_ammo:
	cd ammo.js && git checkout $(AMMOJS_GIT_COMMIT)

fetch_bullet:
	cd ammo.js && git clone $(BULLET_GIT_REPO) bullet

switch_bullet:
	cd ammo.js/bullet && git checkout $(BULLET_GIT_COMMIT)

replace:
	cp -r $(REPLACE_SRC_DIR)/* $(REPLACE_DEST_DIR)
	cd ammo.js && git diff > ../ammo_patches.txt
	cd ammo.js/bullet && git diff > ../../bullet_patches.txt

build:
	cd ammo.js && npm i && npm run build:clean && docker-compose build && docker-compose up && npm run build:export

copy:
	cp -r ./ammo.js/dist/* ../src/ammo.js
	# emsdk 6.0.8's Node-detection shell code uses the "node:fs" scheme specifier; webpack 5
	# treats "node:"-prefixed requires as an unhandled URI scheme (UnhandledSchemeError) even
	# though this require is dead code in a browser bundle (gated behind a Node-only branch) and
	# resolve.fallback:{fs:false} - already set in every example's webpack config - has no effect
	# on scheme-prefixed requests. Strip the prefix back to the bare specifier every consumer's
	# tooling already handles.
	sed -i.bak 's/require("node:fs")/require("fs")/g' ../src/ammo.js/ammo.js ../src/ammo.js/ammo.wasm.js && rm -f ../src/ammo.js/*.bak

cleanup:
	rm -rf ./ammo.js

fetch_all: clean-all fetch_ammo switch_ammo fetch_bullet switch_bullet
build_all: replace build copy

all: fetch_all build_all cleanup
