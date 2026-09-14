---
title: core/3d/components/audio/i-audio-source-3d.component.ts
nav_order: 36
parent: Modules
---

## i-audio-source-3d.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IAudioSource3dComponent (interface)](#iaudiosource3dcomponent-interface)

---

# utils

## IAudioSource3dComponent (interface)

3D audio source: adds distance-rolloff tuning and a directional emission cone on top of the
base contract - the audio analogue of `ICamera3dComponent` adding FOV to `IDisplayObject3dComponent`.
`refDistance`/`maxDistance`/`rolloffFactor`/`distanceModel` map straight onto the Web Audio
`PannerNode` fields of the same name (see `packages/audio`); `distanceModel` defaults to
`'linear'` rather than the Web Audio default (`'inverse'`) - see `AudioDistanceModel`'s own doc
for why the steep near-field slope of `'inverse'` is the main driver of audible jitter on a
source sitting close to the listener.

**Signature**

```ts
export interface IAudioSource3dComponent<ATypeDoc extends AudioTypeDocRepo3D = AudioTypeDocRepo3D>
  extends IAudioSourceComponent<Point3, Point4, ATypeDoc> {
  refDistance: number
  maxDistance: number
  rolloffFactor: number
  distanceModel: AudioDistanceModel

  /**
   * Directional emission cone, in degrees. `coneInnerAngle: 360` (the default) is omnidirectional
   * - inside that angle the source plays at full gain regardless of `coneOuterGain`; beyond
   * `coneOuterAngle` it plays at `coneOuterGain`, linearly interpolated between the two.
   */
  coneInnerAngle: number
  coneOuterAngle: number
  coneOuterGain: number
}
```
