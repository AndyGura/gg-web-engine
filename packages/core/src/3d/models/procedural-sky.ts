import { Pnt3, Point2, Point3, Point4, Qtrn } from '../../base';

/**
 * The cloud layer of a `ProceduralSky3dOpts`: one layer of noise-generated clouds high above the
 * world, lit by the sun (or the moon at night). All fields are optional.
 */
export type ProceduralSkyClouds3dOpts = {
  /** How much of the sky the clouds cover, `0` (clear sky) to `1` (overcast). Default `0.45`. */
  coverage?: number;
  /** How opaque the clouds are, `0` to `1`. Default `0.8`. */
  density?: number;
  /** Size of the cloud shapes; `2` makes every cloud twice as large. Default `1`. */
  scale?: number;
  /**
   * Drift of the cloud pattern along the world X and Y axes, in cloud-layer heights per second
   * (`{ x: 0.01, y: 0 }` moves a cloud overhead by 1% of the layer's height every second).
   * Default `{ x: 0.006, y: 0.002 }`.
   */
  wind?: Point2;
};

/**
 * A sky drawn by a shader instead of an image: sun, atmosphere, a cloud layer, and stars and a
 * moon at night, all set by the numbers below and changeable at any time. Use it as
 * `Environment3dOpts.background`, and also as `environmentMap` to light `'standart'`-shaded
 * meshes and PBR models with it. Every field except `type` is optional.
 *
 * The sun follows a path across the sky set by `timeOfDay`, `sunAzimuth` and `sunPeakElevation`;
 * `proceduralSkyBodies` returns where the sun and moon are, e.g. to aim a directional light.
 *
 * @example
 * ```ts
 * const sky: ProceduralSky3dOpts = { type: 'PROCEDURAL', timeOfDay: 17.5, clouds: { coverage: 0.6 } };
 * world.visualScene.setEnvironment({ background: sky, environmentMap: sky });
 * // later, e.g. from a slider: only the fields given change
 * world.visualScene.setEnvironment({ background: { ...sky, timeOfDay: 21 } });
 * ```
 */
export type ProceduralSky3dOpts = {
  type: 'PROCEDURAL';
  /**
   * `'DYNAMIC'` (default) draws the sky every frame: clouds drift with `clouds.wind` and stars
   * twinkle. `'BAKED'` draws it once into a cube texture of `bakeResolution` pixels per side and
   * shows that texture, drawing it again only when a setting changes: almost free per frame, but
   * the clouds stand still and stars are softer. As `environmentMap` the sky is always baked.
   */
  mode?: 'DYNAMIC' | 'BAKED';
  /** Pixels per cube side of a `'BAKED'` sky. Default `512`. */
  bakeResolution?: number;
  /**
   * Hour of the day, `0` to `24`: the sun rises at `6`, is highest at `12` and sets at `18`;
   * from `18` to `6` it is night. Default `12`.
   */
  timeOfDay?: number;
  /**
   * Horizontal direction the sun is in at noon, in radians counterclockwise from `+X`. The sun
   * rises a quarter turn counterclockwise of it and sets a quarter turn clockwise of it.
   * Default `0`.
   */
  sunAzimuth?: number;
  /** Height of the sun above the horizon at noon, in radians. Default `Math.PI / 3` (60°). */
  sunPeakElevation?: number;
  /** Apparent radius of the sun disc, in radians. Default `0.02`. */
  sunSize?: number;
  /**
   * Haze, dust and humidity in the air, `0` (crisp blue sky) to `1` (milky white haze, a large
   * glow around the sun, faded horizon). Default `0.2`.
   */
  haze?: number;
  /** Brightness multiplier of the whole sky. Default `1`. */
  exposure?: number;
  /** `0xRRGGBB` color of the ground below the horizon, lit by the sky. Default `0x5a554f`. */
  groundColor?: number;
  /** The cloud layer; `null` for a cloudless sky. Default: the defaults of `ProceduralSkyClouds3dOpts`. */
  clouds?: ProceduralSkyClouds3dOpts | null;
  /** Brightness of the stars at night, `0` (none) to `1`. Default `1`. */
  stars?: number;
  /** Brightness of the moon, `0` (none) to `1`. The moon is opposite the sun. Default `1`. */
  moon?: number;
  /** Apparent radius of the moon disc, in radians. Default `0.025`. */
  moonSize?: number;
};

/** Every setting of a `ProceduralSky3dOpts` with the defaults filled in. */
export type ResolvedProceduralSky3dOpts = Required<Omit<ProceduralSky3dOpts, 'clouds'>> & {
  clouds: Required<ProceduralSkyClouds3dOpts> | null;
};

/** The default value of every `ProceduralSky3dOpts` setting. */
export const PROCEDURAL_SKY_DEFAULTS: ResolvedProceduralSky3dOpts = {
  type: 'PROCEDURAL',
  mode: 'DYNAMIC',
  bakeResolution: 512,
  timeOfDay: 12,
  sunAzimuth: 0,
  sunPeakElevation: Math.PI / 3,
  sunSize: 0.02,
  haze: 0.2,
  exposure: 1,
  groundColor: 0x5a554f,
  clouds: { coverage: 0.45, density: 0.8, scale: 1, wind: { x: 0.006, y: 0.002 } },
  stars: 1,
  moon: 1,
  moonSize: 0.025,
};

/** Whether an `Environment3dOpts.background`/`environmentMap` value is a `ProceduralSky3dOpts`. */
export function isProceduralSky(value: unknown): value is ProceduralSky3dOpts {
  return !!value && typeof value === 'object' && (value as { type?: unknown }).type === 'PROCEDURAL';
}

/** `sky` with every missing setting set to its default (see `PROCEDURAL_SKY_DEFAULTS`). */
export function resolveProceduralSky(sky: ProceduralSky3dOpts): ResolvedProceduralSky3dOpts {
  const clouds = sky.clouds === null ? null : { ...PROCEDURAL_SKY_DEFAULTS.clouds!, ...(sky.clouds || {}) };
  return { ...PROCEDURAL_SKY_DEFAULTS, ...sky, clouds };
}

/**
 * Where the sun, moon and stars of a procedural sky are, and how much sunlight gets through.
 * - `sunDirection`, `moonDirection`: unit vectors from the viewer towards them; below the horizon
 *   their `z` is negative.
 * - `sunLight`: `0xRRGGBB` color of the sunlight reaching the ground (orange near the horizon),
 *   and `intensity`, `0` (night, or the sun hidden by an overcast sky) to `1` (clear noon), for a
 *   directional light that stands for the sun.
 * - `starRotation`: how far the star field has turned around the axis of the sun's path since
 *   sunrise.
 */
export type ProceduralSkyBodies = {
  sunDirection: Point3;
  moonDirection: Point3;
  sunLight: { color: number; intensity: number };
  starRotation: Point4;
};

/**
 * Positions of the sun, moon and stars for the sky's `timeOfDay`, `sunAzimuth` and
 * `sunPeakElevation`.
 *
 * @example
 * ```ts
 * // a directional light shining from the sun
 * const { sunDirection } = proceduralSkyBodies(sky);
 * sunLight.position = Pnt3.scalarMult(sunDirection, 100);
 * sunLight.rotation = Qtrn.lookAt(sunLight.position, Pnt3.O);
 * ```
 */
export function proceduralSkyBodies(sky: ProceduralSky3dOpts): ProceduralSkyBodies {
  const { timeOfDay, sunAzimuth, sunPeakElevation, haze, clouds } = resolveProceduralSky(sky);
  const noon: Point3 = { x: Math.cos(sunAzimuth), y: Math.sin(sunAzimuth), z: 0 };
  const sunrise: Point3 = { x: -noon.y, y: noon.x, z: 0 };
  const peak = Pnt3.add(
    Pnt3.scalarMult(noon, Math.cos(sunPeakElevation)),
    Pnt3.scalarMult(Pnt3.Z, Math.sin(sunPeakElevation)),
  );
  // 0 at sunrise, PI / 2 at noon, PI at sunset
  const angle = ((timeOfDay - 6) / 24) * Math.PI * 2;
  const sunDirection = Pnt3.add(Pnt3.scalarMult(sunrise, Math.cos(angle)), Pnt3.scalarMult(peak, Math.sin(angle)));
  // the same air the sky shader models: Rayleigh optical depth per channel plus haze, times the
  // air mass towards the sun
  const elevation = Math.asin(Math.max(-1, Math.min(1, sunDirection.z)));
  const cosZenith = Math.max(0, sunDirection.z);
  const airMass = 1 / (cosZenith + 0.025 * Math.exp(-11 * cosZenith));
  const mie = 0.005 + 0.3 * haze * haze;
  const transmit = [0.0465, 0.108, 0.265].map(rayleigh => Math.exp(-(rayleigh + mie) * airMass));
  const peak255 = Math.max(...transmit);
  const [r, g, b] = transmit.map(t => Math.round((t / peak255) * 255));
  const overcast = clouds ? clouds.coverage * clouds.density : 0;
  const daylight = Math.max(0, Math.min(1, (elevation + 0.02) / 0.12));
  return {
    sunDirection,
    moonDirection: Pnt3.neg(sunDirection),
    sunLight: { color: (r << 16) | (g << 8) | b, intensity: daylight * peak255 * (1 - 0.85 * overcast * overcast) },
    starRotation: Qtrn.fromAngle(Pnt3.norm(Pnt3.cross(sunrise, peak)), angle),
  };
}
