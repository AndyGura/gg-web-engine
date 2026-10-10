---
title: three/three-loader.ts
nav_order: 234
parent: Modules
---

## three-loader overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [ThreeLoader (class)](#threeloader-class)
    - [loadTexture (method)](#loadtexture-method)
    - [textureFromData (method)](#texturefromdata-method)
    - [decodeTexture (method)](#decodetexture-method)
    - [loadCubeTexture (method)](#loadcubetexture-method)
    - [cubeTextureFromData (method)](#cubetexturefromdata-method)
    - [prepare (method)](#prepare-method)
    - [disposeTexture (method)](#disposetexture-method)
    - [loadFromGgGlb (method)](#loadfromggglb-method)
    - [loadFromGlb (method)](#loadfromglb-method)

---

# utils

## ThreeLoader (class)

**Signature**

```ts
export declare class ThreeLoader {
  constructor(private readonly scene?: ThreeSceneComponent)
}
```

### loadTexture (method)

Loads an image texture. A `.hdr` URL is decoded as a linear Radiance HDR image (the usual
format for image-based lighting); anything else as an sRGB image.

**Signature**

```ts
public async loadTexture(url: string, options: LoadTextureOptions = {}): Promise<Texture>
```

### textureFromData (method)

Decodes `data` like `loadTexture` decodes its url; `options.url` tells a `.hdr` file apart.

**Signature**

```ts
public async textureFromData(data: Blob, options: LoadTextureOptions & { url?: string } = {}): Promise<Texture>
```

### decodeTexture (method)

**Signature**

```ts
private async decodeTexture(source: string, name: string, options: LoadTextureOptions): Promise<Texture>
```

### loadCubeTexture (method)

Loads a cube-map sky. three.js lays a cube map out Y-up (its `py` slot is the sky, and the four
side images have their top edge towards `+Y`) and samples it with the X axis mirrored. So the
engine's Z-up faces go into the slots of the same sky turned a quarter around X - up `pz` into
`py`, down `nz` into `ny`, `ny` into `pz` and `py` into `nz` - with `px`/`nx` in each other's
slot, and `ThreeSceneComponent` turns the texture back by that quarter when it is used as a
background or environment map.

**Signature**

```ts
public async loadCubeTexture(faces: CubeTextureFaces): Promise<CubeTexture>
```

### cubeTextureFromData (method)

`loadCubeTexture` for faces that are already fetched.

**Signature**

```ts
public async cubeTextureFromData(faces: Record<keyof CubeTextureFaces, Blob>): Promise<CubeTexture>
```

### prepare (method)

Uploads a texture, or compiles the shaders and uploads the textures of a model, on every
renderer drawing the scene - the work three.js otherwise does on the first frame the resource
is visible in. With no renderer added to the world yet there is nothing to upload to.

**Signature**

```ts
public async prepare(resource: Texture | ThreeDisplayObjectComponent): Promise<void>
```

### disposeTexture (method)

**Signature**

```ts
public disposeTexture(texture: Texture): void
```

### loadFromGgGlb (method)

**Signature**

```ts
public async loadFromGgGlb(glbFile: ArrayBuffer, meta: GgMeta): Promise<ThreeDisplayObjectComponent | null>
```

### loadFromGlb (method)

**Signature**

```ts
public async loadFromGlb(
    glbFile: ArrayBuffer,
    options: LoadGlbOptions = {},
  ): Promise<ThreeDisplayObjectComponent | null>
```
