import { IPhysicsWorld3dComponent } from '@gg-web-engine/core';

/**
 * The physics backends this example runs on. Which one is used is decided once, at startup, from
 * the page URL (`?physics=rapier3d`), falling back to `DEFAULT_PHYSICS`: the examples gallery sets
 * the parameter from its selector; opened on its own (or in StackBlitz) the default applies. Each
 * adapter is loaded through a dynamic import, so the page downloads only the engine it runs on.
 *
 * The visual side is not selectable - this is a three.js example; the `visual=three` parameter the
 * gallery also sends is informational.
 */
export const PHYSICS_BACKENDS = ['ammo', 'rapier3d'] as const;
export type PhysicsBackend = (typeof PHYSICS_BACKENDS)[number];
export const DEFAULT_PHYSICS: PhysicsBackend = 'ammo';

export function selectedPhysicsBackend(): PhysicsBackend {
  const requested = new URLSearchParams(location.search).get('physics') ?? '';
  return (PHYSICS_BACKENDS as readonly string[]).includes(requested) ? (requested as PhysicsBackend) : DEFAULT_PHYSICS;
}

export async function createPhysicsWorld(
  backend: PhysicsBackend = selectedPhysicsBackend(),
): Promise<IPhysicsWorld3dComponent> {
  switch (backend) {
    case 'ammo':
      return new (await import(/* webpackChunkName: "ammo" */ '@gg-web-engine/ammo')).AmmoWorldComponent();
    case 'rapier3d':
      return new (await import(/* webpackChunkName: "rapier3d" */ '@gg-web-engine/rapier3d')).Rapier3dWorldComponent();
  }
}
