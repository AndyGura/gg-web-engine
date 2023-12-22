This is a place where I build proprietary ammo.js for gg-web-engine.

Reasons to build own ammo.js instead of using [up-to-date one](https://github.com/i12345/ammo.js):
1) The crucial feature, which bullet does not have: use collision groups for raycast vehicle. I already made a 
[PR](https://github.com/bulletphysics/bullet3/pull/4559) to bullet.
1) Manually added functions "getPointer" and "compare" to type declarations. 
[PR](https://github.com/anotherpit/webidl2ts/pull/2) to webidl2ts is also on it's way
1) Expose `m_erp2` property of `btContactSolverInfo`, needed for fighting with object clipping problem,
which appeared in bullet 2.84. Also made a [PR](https://github.com/i12345/ammo.js/pull/2)


All changed file diffs in ammo.js and bullet can be found [here](./ammo_patches.txt) and [here](./bullet_patches.txt) appropriately


### How to build
1) Docker has to be installed and started
1) enter this directory and run `make all`
