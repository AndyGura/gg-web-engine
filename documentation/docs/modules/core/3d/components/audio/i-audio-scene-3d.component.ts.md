---
title: core/3d/components/audio/i-audio-scene-3d.component.ts
nav_order: 48
parent: Modules
---

## i-audio-scene-3d.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IAudioScene3dComponent (interface)](#iaudioscene3dcomponent-interface)

---

# utils

## IAudioScene3dComponent (interface)

**Signature**

```ts
export interface IAudioScene3dComponent<ATypeDoc extends AudioTypeDocRepo3D = AudioTypeDocRepo3D>
  extends IAudioSceneComponent<Point3, Point4, ATypeDoc> {
  /**
   * Panning model given to every 3D source created from now on whose descriptor sets none
   * (`AudioSource3dDescriptor.panningModel`). Defaults to `'HRTF'`. Set it once at startup, e.g. to
   * `'equalpower'` on mobile, to switch a whole game over in one place; sources that already exist
   * keep theirs (`IAudioSource3dComponent.panningModel` changes one).
   */
  defaultPanningModel: AudioPanningModel
}
```
