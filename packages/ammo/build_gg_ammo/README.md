This is a place where I build proprietary ammo.js for gg-web-engine.
 
For that I use projects [bullet](https://github.com/bulletphysics/bullet3) 
and [ammo.js by i12345](https://github.com/i12345/ammo.js).

The main reason of building own ammo.js is crucial feature, which bullet does 
not have: use collision groups for raycast vehicle (I already made a 
[PR](https://github.com/bulletphysics/bullet3/pull/4559) to bullet).
Another change is manually added functions "getPointer" and "compare" to type declarations. 
[PR](https://github.com/anotherpit/webidl2ts/pull/2) is also on it's way

All changed file diffs in ammo.js and bullet can be found [here](./ammo_patches.txt) and [here](./bullet_patches.txt) appropriately


### How to build
1) Docker has to be installed and started
1) enter this directory and run `make all`
