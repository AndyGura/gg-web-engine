---
title: core/base/components/audio/i-audio-source.component-factory.ts
nav_order: 86
parent: Modules
---

## i-audio-source.component-factory overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IAudioSourceComponentFactory (interface)](#iaudiosourcecomponentfactory-interface)

---

# utils

## IAudioSourceComponentFactory (interface)

Builds `IAudioSourceComponent`s. Unlike the rendering/physics factories, this contract is
identical across dimensions (a clip in, a positioned source out - no shape descriptor to
specialize the way `Shape2DDescriptor`/`Shape3DDescriptor` differ), so it's defined once here
rather than duplicated in `2d/factories.ts`/`3d/factories.ts` - those instead declare an
`IAudioSource(2d|3d)ComponentFactory` that only narrows `D`/`R`, matching how
`IAudioScene(2d|3d)Component` narrows `IAudioSceneComponent`.

**Signature**

```ts
export interface IAudioSourceComponentFactory<D, R, ATypeDoc extends AudioTypeDocRepo<D, R> = AudioTypeDocRepo<D, R>> {
  /**
   * Fetch + decode a clip from a URL into whatever native representation this adapter's
   * `createSource` expects (e.g. a decoded Web Audio `AudioBuffer`). Adapters are expected to
   * cache the resolved value per URL, so calling this repeatedly for the same clip doesn't
   * re-fetch/re-decode every time.
   */
  loadClip(url: string): Promise<ATypeDoc['clip']>

  createSource(descriptor: AudioSourceDescriptor<ATypeDoc['clip']>): ATypeDoc['source']
}
```
