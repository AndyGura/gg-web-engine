// Replaces pixi.js with minimal stand-ins - this package's jest setup can't load the real pixi.js
// runtime (see pixi-display-object.component.spec.ts).
jest.mock('pixi.js', () => {
  class Point {
    x = 0;
    y = 0;
    copyFrom(p: { x: number; y: number }) {
      this.x = p.x;
      this.y = p.y;
    }
  }
  class Rectangle {
    constructor(
      public x = 0,
      public y = 0,
      public width = 0,
      public height = 0,
    ) {}
  }
  class Texture {
    static WHITE: Texture;
    source: any;
    frame: Rectangle;
    orig: Rectangle;
    destroyed = false;
    constructor(options: { source?: any; frame?: Rectangle } = {}) {
      this.source = options.source ?? { width: 1, height: 1 };
      this.frame = options.frame ?? new Rectangle(0, 0, this.source.width, this.source.height);
      this.orig = this.frame;
    }
    destroy() {
      this.destroyed = true;
    }
  }
  Texture.WHITE = new Texture();
  class Container {
    position = new Point();
    scale = Object.assign(new Point(), { x: 1, y: 1 });
    pivot = new Point();
    skew = new Point();
    rotation = 0;
    visible = true;
    zIndex = 0;
    tint = 0xffffff;
    alpha = 1;
    blendMode = 'normal';
    children: Container[] = [];
    destroyed = false;
    destroy() {
      this.destroyed = true;
    }
  }
  class ParticleContainer extends Container {
    texture: Texture;
    particleChildren: any[] = [];
    options: any;
    updates = 0;
    constructor(options: any) {
      super();
      this.options = options;
      this.texture = options.texture;
    }
    update() {
      this.updates++;
    }
  }
  class Graphics extends Container {}
  class Sprite extends Container {}
  class AnimatedSprite extends Sprite {}
  class Text extends Container {}
  return { Container, ParticleContainer, Rectangle, Texture, Graphics, Sprite, AnimatedSprite, Text };
});

import { ParticleFrames, ParticleSimulation, Point2 } from '@gg-web-engine/core';
import { Texture } from 'pixi.js';
import { PixiParticleSystemComponent } from '../../src/components/pixi-particle-system.component';

const atlas = (width: number, height: number): Texture => new Texture({ source: { width, height } } as any);

describe('PixiParticleSystemComponent', () => {
  it('builds a ParticleContainer with every property dynamic, the blend mode and z-index', () => {
    const texture = atlas(32, 32);
    const system = new PixiParticleSystemComponent({
      capacity: 8,
      texture,
      blending: 'additive',
      zIndex: 4,
      roundPixels: true,
    });
    expect(system.capacity).toBe(8);
    const native = system.nativeSprite as any;
    expect(native.texture).toBe(texture);
    expect(native.options.dynamicProperties).toEqual({
      vertex: true,
      position: true,
      rotation: true,
      uvs: true,
      color: true,
    });
    expect(native.options.roundPixels).toBe(true);
    expect(native.blendMode).toBe('add');
    expect(system.zIndex).toBe(4);
    expect(new PixiParticleSystemComponent({ capacity: 1 }).nativeSprite.texture).toBe(Texture.WHITE);
    expect(() => new PixiParticleSystemComponent({ capacity: 0 })).toThrow();
  });

  it('fills pooled particles from the buffers: position, scale from the size, rotation, packed color', () => {
    const system = new PixiParticleSystemComponent({ capacity: 4, texture: atlas(10, 20) });
    const simulation = new ParticleSimulation<Point2>(4, 2, { lifetime: 10 });
    simulation.emit(1, p => {
      p.position = { x: 5, y: 7 };
      p.size = { x: 30, y: 40 };
      p.rotation = 0.5;
      p.tint = 0x102030;
      p.opacity = 0.5;
    });
    simulation.emit(1, p => (p.position = { x: 1, y: 2 }));
    system.setParticles(simulation.writeRenderBuffers());
    const native = system.nativeSprite as any;
    expect(native.particleChildren.length).toBe(2);
    expect(native.updates).toBe(1);
    const [first, second] = native.particleChildren;
    expect(first.x).toBe(5);
    expect(first.y).toBe(7);
    expect(first.scaleX).toBeCloseTo(3);
    expect(first.scaleY).toBeCloseTo(2);
    expect(first.rotation).toBeCloseTo(0.5);
    expect(first.anchorX).toBe(0.5);
    expect(first.color).toBe(((128 << 24) | (0x30 << 16) | (0x20 << 8) | 0x10) >>> 0);
    expect(second.color).toBe(0xffffffff);
    expect(second.texture).toBe(native.texture);
    // the same pooled records are reused, and the list shrinks with the count
    simulation.clear();
    system.setParticles(simulation.writeRenderBuffers());
    expect(native.particleChildren.length).toBe(0);
    simulation.emit(1);
    system.setParticles(simulation.writeRenderBuffers());
    expect(native.particleChildren[0]).toBe(first);
  });

  it('shows atlas regions through shared sub-textures of the system texture', () => {
    const system = new PixiParticleSystemComponent({ capacity: 4, texture: atlas(64, 32) });
    const simulation = new ParticleSimulation<Point2>(4, 2, { lifetime: 10, frames: ParticleFrames.grid(2, 1) });
    simulation.emit(1, p => (p.frame = 1));
    simulation.emit(1, p => (p.frame = 1));
    simulation.emit(1, p => (p.frame = 0));
    system.setParticles(simulation.writeRenderBuffers());
    const [a, b, c] = (system.nativeSprite as any).particleChildren;
    expect(a.texture.frame).toEqual({ x: 32, y: 0, width: 32, height: 32 });
    expect(a.texture).toBe(b.texture);
    expect(c.texture.frame).toEqual({ x: 0, y: 0, width: 32, height: 32 });
    expect(c.texture).not.toBe(system.nativeSprite.texture);
    // swapping the texture drops the sub-textures
    const sub = a.texture;
    system.texture = atlas(16, 16);
    expect(sub.destroyed).toBe(true);
    expect(system.texture!.orig.width).toBe(16);
    system.setParticles(simulation.writeRenderBuffers());
    expect((system.nativeSprite as any).particleChildren[0].texture.frame).toEqual({
      x: 8,
      y: 0,
      width: 8,
      height: 16,
    });
  });

  it('rejects 3D buffers and buffers beyond its capacity', () => {
    const system = new PixiParticleSystemComponent({ capacity: 2 });
    expect(() => system.setParticles(new ParticleSimulation(2, 3).writeRenderBuffers())).toThrow(/2D/);
    expect(() => system.setParticles(new ParticleSimulation<Point2>(3, 2).writeRenderBuffers())).toThrow(/capacity/);
  });

  it('clones into an empty system with the same options and disposes without touching the texture', () => {
    const texture = atlas(8, 8);
    const system = new PixiParticleSystemComponent({ capacity: 3, texture, zIndex: 2 });
    system.position = { x: 1, y: 2 };
    system.opacity = 0.5;
    const copy = system.clone();
    expect(copy).toBeInstanceOf(PixiParticleSystemComponent);
    expect(copy.capacity).toBe(3);
    expect(copy.texture).toBe(texture);
    expect(copy.position).toEqual({ x: 1, y: 2 });
    expect(copy.zIndex).toBe(2);
    expect(copy.opacity).toBe(0.5);
    expect((copy.nativeSprite as any).particleChildren.length).toBe(0);
    system.dispose();
    expect((system.nativeSprite as any).destroyed).toBe(true);
    expect((texture as any).destroyed).toBe(false);
  });
});
