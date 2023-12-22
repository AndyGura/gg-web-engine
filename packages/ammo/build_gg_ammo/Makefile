# Define variables
AMMOJS_GIT_REPO=https://github.com/i12345/ammo.js.git
AMMOJS_GIT_COMMIT=bda89d9351f360e46c394ebe63d51f7cf5e2e1c2
BULLET_GIT_REPO=https://github.com/bulletphysics/bullet3.git
BULLET_GIT_COMMIT=6bb8d1123d8a55d407b19fd3357c724d0f5c9d3c
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

# Replace files and save diffs
replace:
	cp -r $(REPLACE_SRC_DIR)/* $(REPLACE_DEST_DIR)
	cd ammo.js && git diff > ../ammo_patches.txt
	cd ammo.js/bullet && git diff > ../../bullet_patches.txt

# Build using Docker Compose
build:
	cd ammo.js && npm i && npm run build

# Copy the built files
copy:
	cp -r ./ammo.js/dist/* ../src/ammo.js

cleanup:
	rm -rf ./ammo.js

# Define a rule to execute all steps
all: clean-all fetch_ammo switch_ammo fetch_bullet switch_bullet replace build copy cleanup
change_bullet: switch_bullet replace build copy
