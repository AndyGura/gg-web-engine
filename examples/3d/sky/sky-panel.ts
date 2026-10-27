import { ProceduralSky3dOpts, ProceduralSkyCirrus3dOpts, ProceduralSkyClouds3dOpts } from '@gg-web-engine/core';

/**
 * What the panel edits: the sky itself, whether it also lights the scene, and the cirrus layer's
 * settings, kept while the layer is off (`sky.cirrus` is `null` then).
 */
export type SkySettings = {
  sky: ProceduralSky3dOpts & { clouds: Required<ProceduralSkyClouds3dOpts> };
  lightWithSky: boolean;
  cirrusOn: boolean;
  cirrus: Required<ProceduralSkyCirrus3dOpts>;
};

const deg = Math.PI / 180;

const PRESETS: Record<string, (s: SkySettings) => void> = {
  'Clear noon': s => {
    Object.assign(s.sky, { timeOfDay: 12, haze: 0.1 });
    Object.assign(s.sky.clouds, { coverage: 0.15, density: 0.7 });
    s.cirrusOn = true;
    Object.assign(s.cirrus, { coverage: 0.35, density: 0.6 });
  },
  Sunset: s => {
    Object.assign(s.sky, { timeOfDay: 17.75, haze: 0.35 });
    Object.assign(s.sky.clouds, { coverage: 0.3, density: 0.8 });
    s.cirrusOn = true;
    Object.assign(s.cirrus, { coverage: 0.6, density: 0.7 });
  },
  'Winter overcast': s => {
    Object.assign(s.sky, { timeOfDay: 11, haze: 0.6 });
    Object.assign(s.sky.clouds, { coverage: 1, density: 1 });
    s.cirrusOn = false;
  },
  Night: s => {
    Object.assign(s.sky, { timeOfDay: 0.5, haze: 0.1, stars: 1, moon: 1 });
    Object.assign(s.sky.clouds, { coverage: 0.25, density: 0.6 });
    s.cirrusOn = false;
  },
};

/**
 * Builds the settings panel inside `root` and calls `apply` with the current settings whenever
 * something changes (and once right away). `tick(seconds)` moves the time of day while
 * "Animate time" is on.
 */
export function createSkyPanel(root: HTMLElement, apply: (settings: SkySettings) => void) {
  const settings: SkySettings = {
    sky: {
      type: 'PROCEDURAL',
      mode: 'DYNAMIC',
      timeOfDay: 16.5,
      sunAzimuth: 200 * deg,
      sunPeakElevation: 55 * deg,
      sunSize: 0.02,
      haze: 0.25,
      exposure: 1,
      groundColor: 0x5a554f,
      clouds: { coverage: 0.45, density: 0.8, scale: 1, wind: { x: 0.006, y: 0.002 } },
      stars: 1,
      moon: 1,
      moonSize: 0.025,
    },
    lightWithSky: true,
    cirrusOn: true,
    cirrus: { coverage: 0.4, density: 0.6, scale: 1, wind: { x: 0.004, y: 0.001 } },
  };
  let animate = false;
  let hoursPerSecond = 0.5;
  let windSpeed = Math.hypot(settings.sky.clouds.wind.x, settings.sky.clouds.wind.y);
  let windDirection = Math.atan2(settings.sky.clouds.wind.y, settings.sky.clouds.wind.x);
  let cirrusWindSpeed = Math.hypot(settings.cirrus.wind.x, settings.cirrus.wind.y);
  let cirrusWindDirection = Math.atan2(settings.cirrus.wind.y, settings.cirrus.wind.x);
  const refreshers: (() => void)[] = [];

  const changed = () => {
    settings.sky.clouds.wind = { x: Math.cos(windDirection) * windSpeed, y: Math.sin(windDirection) * windSpeed };
    settings.cirrus.wind = {
      x: Math.cos(cirrusWindDirection) * cirrusWindSpeed,
      y: Math.sin(cirrusWindDirection) * cirrusWindSpeed,
    };
    settings.sky.cirrus = settings.cirrusOn ? { ...settings.cirrus } : null;
    // a new object each time, as an app would pass it
    apply({ ...settings, sky: { ...settings.sky, clouds: { ...settings.sky.clouds } } });
  };

  const section = (title: string) => {
    const h = document.createElement('h3');
    h.textContent = title;
    root.appendChild(h);
  };

  const slider = (
    label: string,
    min: number,
    max: number,
    step: number,
    get: () => number,
    set: (v: number) => void,
  ) => {
    const row = document.createElement('label');
    row.className = 'row';
    const name = document.createElement('span');
    name.textContent = label;
    const input = document.createElement('input');
    input.type = 'range';
    Object.assign(input, { min: String(min), max: String(max), step: String(step) });
    const value = document.createElement('output');
    const refresh = () => {
      input.value = String(get());
      value.textContent = (+get().toFixed(3)).toString();
    };
    input.addEventListener('input', () => {
      set(+input.value);
      refresh();
      changed();
    });
    row.append(name, input, value);
    root.appendChild(row);
    refreshers.push(refresh);
    refresh();
  };

  const checkbox = (label: string, get: () => boolean, set: (v: boolean) => void) => {
    const row = document.createElement('label');
    row.className = 'row';
    const input = document.createElement('input');
    input.type = 'checkbox';
    const name = document.createElement('span');
    name.textContent = label;
    input.addEventListener('change', () => {
      set(input.checked);
      changed();
    });
    row.append(input, name);
    root.appendChild(row);
    refreshers.push(() => (input.checked = get()));
    input.checked = get();
  };

  const presets = document.createElement('div');
  presets.className = 'presets';
  for (const [name, preset] of Object.entries(PRESETS)) {
    const button = document.createElement('button');
    button.textContent = name;
    button.addEventListener('click', () => {
      preset(settings);
      refreshers.forEach(r => r());
      changed();
    });
    presets.appendChild(button);
  }
  root.appendChild(presets);

  const s = settings.sky;
  const c = settings.sky.clouds;
  section('Rendering');
  checkbox(
    'Baked (cube texture, redrawn on change)',
    () => s.mode === 'BAKED',
    v => (s.mode = v ? 'BAKED' : 'DYNAMIC'),
  );
  checkbox(
    'Sky lights the scene (environment map)',
    () => settings.lightWithSky,
    v => (settings.lightWithSky = v),
  );
  section('Sun and time');
  slider(
    'Time of day',
    0,
    24,
    0.01,
    () => s.timeOfDay!,
    v => (s.timeOfDay = v),
  );
  checkbox(
    'Animate time',
    () => animate,
    v => (animate = v),
  );
  slider(
    'Hours per second',
    0.05,
    4,
    0.05,
    () => hoursPerSecond,
    v => (hoursPerSecond = v),
  );
  slider(
    'Sun azimuth (°)',
    0,
    360,
    1,
    () => s.sunAzimuth! / deg,
    v => (s.sunAzimuth = v * deg),
  );
  slider(
    'Sun noon elevation (°)',
    5,
    90,
    1,
    () => s.sunPeakElevation! / deg,
    v => (s.sunPeakElevation = v * deg),
  );
  slider(
    'Sun size',
    0.005,
    0.08,
    0.001,
    () => s.sunSize!,
    v => (s.sunSize = v),
  );
  section('Air');
  slider(
    'Haze',
    0,
    1,
    0.01,
    () => s.haze!,
    v => (s.haze = v),
  );
  slider(
    'Exposure',
    0.2,
    3,
    0.01,
    () => s.exposure!,
    v => (s.exposure = v),
  );
  section('Clouds');
  slider(
    'Coverage',
    0,
    1,
    0.01,
    () => c.coverage,
    v => (c.coverage = v),
  );
  slider(
    'Density',
    0,
    1,
    0.01,
    () => c.density,
    v => (c.density = v),
  );
  slider(
    'Scale',
    0.2,
    4,
    0.01,
    () => c.scale,
    v => (c.scale = v),
  );
  slider(
    'Wind speed',
    0,
    0.05,
    0.001,
    () => windSpeed,
    v => (windSpeed = v),
  );
  slider(
    'Wind direction (°)',
    0,
    360,
    1,
    () => windDirection / deg,
    v => (windDirection = v * deg),
  );
  section('Cirrus (high streaks)');
  const ci = settings.cirrus;
  checkbox(
    'Cirrus layer',
    () => settings.cirrusOn,
    v => (settings.cirrusOn = v),
  );
  slider(
    'Cirrus coverage',
    0,
    1,
    0.01,
    () => ci.coverage,
    v => (ci.coverage = v),
  );
  slider(
    'Cirrus density',
    0,
    1,
    0.01,
    () => ci.density,
    v => (ci.density = v),
  );
  slider(
    'Cirrus scale',
    0.2,
    4,
    0.01,
    () => ci.scale,
    v => (ci.scale = v),
  );
  slider(
    'Cirrus wind speed',
    0,
    0.05,
    0.001,
    () => cirrusWindSpeed,
    v => (cirrusWindSpeed = v),
  );
  slider(
    'Cirrus direction (°)',
    0,
    360,
    1,
    () => cirrusWindDirection / deg,
    v => (cirrusWindDirection = v * deg),
  );
  section('Night');
  slider(
    'Stars',
    0,
    1,
    0.01,
    () => s.stars!,
    v => (s.stars = v),
  );
  slider(
    'Moon',
    0,
    1,
    0.01,
    () => s.moon!,
    v => (s.moon = v),
  );
  slider(
    'Moon size',
    0.005,
    0.08,
    0.001,
    () => s.moonSize!,
    v => (s.moonSize = v),
  );

  changed();

  return {
    tick(seconds: number) {
      if (!animate) {
        return;
      }
      s.timeOfDay = (s.timeOfDay! + seconds * hoursPerSecond) % 24;
      refreshers.forEach(r => r());
      changed();
    },
  };
}
