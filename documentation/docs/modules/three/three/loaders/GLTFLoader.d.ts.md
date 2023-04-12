---
title: three/three/loaders/GLTFLoader.d.ts
nav_order: 86
parent: Modules
---

## GLTFLoader.d overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [GLTF (interface)](#gltf-interface)
  - [GLTFLoader (class)](#gltfloader-class)
    - [load (method)](#load-method)
    - [loadAsync (method)](#loadasync-method)
    - [setDRACOLoader (method)](#setdracoloader-method)
    - [register (method)](#register-method)
    - [unregister (method)](#unregister-method)
    - [setKTX2Loader (method)](#setktx2loader-method)
    - [setMeshoptDecoder (method)](#setmeshoptdecoder-method)
    - [parse (method)](#parse-method)
    - [parseAsync (method)](#parseasync-method)
    - [dracoLoader (property)](#dracoloader-property)
  - [GLTFLoaderPlugin (interface)](#gltfloaderplugin-interface)
  - [GLTFParser (class)](#gltfparser-class)
    - [setExtensions (method)](#setextensions-method)
    - [setPlugins (method)](#setplugins-method)
    - [parse (method)](#parse-method-1)
    - [json (property)](#json-property)
    - [options (property)](#options-property)
    - [fileLoader (property)](#fileloader-property)
    - [textureLoader (property)](#textureloader-property)
    - [plugins (property)](#plugins-property)
    - [extensions (property)](#extensions-property)
    - [associations (property)](#associations-property)
    - [getDependency (property)](#getdependency-property)
    - [getDependencies (property)](#getdependencies-property)
    - [loadBuffer (property)](#loadbuffer-property)
    - [loadBufferView (property)](#loadbufferview-property)
    - [loadAccessor (property)](#loadaccessor-property)
    - [loadTexture (property)](#loadtexture-property)
    - [loadTextureImage (property)](#loadtextureimage-property)
    - [loadImageSource (property)](#loadimagesource-property)
    - [assignTexture (property)](#assigntexture-property)
    - [assignFinalMaterial (property)](#assignfinalmaterial-property)
    - [getMaterialType (property)](#getmaterialtype-property)
    - [loadMaterial (property)](#loadmaterial-property)
    - [createUniqueName (property)](#createuniquename-property)
    - [createNodeMesh (property)](#createnodemesh-property)
    - [loadGeometries (property)](#loadgeometries-property)
    - [loadMesh (property)](#loadmesh-property)
    - [loadCamera (property)](#loadcamera-property)
    - [loadSkin (property)](#loadskin-property)
    - [loadAnimation (property)](#loadanimation-property)
    - [loadNode (property)](#loadnode-property)
    - [loadScene (property)](#loadscene-property)
  - [GLTFReference (interface)](#gltfreference-interface)
  - [GLTFReferenceType (type alias)](#gltfreferencetype-type-alias)

---

# utils

## GLTF (interface)

**Signature**

```ts
export interface GLTF {
  animations: AnimationClip[]
  scene: Group
  scenes: Group[]
  cameras: Camera[]
  asset: {
    copyright?: string | undefined
    generator?: string | undefined
    version?: string | undefined
    minVersion?: string | undefined
    extensions?: any
    extras?: any
  }
  parser: GLTFParser
  userData: any
}
```

## GLTFLoader (class)

**Signature**

```ts
export declare class GLTFLoader {
  constructor(manager?: LoadingManager)
}
```

### load (method)

**Signature**

```ts
load(
        url: string,
        onLoad: (gltf: GLTF) => void,
        onProgress?: (event: ProgressEvent) => void,
        onError?: (event: ErrorEvent) => void,
    ): void;
```

### loadAsync (method)

**Signature**

```ts
loadAsync(url: string, onProgress?: (event: ProgressEvent) => void): Promise<GLTF>;
```

### setDRACOLoader (method)

**Signature**

```ts
setDRACOLoader(dracoLoader: DRACOLoader): GLTFLoader;
```

### register (method)

**Signature**

```ts
register(callback: (parser: GLTFParser) => GLTFLoaderPlugin): GLTFLoader;
```

### unregister (method)

**Signature**

```ts
unregister(callback: (parser: GLTFParser) => GLTFLoaderPlugin): GLTFLoader;
```

### setKTX2Loader (method)

**Signature**

```ts
setKTX2Loader(ktx2Loader: KTX2Loader): GLTFLoader;
```

### setMeshoptDecoder (method)

**Signature**

```ts
setMeshoptDecoder(meshoptDecoder: /* MeshoptDecoder */ any): GLTFLoader;
```

### parse (method)

**Signature**

```ts
parse(
        data: ArrayBuffer | string,
        path: string,
        onLoad: (gltf: GLTF) => void,
        onError?: (event: ErrorEvent) => void,
    ): void;
```

### parseAsync (method)

**Signature**

```ts
parseAsync(data: ArrayBuffer | string, path: string): Promise<GLTF>;
```

### dracoLoader (property)

**Signature**

```ts
dracoLoader: any
```

## GLTFLoaderPlugin (interface)

**Signature**

```ts
export interface GLTFLoaderPlugin {
  beforeRoot?: (() => Promise<void> | null) | undefined
  afterRoot?: ((result: GLTF) => Promise<void> | null) | undefined
  loadNode?: ((nodeIndex: number) => Promise<Object3D> | null) | undefined
  loadMesh?: ((meshIndex: number) => Promise<Group | Mesh | SkinnedMesh> | null) | undefined
  loadBufferView?: ((bufferViewIndex: number) => Promise<ArrayBuffer> | null) | undefined
  loadMaterial?: ((materialIndex: number) => Promise<Material> | null) | undefined
  loadTexture?: ((textureIndex: number) => Promise<Texture> | null) | undefined
  getMaterialType?: ((materialIndex: number) => typeof Material | null) | undefined
  extendMaterialParams?:
    | ((materialIndex: number, materialParams: { [key: string]: any }) => Promise<any> | null)
    | undefined
  createNodeMesh?: ((nodeIndex: number) => Promise<Group | Mesh | SkinnedMesh> | null) | undefined
  createNodeAttachment?: ((nodeIndex: number) => Promise<Object3D> | null) | undefined
}
```

## GLTFParser (class)

**Signature**

```ts
export declare class GLTFParser
```

### setExtensions (method)

**Signature**

```ts
setExtensions(extensions: { [name: string]: any }): void;
```

### setPlugins (method)

**Signature**

```ts
setPlugins(plugins: { [name: string]: GLTFLoaderPlugin }): void;
```

### parse (method)

**Signature**

```ts
parse(onLoad: (gltf: GLTF) => void, onError?: (event: ErrorEvent) => void): void;
```

### json (property)

**Signature**

```ts
json: any
```

### options (property)

**Signature**

```ts
options: { path: string; manager: any; ktx2Loader: any; meshoptDecoder: any; crossOrigin: string; requestHeader: { [header: string]: string; }; }
```

### fileLoader (property)

**Signature**

```ts
fileLoader: any
```

### textureLoader (property)

**Signature**

```ts
textureLoader: any
```

### plugins (property)

**Signature**

```ts
plugins: { [name: string]: GLTFLoaderPlugin; }
```

### extensions (property)

**Signature**

```ts
extensions: { [name: string]: any; }
```

### associations (property)

**Signature**

```ts
associations: any
```

### getDependency (property)

**Signature**

```ts
getDependency: (type: string, index: number) => Promise<any>
```

### getDependencies (property)

**Signature**

```ts
getDependencies: (type: string) => Promise<any[]>
```

### loadBuffer (property)

**Signature**

```ts
loadBuffer: (bufferIndex: number) => Promise<ArrayBuffer>
```

### loadBufferView (property)

**Signature**

```ts
loadBufferView: (bufferViewIndex: number) => Promise<ArrayBuffer>
```

### loadAccessor (property)

**Signature**

```ts
loadAccessor: (accessorIndex: number) => Promise<BufferAttribute | InterleavedBufferAttribute>
```

### loadTexture (property)

**Signature**

```ts
loadTexture: (textureIndex: number) => Promise<Texture>
```

### loadTextureImage (property)

**Signature**

```ts
loadTextureImage: (textureIndex: number, sourceIndex: number, loader: any) => Promise<Texture>
```

### loadImageSource (property)

**Signature**

```ts
loadImageSource: (sourceIndex: number, loader: any) => Promise<Texture>
```

### assignTexture (property)

**Signature**

```ts
assignTexture: (
  materialParams: { [key: string]: any },
  mapName: string,
  mapDef: { index: number; texCoord?: number | undefined; extensions?: any }
) => Promise<void>
```

### assignFinalMaterial (property)

**Signature**

```ts
assignFinalMaterial: (object: any) => void
```

### getMaterialType (property)

**Signature**

```ts
getMaterialType: () => any
```

### loadMaterial (property)

**Signature**

```ts
loadMaterial: (materialIndex: number) => Promise<Material>
```

### createUniqueName (property)

**Signature**

```ts
createUniqueName: (originalName: string) => string
```

### createNodeMesh (property)

**Signature**

```ts
createNodeMesh: (nodeIndex: number) => Promise<Group | Mesh | SkinnedMesh>
```

### loadGeometries (property)

**Signature**

```ts
loadGeometries: (primitives: { [key: string]: any }[]) => Promise<BufferGeometry[]>
```

### loadMesh (property)

**Signature**

```ts
loadMesh: (meshIndex: number) => Promise<Group | Mesh | SkinnedMesh>
```

### loadCamera (property)

**Signature**

```ts
loadCamera: (cameraIndex: number) => Promise<Camera>
```

### loadSkin (property)

**Signature**

```ts
loadSkin: (skinIndex: number) =>
  Promise<{ joints: number[]; inverseBindMatrices?: BufferAttribute | InterleavedBufferAttribute | undefined }>
```

### loadAnimation (property)

**Signature**

```ts
loadAnimation: (animationIndex: number) => Promise<AnimationClip>
```

### loadNode (property)

**Signature**

```ts
loadNode: (nodeIndex: number) => Promise<Object3D>
```

### loadScene (property)

**Signature**

```ts
loadScene: () => Promise<Group>
```

## GLTFReference (interface)

**Signature**

```ts
export interface GLTFReference {
  materials?: number
  nodes?: number
  textures?: number
  meshes?: number
}
```

## GLTFReferenceType (type alias)

**Signature**

```ts
export type GLTFReferenceType = 'materials' | 'nodes' | 'textures' | 'meshes'
```
