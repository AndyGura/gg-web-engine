/**
 * Names one asset for `world.loader.preload` and for the `assets` hook of a level entity class:
 * the same thing the matching loader method takes.
 * - `ggGlb`: a `.glb`+`.meta` pair, as `loadGgGlb` (`url` without extension). `loadProps: false`
 *   leaves out the props/scenes the meta references, `propsPath` is where to find them.
 * - `glb`: a plain `.glb`, as `loadModel` (`url` without extension).
 * - `texture`: as `loadTexture`, with the same options.
 * - `cubeTexture`: as `loadCubeTexture` (3D only).
 * - `clip`: an audio clip, as `loadClip`.
 */
export type AssetRef =
  | { kind: 'ggGlb'; url: string; loadProps?: boolean; propsPath?: string }
  | { kind: 'glb'; url: string; options?: Record<string, any> }
  | { kind: 'texture'; url: string; options?: Record<string, any> }
  | { kind: 'cubeTexture'; faces: Record<string, string> }
  | { kind: 'clip'; url: string };

/** Stable JSON of plain option objects, for cache keys: key order does not matter. */
export function stableKey(value: unknown): string {
  if (value === undefined) {
    return '';
  }
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableKey).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter(k => record[k] !== undefined)
    .sort()
    .map(k => `${JSON.stringify(k)}:${stableKey(record[k])}`)
    .join(',')}}`;
}
