import {
  isProceduralSky,
  PROCEDURAL_SKY_DEFAULTS,
  proceduralSkyBodies,
  ProceduralSky3dOpts,
  Pnt3,
  resolveProceduralSky,
} from '../../src';

describe('procedural sky', () => {
  it('fills in defaults, keeping nested cloud settings and a null cloud layer', () => {
    const sky = resolveProceduralSky({ type: 'PROCEDURAL', timeOfDay: 18, clouds: { coverage: 1 } });
    expect(sky.timeOfDay).toBe(18);
    expect(sky.haze).toBe(PROCEDURAL_SKY_DEFAULTS.haze);
    expect(sky.clouds).toEqual({ ...PROCEDURAL_SKY_DEFAULTS.clouds, coverage: 1 });
    expect(resolveProceduralSky({ type: 'PROCEDURAL', clouds: null }).clouds).toBeNull();
  });

  it('tells a procedural sky from colors and textures', () => {
    expect(isProceduralSky({ type: 'PROCEDURAL' })).toBe(true);
    expect(isProceduralSky(0x123456)).toBe(false);
    expect(isProceduralSky(null)).toBe(false);
    // a texture object of a rendering library may well have a numeric `type`
    expect(isProceduralSky({ type: 1009 })).toBe(false);
  });

  it('moves the sun along its path: sunrise, noon, sunset, midnight', () => {
    const at = (timeOfDay: number, extra: Partial<ProceduralSky3dOpts> = {}) =>
      proceduralSkyBodies({ type: 'PROCEDURAL', timeOfDay, ...extra });
    const peak = Math.PI / 3;
    const close = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => {
      expect(a.x).toBeCloseTo(b.x);
      expect(a.y).toBeCloseTo(b.y);
      expect(a.z).toBeCloseTo(b.z);
    };
    // noon sun towards +X (sunAzimuth 0), rising a quarter turn counterclockwise of it
    close(at(6).sunDirection, Pnt3.Y);
    close(at(12).sunDirection, { x: Math.cos(peak), y: 0, z: Math.sin(peak) });
    close(at(18).sunDirection, Pnt3.nY);
    close(at(0).sunDirection, { x: -Math.cos(peak), y: 0, z: -Math.sin(peak) });
    close(at(0).moonDirection, { x: Math.cos(peak), y: 0, z: Math.sin(peak) });
    close(at(12, { sunAzimuth: Math.PI / 2, sunPeakElevation: Math.PI / 2 }).sunDirection, Pnt3.Z);
  });

  it('gives sunlight for a directional light: bright white at noon, orange and dim near sunset, none at night or under overcast', () => {
    const noon = proceduralSkyBodies({ type: 'PROCEDURAL', timeOfDay: 12, haze: 0 }).sunLight;
    const evening = proceduralSkyBodies({ type: 'PROCEDURAL', timeOfDay: 17.8 }).sunLight;
    const night = proceduralSkyBodies({ type: 'PROCEDURAL', timeOfDay: 23 }).sunLight;
    const overcast = proceduralSkyBodies({ type: 'PROCEDURAL', timeOfDay: 12, clouds: { coverage: 1, density: 1 } })
      .sunLight;
    expect(noon.intensity).toBeGreaterThan(0.7);
    expect(noon.color >> 16).toBe(0xff);
    expect(noon.color & 0xff).toBeGreaterThan(0xb0);
    expect(evening.intensity).toBeLessThan(noon.intensity);
    expect(evening.color & 0xff).toBeLessThan(0x60);
    expect(night.intensity).toBe(0);
    expect(overcast.intensity).toBeLessThan(0.2);
  });
});
