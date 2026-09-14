---
title: core/2d/components/audio/i-audio-source-2d.component.ts
nav_order: 13
parent: Modules
---

## i-audio-source-2d.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IAudioSource2dComponent (interface)](#iaudiosource2dcomponent-interface)

---

# utils

## IAudioSource2dComponent (interface)

2D audio source: distance-rolloff tuning over the flat `{x, y}` ground plane, no cone/elevation

- there's no `Z` in 2D, the same reason `Pnt2` has no `Z`/`nZ` axis constant. `packages/audio`'s
  2D implementation has no native distance-panning primitive to lean on (Web Audio's
  `StereoPannerNode` is pan-only) - it computes gain/pan itself every `IAudioSceneComponent.update`
  call from these fields, using the same distance-model formulas 3D gets natively from `PannerNode`.

**Signature**

```ts
export interface IAudioSource2dComponent<ATypeDoc extends AudioTypeDocRepo2D = AudioTypeDocRepo2D>
  extends IAudioSourceComponent<Point2, number, ATypeDoc> {
  refDistance: number
  maxDistance: number
  rolloffFactor: number
  distanceModel: AudioDistanceModel
}
```
