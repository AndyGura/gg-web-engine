import Ammo from 'ammojs-typed';

export const ammoId: (body: Ammo.btCollisionObject) => number = body => (body as any).a;
