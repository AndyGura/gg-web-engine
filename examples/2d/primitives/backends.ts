import { IPhysicsWorld2dComponent } from '@gg-web-engine/core';

/**
 * The physics backends this example runs on. Which one is used is decided once, at startup, from
 * the page URL (`?physics=rapier2d`), falling back to `DEFAULT_PHYSICS`: the examples gallery sets
 * the parameter from its selector; opened on its own (or in StackBlitz) the default applies. Each
 * adapter is loaded through a dynamic import, so the page downloads only the engine it runs on.
 *
 * The visual side is not selectable - this is a pixi.js example; the `visual=pixi` parameter the
 * gallery also sends is informational.
 */
export const PHYSICS_BACKENDS = ['matter', 'rapier2d'] as const;
export type PhysicsBackend = (typeof PHYSICS_BACKENDS)[number];
export const DEFAULT_PHYSICS: PhysicsBackend = 'matter';

export function selectedPhysicsBackend(): PhysicsBackend {
  const requested = new URLSearchParams(location.search).get('physics') ?? '';
  return (PHYSICS_BACKENDS as readonly string[]).includes(requested) ? (requested as PhysicsBackend) : DEFAULT_PHYSICS;
}

export async function createPhysicsWorld(
  backend: PhysicsBackend = selectedPhysicsBackend(),
): Promise<IPhysicsWorld2dComponent> {
  switch (backend) {
    case 'matter':
      return new (await import(/* webpackChunkName: "matter" */ '@gg-web-engine/matter')).MatterWorldComponent();
    case 'rapier2d':
      return new (await import(/* webpackChunkName: "rapier2d" */ '@gg-web-engine/rapier2d')).Rapier2dWorldComponent();
  }
}
