import { GgWorldTypeDocRepo } from '../../gg-world';
import { BlueprintNode, BlueprintPinDefinition } from '../blueprint-node';

/**
 * Settings for the built-in `"PlaySound"` blueprint node - baked in from its
 * {@link BlueprintNodeJson.settings}, not wired at runtime.
 */
export interface PlaySoundNodeSettings {
  /**
   * URL of the clip to play, resolved via `audioScene.factory.loadClip` (the adapter's own
   * fetch+decode caching applies, so triggering this node repeatedly for the same `clip` doesn't
   * re-fetch/re-decode every time).
   */
  clip: string;

  volume?: number;
  playbackRate?: number;

  /** Positional vs. flat/non-positional playback. Defaults to `true`. */
  spatial?: boolean;

  /** Output bus/category (e.g. `"sfx"`). Defaults to `"sfx"`. */
  bus?: string;

  /**
   * Fixed world-space position (`Point2`/`Point3`, matching the world's own dimensionality) to
   * play at, overriding whatever the triggering payload carries. Leave unset to play at the
   * triggering payload's own `position` instead (see {@link PlaySoundBlueprintNode}'s doc) - the
   * usual case for "pop a sound where something just happened" (e.g. wired to a `"Trigger"`
   * entity's `onEntityEntered`).
   */
  position?: unknown;
}

/**
 * Built-in blueprint node: plays a transient, self-disposing one-shot sound - the blueprint
 * analogue of `AudioSource(2d|3d)Entity.playOneShot`. Has one input pin, `"trigger"` (a data pin
 * that also acts as this node's trigger, same convention as `RemoveEntity`'s `"entity"` pin) and
 * no output pins.
 *
 * Where the sound plays: `settings.position`, if given, is used as-is; otherwise, if the
 * triggering value looks positionable (has a `position` property - true for the `IEntity &
 * IPositionable(2d|3d)` a `"Trigger"` entity's `onEntityEntered`/`onEntityLeft` emits), that
 * position is used. If neither is available, the source plays wherever the adapter's own
 * `createSource` defaults a fresh source to (usually world origin) - harmless for a non-spatial
 * (`spatial: false`) sound, but likely not what's wanted for a positional one.
 *
 * A world with no `audioScene` logs a warning and does nothing (matching `RemoveEntity`'s
 * missing-reference posture) rather than throwing.
 */
export class PlaySoundBlueprintNode<
  D = any,
  R = any,
  TypeDoc extends GgWorldTypeDocRepo<D, R> = GgWorldTypeDocRepo<D, R>,
> extends BlueprintNode<D, R, TypeDoc> {
  public readonly inputs: readonly BlueprintPinDefinition[] = [{ name: 'trigger', kind: 'data' }];
  public readonly outputs: readonly BlueprintPinDefinition[] = [];

  public trigger(inputName: string, value?: unknown): void {
    if (inputName !== 'trigger') {
      return;
    }
    const audioScene = this.world.audioScene;
    if (!audioScene) {
      console.warn('PlaySound blueprint node triggered, but this world has no audioScene - ignoring');
      return;
    }
    const settings = this.settings as PlaySoundNodeSettings;
    if (!settings.clip) {
      console.warn('PlaySound blueprint node has no "clip" setting - ignoring');
      return;
    }
    const position = settings.position ?? this.resolvePayloadPosition(value);
    audioScene.factory
      .loadClip(settings.clip)
      .then(clip => {
        const source = audioScene.factory.createSource({
          clip,
          loop: false,
          autoplay: false,
          volume: settings.volume,
          playbackRate: settings.playbackRate,
          spatial: settings.spatial,
          bus: settings.bus,
        });
        if (position !== undefined) {
          source.position = position as D;
        }
        const subscription = source.ended$.subscribe(() => {
          subscription.unsubscribe();
          source.dispose();
        });
        source.play();
      })
      .catch(e => console.warn(`PlaySound blueprint node failed to load/play "${settings.clip}":`, e));
  }

  private resolvePayloadPosition(value: unknown): D | undefined {
    if (value && typeof value === 'object' && 'position' in (value as Record<string, unknown>)) {
      return (value as { position: D }).position;
    }
    return undefined;
  }
}
