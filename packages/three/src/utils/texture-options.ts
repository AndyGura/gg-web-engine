import { LoadTextureOptions } from '@gg-web-engine/core';
import {
  EquirectangularReflectionMapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  NearestFilter,
  RepeatWrapping,
  Texture,
} from 'three';

/** Applies the engine-level texture options (`mapping`, `filter`, `repeat`) to a three.js texture. */
export function applyTextureOptions(texture: Texture, options: LoadTextureOptions): Texture {
  if (options.mapping === 'equirectangular') {
    texture.mapping = EquirectangularReflectionMapping;
  }
  if (options.filter === 'nearest') {
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
  } else if (options.filter === 'linear') {
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearMipmapLinearFilter;
  }
  if (options.repeat) {
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(options.repeat.x, options.repeat.y);
  }
  texture.needsUpdate = true;
  return texture;
}
