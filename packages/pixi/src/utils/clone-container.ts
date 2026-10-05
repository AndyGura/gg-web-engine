import { AnimatedSprite, Container, Graphics, Sprite, Text } from 'pixi.js';

/**
 * Copies everything a display object component exposes (transform, visibility, z-index, tint,
 * opacity) from `source` to `target`, and gives `target` its own deep copy of each of `source`'s
 * children.
 */
export function copyContainerState(source: Container, target: Container): void {
  target.position.copyFrom(source.position);
  target.scale.copyFrom(source.scale);
  target.pivot.copyFrom(source.pivot);
  target.skew.copyFrom(source.skew);
  target.rotation = source.rotation;
  target.visible = source.visible;
  target.zIndex = source.zIndex;
  target.tint = source.tint;
  target.alpha = source.alpha;
  for (const child of source.children) {
    target.addChild(cloneContainer(child));
  }
}

/**
 * Deep copy of a native display object and everything nested in it. pixi.js has no generic
 * `Container.clone()`, so this covers the kinds of object this package's factory and components
 * build: `Graphics`, `Sprite`, `AnimatedSprite`, `Text` and plain `Container`. Textures are shared
 * with the source, everything else is independent of it - destroying the copy leaves the source
 * intact and vice versa.
 */
export function cloneContainer<T extends Container>(source: T): T {
  let clone: Container;
  if (source instanceof Graphics) {
    // deep, so the copy doesn't share (and later destroy) the source's drawing context
    clone = source.clone(true);
  } else if (source instanceof AnimatedSprite) {
    const sprite = new AnimatedSprite(source.textures, source.autoUpdate);
    sprite.anchor.copyFrom(source.anchor);
    sprite.animationSpeed = source.animationSpeed;
    sprite.loop = source.loop;
    clone = sprite;
  } else if (source instanceof Sprite) {
    const sprite = new Sprite(source.texture);
    sprite.anchor.copyFrom(source.anchor);
    clone = sprite;
  } else if (source instanceof Text) {
    const text = new Text({ text: source.text, style: source.style.clone() });
    text.anchor.copyFrom(source.anchor);
    clone = text;
  } else {
    clone = new Container();
  }
  copyContainerState(source, clone);
  return clone as T;
}
