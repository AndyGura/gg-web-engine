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

cleanup:
	rm -rf ./ammo.js

fetch_all: clean-all fetch_ammo switch_ammo fetch_bullet switch_bullet
build_all: replace build copy

all: fetch_all build_all cleanup
