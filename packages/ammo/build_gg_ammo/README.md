This is a place where I build proprietary ammo.js for gg-web-engine.
 
For that I use projects [bullet](https://github.com/bulletphysics/bullet3) 
and [ammo.js-typed by i12345](https://github.com/i12345/ammo.js).

The main reason of building own ammo.js is crucial feature, which bullet does 
not have: use collision groups for raycast vehicle (I already made a 
[PR](https://github.com/bulletphysics/bullet3/pull/4559) to bullet). 
Also, comparing to older repo [ammojs-typed](https://github.com/giniedp/ammojs-typed),
for some reason newer version behaves more unstable, when scene has many rigid bodies: 
they easily intersect each other, and that was not the case for older version. 
(I submitted [issue](https://github.com/i12345/ammo.js/issues/1) regarding that).
The solution for that is not ready, but it will be here.

Nevertheless, for now gg-web-engine contains self-cooked ammo.js, all changed file diffs
in ammo.js and bullet can be found [here](./ammo_patches.txt) and [here](./bullet_patches.txt) appropriately


### How to build
1) Docker has to be installed and started
1) enter this directory and run `make all`
