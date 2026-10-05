type EnvironmentScene<E> = {
  readonly environment: Readonly<E>;
  setEnvironment(environment: Partial<E>): void;
};

type EnvironmentOverride = { owner: object; environment: Record<string, unknown> };

type SceneOverrides = {
  /** Value each overridden field had before its first override, restored once the last one goes. */
  base: Record<string, unknown>;
  /** Active overrides, oldest first; for each field the newest override that sets it wins. */
  overrides: EnvironmentOverride[];
};

const sceneOverrides = new WeakMap<object, SceneOverrides>();

/**
 * Applies `environment` to `scene` on behalf of `owner`, until `removeEnvironmentOverride` is
 * called for the same owner. Several owners can override the same scene at once and be removed in
 * any order: each field shows the newest remaining override that sets it, or the value it had
 * before any override once none is left.
 */
export function applyEnvironmentOverride<E extends object>(
  scene: EnvironmentScene<E>,
  owner: object,
  environment: Partial<E>,
): void {
  let state = sceneOverrides.get(scene);
  if (!state) {
    state = { base: {}, overrides: [] };
    sceneOverrides.set(scene, state);
  }
  for (const key of Object.keys(environment)) {
    if (!(key in state.base)) {
      state.base[key] = (scene.environment as Record<string, unknown>)[key];
    }
  }
  state.overrides.push({ owner, environment: environment as Record<string, unknown> });
  scene.setEnvironment(environment);
}

/** Removes the override `owner` applied to `scene`; a no-op if it has none. */
export function removeEnvironmentOverride<E extends object>(scene: EnvironmentScene<E>, owner: object): void {
  const state = sceneOverrides.get(scene);
  const index = state ? state.overrides.findIndex(o => o.owner === owner) : -1;
  if (!state || index < 0) {
    return;
  }
  const [removed] = state.overrides.splice(index, 1);
  const restored: Record<string, unknown> = {};
  for (const key of Object.keys(removed.environment)) {
    const remaining = [...state.overrides].reverse().find(o => key in o.environment);
    if (remaining) {
      restored[key] = remaining.environment[key];
    } else {
      restored[key] = state.base[key];
      delete state.base[key];
    }
  }
  if (!state.overrides.length) {
    sceneOverrides.delete(scene);
  }
  scene.setEnvironment(restored as Partial<E>);
}
