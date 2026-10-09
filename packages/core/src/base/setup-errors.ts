/**
 * Runtime checks for common setup mistakes, each failing with a message that names the fix.
 * TypeScript already rejects most of these at compile time; these checks cover plain JS, `any` and
 * casts, where the mistake otherwise surfaces later as an unrelated-looking error (or not at all).
 */

/** Dimensionality a scene, physics world or audio scene was built for. */
export type WorldDimension = 2 | 3;

function safeGet(target: any, key: string): unknown {
  try {
    return target?.[key];
  } catch {
    // a getter that throws (e.g. before init) tells us nothing about dimensionality
    return undefined;
  }
}

/**
 * Infers whether `physicsWorld` is a 2D or 3D physics world from its `gravity` vector (a 3D
 * world's has a `z` component, a 2D world's does not). `null` when it can't tell.
 */
export function physicsWorldDimension(physicsWorld: unknown): WorldDimension | null {
  const gravity = safeGet(physicsWorld, 'gravity') as any;
  if (!gravity || typeof gravity !== 'object' || typeof gravity.x !== 'number' || typeof gravity.y !== 'number') {
    return null;
  }
  return typeof gravity.z === 'number' ? 3 : 2;
}

/**
 * Infers whether `visualScene` is a 2D or 3D visual scene from members only one of the two
 * interfaces declares (`registerRenderLayer`, factory `createLight` for 3D; factory
 * `createParallaxLayer` for 2D). `null` when it can't tell.
 */
export function visualSceneDimension(visualScene: unknown): WorldDimension | null {
  if (typeof safeGet(visualScene, 'registerRenderLayer') === 'function') {
    return 3;
  }
  const factory = safeGet(visualScene, 'factory');
  if (typeof safeGet(factory, 'createLight') === 'function') {
    return 3;
  }
  if (typeof safeGet(factory, 'createParallaxLayer') === 'function') {
    return 2;
  }
  return null;
}

/**
 * Infers whether `audioScene` is a 3D audio scene (it declares `defaultPanningModel`). A 2D audio
 * scene has no member of its own to recognize it by, so this returns `3` or `null`.
 */
export function audioSceneDimension(audioScene: unknown): WorldDimension | null {
  if (audioScene && typeof audioScene === 'object' && 'defaultPanningModel' in audioScene) {
    return 3;
  }
  return null;
}

const ADAPTER_HINTS: Record<WorldDimension, { visual: string; physics: string; audio: string }> = {
  2: {
    visual: '@gg-web-engine/pixi',
    physics: '@gg-web-engine/matter or @gg-web-engine/rapier2d',
    audio: "@gg-web-engine/audio's WebAudioScene2dComponent",
  },
  3: {
    visual: '@gg-web-engine/three',
    physics: '@gg-web-engine/ammo or @gg-web-engine/rapier3d',
    audio: "@gg-web-engine/audio's WebAudioScene3dComponent",
  },
};

/**
 * Throws when a scene of the other dimensionality is passed to a `Gg2dWorld`/`Gg3dWorld`
 * constructor, naming the world class that scene belongs in. Returns `args` unchanged, so a
 * constructor can wrap its `super(...)` argument with it. A scene whose dimensionality can't be
 * inferred (a custom or mock implementation) is let through.
 * @internal
 */
export function assertWorldDimensions<
  A extends { visualScene?: unknown; physicsWorld?: unknown; audioScene?: unknown },
>(worldClass: string, expected: WorldDimension, args: A): A {
  const other: WorldDimension = expected === 3 ? 2 : 3;
  const otherWorldClass = other === 3 ? 'Gg3dWorld' : 'Gg2dWorld';
  const check = (
    kind: 'visual' | 'physics' | 'audio',
    argName: string,
    value: unknown,
    detect: (v: unknown) => WorldDimension | null,
  ) => {
    if (!value || detect(value) !== other) {
      return;
    }
    const backend = safeGet(value, 'backendName');
    const label = typeof backend === 'string' && backend ? ` ("${backend}")` : '';
    throw new Error(
      `${worldClass} was given a ${other}D ${argName}${label}. A ${expected}D world needs a ${expected}D ` +
        `${argName} (${ADAPTER_HINTS[expected][kind]}); a ${other}D ${argName} belongs in a ${otherWorldClass}. ` +
        `Make the visual scene, physics world and audio scene all ${expected}D, or create a ${otherWorldClass} instead.`,
    );
  };
  check('visual', 'visualScene', args.visualScene, visualSceneDimension);
  check('physics', 'physicsWorld', args.physicsWorld, physicsWorldDimension);
  check('audio', 'audioScene', args.audioScene, audioSceneDimension);
  return args;
}

/**
 * The error an adapter's scene/physics world throws when something needs its native state before
 * `init()` has finished. `component` names the class, `role` which world constructor argument it
 * is, `action` what was attempted (e.g.
 * `"creating bodies (physicsWorld.factory)"`), `reason` optionally says why init is asynchronous.
 */
export function notInitializedError(
  component: string,
  role: 'visualScene' | 'physicsWorld' | 'audioScene',
  action: string,
  reason?: string,
): Error {
  return new Error(
    `${component} is not initialized yet, so it can't be used for ${action}. ` +
      `Call \`await world.init()\` before adding entities, loading a level or starting the world ` +
      `(or \`await ${role}.init()\` when using the ${role} without a world)` +
      (reason ? `; ${reason}` : '') +
      '.',
  );
}

/**
 * Reports a second, different `@gg-web-engine/core` version loaded into the same page - what happens
 * when an adapter pinned to one core version is installed next to another core version (each
 * `@gg-web-engine/*` package pins its core version exactly, so the package manager gives that
 * adapter its own copy). Two copies break `instanceof` checks between them and split every static
 * registry, which surfaces as unrelated-looking errors. Logged once per version pair; silent when
 * every loaded copy has the same version.
 * @internal
 */
export function registerCoreVersion(version: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  const w = window as any;
  const loaded: string[] = Array.isArray(w.gg_core_versions) ? w.gg_core_versions : [];
  w.gg_core_versions = loaded;
  const others = loaded.filter(v => v !== version);
  if (!loaded.includes(version)) {
    loaded.push(version);
  }
  if (others.length) {
    console.error(
      `Several versions of @gg-web-engine/core are loaded in this page: ${[...others, version].join(', ')}. ` +
        `Every @gg-web-engine/* package pins one exact core version, so a package built for a different ` +
        `core version brought its own copy, and entities, components and worlds from the two copies don't ` +
        `work together. Pick one version and install it for core and every adapter you use, e.g. ` +
        `\`npm install @gg-web-engine/core@${version} @gg-web-engine/three@${version} @gg-web-engine/ammo@${version}\`, ` +
        `then check that \`npm ls @gg-web-engine/core\` lists a single version.`,
    );
  }
}
