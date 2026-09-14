import { GgWorldTypeDocRepo } from '../../gg-world';
import { BlueprintNode, BlueprintPinDefinition } from '../blueprint-node';

/**
 * One impulse-tiered clip variant - see {@link PlaySoundNodeSettings.impactClips}.
 */
export interface PlaySoundImpactTier {
  /**
   * Minimum triggering-payload `impulse` (inclusive) required to select this tier, in the same
   * units as `CollisionEvent.impulse`. Tiers are compared, not ordered - list them in any order.
   */
  minImpulse: number;

  /** Clip to play when this tier is selected, same semantics as {@link PlaySoundNodeSettings.clip}. */
  clip: string;

  /** Overrides {@link PlaySoundNodeSettings.volume} when this tier is selected. */
  volume?: number;

  /** Overrides {@link PlaySoundNodeSettings.playbackRate} when this tier is selected. */
  playbackRate?: number;
}

/**
 * Settings for the built-in `"PlaySound"` blueprint node - baked in from its
 * {@link BlueprintNodeJson.settings}, not wired at runtime.
 */
export interface PlaySoundNodeSettings {
  /**
   * URL of the clip to play, resolved via `audioScene.factory.loadClip` (the adapter's own
   * fetch+decode caching applies, so triggering this node repeatedly for the same `clip` doesn't
   * re-fetch/re-decode every time). Used as-is unless {@link impactClips} is set and a tier
   * matches the triggering payload - see there.
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

  /**
   * Play a different clip (and optionally volume/playback rate) depending on how hard the
   * triggering collision was - e.g. a light tap vs. a hard crash. Meant for a `"onCollisionStart"`
   * binding (`Entity(2d|3d).onCollisionStart`'s payload carries a numeric `impulse` at its top
   * level - see `CollisionEvent`), matched against each tier's `minImpulse` the same way `position`
   * above is duck-typed off the payload. The node selects the tier with the highest `minImpulse`
   * that's still `<=` the payload's `impulse`, falling back to the top-level `clip`/`volume`/
   * `playbackRate` settings when the payload carries no numeric `impulse` (e.g. wired to a
   * `"Trigger"` entity's `onEntityEntered` instead) or no tier's threshold is met.
   */
  impactClips?: PlaySoundImpactTier[];
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
    const impulse = this.resolvePayloadImpulse(value);
    const tier = impulse !== undefined ? this.pickImpactTier(settings.impactClips, impulse) : undefined;
    const clip = tier?.clip ?? settings.clip;
    if (!clip) {
      console.warn('PlaySound blueprint node has no "clip" setting (and no matching impact tier) - ignoring');
      return;
    }
    const position = settings.position ?? this.resolvePayloadPosition(value);
    audioScene.factory
      .loadClip(clip)
      .then(loadedClip => {
        const source = audioScene.factory.createSource({
          clip: loadedClip,
          loop: false,
          autoplay: false,
          volume: tier?.volume ?? settings.volume,
          playbackRate: tier?.playbackRate ?? settings.playbackRate,
          spatial: settings.spatial,
          bus: settings.bus,
        });
        if (position !== undefined) {
          source.position = position as D;
        }
        source.addToWorld(this.world);
        const subscription = source.ended$.subscribe(() => {
          subscription.unsubscribe();
          source.removeFromWorld(this.world, true);
        });
        source.play();
      })
      .catch(e => console.warn(`PlaySound blueprint node failed to load/play "${clip}":`, e));
  }

  private resolvePayloadPosition(value: unknown): D | undefined {
    if (value && typeof value === 'object' && 'position' in (value as Record<string, unknown>)) {
      return (value as { position: D }).position;
    }
    return undefined;
  }

  private resolvePayloadImpulse(value: unknown): number | undefined {
    if (value && typeof value === 'object' && 'impulse' in (value as Record<string, unknown>)) {
      const impulse = (value as { impulse: unknown }).impulse;
      if (typeof impulse === 'number') {
        return impulse;
      }
    }
    return undefined;
  }

  private pickImpactTier(
    tiers: readonly PlaySoundImpactTier[] | undefined,
    impulse: number,
  ): PlaySoundImpactTier | undefined {
    if (!tiers || tiers.length === 0) {
      return undefined;
    }
    return tiers
      .filter(tier => impulse >= tier.minImpulse)
      .reduce<PlaySoundImpactTier | undefined>(
        (best, tier) => (!best || tier.minImpulse > best.minImpulse ? tier : best),
        undefined,
      );
  }
}
