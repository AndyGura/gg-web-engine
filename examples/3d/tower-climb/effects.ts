import { Point3 } from '@gg-web-engine/core';
import { ThreeGgWorld } from '@gg-web-engine/three';

/** A soft round dot, drawn once at runtime: the sprite of every particle in the game. */
function dotCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.6)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 32, 32);
  return canvas;
}

/**
 * A dusk sky, painted at runtime: a vertical gradient used as an equirectangular panorama (its top
 * edge is overhead). The horizon matches the level's fog color, so far pads fade into the sky.
 */
export function paintSky(world: ThreeGgWorld): void {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const context = canvas.getContext('2d')!;
  const gradient = context.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, '#1d2b5a');
  gradient.addColorStop(0.38, '#6f7fb3');
  gradient.addColorStop(0.5, '#c3a9c9');
  gradient.addColorStop(1, '#2a2f4f');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 4, 256);
  const sky = world.visualScene.factory.createTextureFromCanvas(canvas, { mapping: 'equirectangular' });
  world.visualScene.setEnvironment({ background: sky });
}

/**
 * The game's particle effects: one system for every one-off burst (crystal pickups, checkpoints,
 * respawns, the win), one continuous fountain over the beacon. Each system is a single draw call.
 */
export function createEffects(world: ThreeGgWorld, beacon: Point3) {
  const texture = world.visualScene.factory.createTextureFromCanvas(dotCanvas());

  const sparks = world.addParticleSystem(
    { capacity: 600, texture, blending: 'additive' },
    {
      lifetime: [0.5, 1.1],
      gravity: { x: 0, y: 0, z: -5 },
      drag: 1.2,
      sizeOverLife: [1, 0.2],
      opacityOverLife: [1, 1, 0],
    },
  );

  // Off until the beacon is lit; `rate` then spawns 60 particles a second around its crystal.
  const fountain = world.addParticleSystem(
    { capacity: 300, texture, blending: 'additive' },
    {
      emitting: false,
      rate: 60,
      lifetime: [1.2, 2],
      gravity: { x: 0, y: 0, z: -1.5 },
      tint: 0xffd166,
      sizeOverLife: [0.4, 1, 0],
      init: (p, ctx) => {
        const angle = ctx.range(0, Math.PI * 2);
        p.position = { x: beacon.x + Math.cos(angle) * 0.5, y: beacon.y + Math.sin(angle) * 0.5, z: beacon.z + 1 };
        p.velocity = { x: Math.cos(angle) * ctx.range(0.5, 1.5), y: Math.sin(angle) * ctx.range(0.5, 1.5), z: 3 };
        p.size.x = p.size.y = ctx.range(0.15, 0.3);
      },
    },
  );

  return {
    /** A spray of `count` sparks in every direction from `at`. */
    burst(at: Point3, color: number, count = 60, speed = 4): void {
      sparks.emit(count, (p, ctx) => {
        p.position = at;
        // a random direction, slightly biased upwards
        const theta = ctx.range(0, Math.PI * 2);
        const z = ctx.range(-0.4, 1);
        const r = Math.sqrt(1 - z * z) * ctx.range(0.5, 1) * speed;
        p.velocity = { x: Math.cos(theta) * r, y: Math.sin(theta) * r, z: z * speed + 1 };
        p.size.x = p.size.y = ctx.range(0.12, 0.25);
        p.tint = ctx.random() < 0.3 ? 0xffffff : color;
      });
    },
    lightBeacon(): void {
      fountain.emitting = true;
    },
  };
}
