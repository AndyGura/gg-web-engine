import Ammo from './ammo.js/ammo';

export const ammoId: (body: Ammo.btCollisionObject) => number = body => (body as any).a;
