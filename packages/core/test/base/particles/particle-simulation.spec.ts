import {
  evaluateParticleCurve,
  Particle,
  ParticleFrames,
  ParticleSimulation,
  ParticleSimulationOptions,
  Point2,
  Point3,
  sortParticlesBackToFront,
} from '../../../src';

const sim3 = (options: ParticleSimulationOptions<Point3> = {}, capacity = 8) =>
  new ParticleSimulation<Point3>(capacity, 3, options);

const positions = (s: ParticleSimulation<Point3>): Point3[] => {
  const b = s.writeRenderBuffers();
  const result: Point3[] = [];
  for (let i = 0; i < b.count; i++) {
    result.push({ x: b.position[i * 3], y: b.position[i * 3 + 1], z: b.position[i * 3 + 2] });
  }
  return result;
};

describe('evaluateParticleCurve', () => {
  const p = new Particle(0, 3);

  it('treats a missing curve as 1 and a number as a constant', () => {
    expect(evaluateParticleCurve(undefined, 0.3, p)).toBe(1);
    expect(evaluateParticleCurve(0.25, 0.3, p)).toBe(0.25);
  });

  it('spreads a number array evenly over the normalized age, linearly', () => {
    expect(evaluateParticleCurve([1, 0], 0.25, p)).toBeCloseTo(0.75);
    expect(evaluateParticleCurve([0, 1, 0], 0.5, p)).toBeCloseTo(1);
    expect(evaluateParticleCurve([0, 1, 0], 0.75, p)).toBeCloseTo(0.5);
    expect(evaluateParticleCurve([0, 1, 0], 1, p)).toBe(0);
  });

  it('interpolates keyframes and holds them outside their range', () => {
    const curve = [
      { t: 0.2, value: 2 },
      { t: 0.6, value: 4 },
    ];
    expect(evaluateParticleCurve(curve, 0, p)).toBe(2);
    expect(evaluateParticleCurve(curve, 0.4, p)).toBeCloseTo(3);
    expect(evaluateParticleCurve(curve, 0.9, p)).toBe(4);
  });

  it('holds each value until the next keyframe with step interpolation', () => {
    const curve = { keyframes: [10, 20, 30, 40], interpolation: 'step' as const };
    expect(evaluateParticleCurve(curve, 0.3, p)).toBe(10);
    expect(evaluateParticleCurve(curve, 0.34, p)).toBe(20);
    expect(evaluateParticleCurve(curve, 0.99, p)).toBe(30);
    expect(evaluateParticleCurve(curve, 1, p)).toBe(40);
  });

  it('calls a function curve with the age and the particle', () => {
    const fn = jest.fn((t: number, particle: Particle) => t * particle.index);
    const q = new Particle(4, 3);
    expect(evaluateParticleCurve(fn, 0.5, q)).toBe(2);
    expect(fn).toHaveBeenCalledWith(0.5, q);
  });
});

describe('ParticleFrames', () => {
  it('builds grid cells row by row from the top-left', () => {
    const frames = ParticleFrames.grid(2, 2, 3);
    expect(frames).toEqual([
      { x: 0, y: 0, width: 0.5, height: 0.5 },
      { x: 0.5, y: 0, width: 0.5, height: 0.5 },
      { x: 0, y: 0.5, width: 0.5, height: 0.5 },
    ]);
  });

  it('normalizes pixel regions of different sizes', () => {
    const frames = ParticleFrames.fromPixels(
      [
        { x: 0, y: 0, width: 75, height: 38 },
        { x: 75, y: 0, width: 64, height: 64 },
      ],
      139,
      64,
    );
    expect(frames[0]).toEqual({ x: 0, y: 0, width: 75 / 139, height: 38 / 64 });
    expect(frames[1]).toEqual({ x: 75 / 139, y: 0, width: 64 / 139, height: 1 });
  });
});

describe('ParticleSimulation', () => {
  describe('emission', () => {
    it('applies defaults, then the options init, then the emit init, at the emitter origin', () => {
      const calls: string[] = [];
      const s = sim3({
        lifetime: 2,
        size: { x: 0.75, y: 0.38 },
        opacity: 0.5,
        tint: 0x808080,
        drag: 3,
        init: p => {
          calls.push('options');
          p.velocity = { x: 1, y: 0, z: 0 };
        },
      });
      s.transform = {
        pointToSim: l => ({ x: l.x + 10, y: l.y, z: l.z }),
        directionToSim: l => ({ ...l }),
      };
      const emitted = s.emit(2, (p, ctx) => {
        calls.push('emit');
        expect(p.velocity).toEqual({ x: 1, y: 0, z: 0 });
        expect(ctx.count).toBe(2);
        expect(ctx.origin).toEqual({ x: 10, y: 0, z: 0 });
        p.data = ctx.index;
      });
      expect(emitted).toBe(2);
      expect(calls).toEqual(['options', 'emit', 'options', 'emit']);
      const all: Particle[] = [];
      s.forEachParticle(p => all.push(p));
      expect(all.map(p => p.data)).toEqual([0, 1]);
      expect(all[0].position).toEqual({ x: 10, y: 0, z: 0 });
      expect(all[0].lifetime).toBe(2);
      expect(all[0].size).toEqual({ x: 0.75, y: 0.38 });
      expect(all[0].opacity).toBe(0.5);
      expect(all[0].tint).toBe(0x808080);
      expect(all[0].drag).toBe(3);
      expect(all[1].serial).toBeGreaterThan(all[0].serial);
    });

    it('copies assigned vectors, so one object can seed many particles', () => {
      const s = sim3({ lifetime: 10 });
      const shared = { x: 1, y: 2, z: 3 };
      s.emit(2, p => {
        p.position = shared;
        p.velocity = { x: 1, y: 0, z: 0 };
      });
      s.step(1);
      expect(shared).toEqual({ x: 1, y: 2, z: 3 });
      expect(positions(s)).toEqual([
        { x: 2, y: 2, z: 3 },
        { x: 2, y: 2, z: 3 },
      ]);
    });

    it('reuses the oldest particle when full by default', () => {
      const s = sim3({}, 3);
      for (let i = 0; i < 5; i++) {
        s.emit(1, p => (p.data = i));
      }
      const data: number[] = [];
      s.forEachParticle(p => data.push(p.data));
      expect(data).toEqual([2, 3, 4]);
      expect(s.count).toBe(3);
    });

    it('drops new particles when full with overflow "drop"', () => {
      const s = sim3({ overflow: 'drop' }, 3);
      expect(s.emit(5, (p, ctx) => (p.data = ctx.index))).toBe(3);
      const data: number[] = [];
      s.forEachParticle(p => data.push(p.data));
      expect(data).toEqual([0, 1, 2]);
    });

    it('frees the slot of a killed particle for the next spawn', () => {
      const s = sim3({ overflow: 'drop' }, 2);
      s.emit(2);
      s.forEachParticle(p => p.data === undefined && p.serial === 0 && p.kill());
      expect(s.emit(1)).toBe(1);
      expect(s.count).toBe(2);
    });

    it('spawns at a continuous rate and in bursts while emitting', () => {
      const s = sim3({ rate: 10, lifetime: 100, bursts: [{ time: 0.25, count: 3, interval: 0.25, cycles: 2 }] }, 64);
      for (let i = 0; i < 10; i++) {
        s.step(0.1);
      }
      expect(s.count).toBe(10 + 6);
      s.emitting = false;
      s.step(0.1);
      expect(s.count).toBe(16);
      expect(s.emit(1)).toBe(1);
    });
  });

  describe('motion', () => {
    it('integrates gravity, own acceleration, drag, rotation', () => {
      const s = sim3({ gravity: { x: 0, y: 0, z: -10 }, lifetime: 10 });
      s.emit(1, p => {
        p.velocity = { x: 2, y: 0, z: 0 };
        p.acceleration = { x: 0, y: 4, z: 0 };
        p.angularVelocity = 1;
        p.drag = 0;
      });
      s.step(0.5);
      let particle!: Particle;
      s.forEachParticle(p => (particle = p));
      expect(particle.velocity).toEqual({ x: 2, y: 2, z: -5 });
      expect(particle.position).toEqual({ x: 1, y: 1, z: -2.5 });
      expect(particle.rotation).toBeCloseTo(0.5);
      particle.drag = Math.log(2);
      s.step(1);
      expect(particle.velocity.x).toBeCloseTo(1);
    });

    it('kills a particle on the step its age reaches its lifetime', () => {
      const s = sim3({ lifetime: 10 / 30 });
      s.emit(1);
      for (let i = 0; i < 9; i++) {
        s.step(1 / 30);
      }
      expect(s.count).toBe(1);
      s.step(1 / 30);
      expect(s.count).toBe(0);
    });

    it('moves a particle spawned in a step only from the next step on', () => {
      const s = sim3({
        lifetime: 10,
        onStep: (dt, sim) => sim.emit(1, p => (p.velocity = { x: 1, y: 0, z: 0 })),
      });
      s.step(1);
      expect(positions(s)).toEqual([{ x: 0, y: 0, z: 0 }]);
      s.step(1);
      expect(positions(s)).toEqual([
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
      ]);
    });

    it('runs the update callback after the built-in motion, and it may kill', () => {
      const s = sim3({
        update: (p, dt) => {
          p.size = { x: p.size.x + dt, y: 1 };
          if (p.steps === 2) {
            p.kill();
          }
        },
      });
      s.emit(1, p => (p.velocity = { x: 1, y: 0, z: 0 }));
      s.step(0.25);
      const b = s.writeRenderBuffers();
      expect(b.size[0]).toBeCloseTo(1.25);
      s.step(0.25);
      expect(s.count).toBe(0);
    });

    it('works in 2D', () => {
      const s = new ParticleSimulation<Point2>(4, 2, { gravity: { x: 0, y: -10 } });
      s.emit(1, p => (p.velocity = { x: 1, y: 0 }));
      s.step(0.1);
      const b = s.writeRenderBuffers();
      expect(b.dimensions).toBe(2);
      expect(b.position[0]).toBeCloseTo(0.1);
      expect(b.position[1]).toBeCloseTo(-0.1);
    });
  });

  describe('frames', () => {
    it('plays a sequence at a time per frame, holding or looping the last one', () => {
      const s = sim3({ frameSequence: [5, 6, 7], frameDuration: 0.1, lifetime: 10 });
      s.emit(1);
      s.emit(1, p => (p.frameLoop = true));
      const frames = () => {
        const result: number[] = [];
        s.forEachParticle(p => result.push(p.frame));
        return result;
      };
      expect(frames()).toEqual([5, 5]);
      s.step(0.1);
      expect(frames()).toEqual([6, 6]);
      s.step(0.1);
      s.step(0.1);
      expect(frames()).toEqual([7, 5]);
    });

    it('spreads a sequence over the lifetime without a frame duration', () => {
      const s = sim3({ frameSequence: [0, 1], lifetime: 1 });
      s.emit(1);
      s.step(0.4);
      s.forEachParticle(p => expect(p.frame).toBe(0));
      s.step(0.2);
      s.forEachParticle(p => expect(p.frame).toBe(1));
    });

    it('writes the frame region, tint, opacity curve, size curve and shader data', () => {
      const s = sim3({
        frames: ParticleFrames.grid(2, 1),
        lifetime: 1,
        opacityOverLife: [1, 0],
        sizeOverLife: { x: [1, 3], y: 2 },
      });
      s.emit(1, p => {
        p.frame = 1;
        p.tint = 0xff8000;
        p.size = { x: 2, y: 1 };
        p.shaderData[2] = 7;
      });
      s.step(0.5);
      const b = s.writeRenderBuffers();
      expect(Array.from(b.uv.subarray(0, 4))).toEqual([0.5, 0, 0.5, 1]);
      expect(b.color[0]).toBe(1);
      expect(b.color[1]).toBeCloseTo(128 / 255);
      expect(b.color[2]).toBe(0);
      expect(b.color[3]).toBeCloseTo(0.5);
      expect(b.size[0]).toBeCloseTo(4);
      expect(b.size[1]).toBeCloseTo(2);
      expect(b.extra[2]).toBe(7);
    });
  });

  describe('fixed time step', () => {
    it('runs whole steps, carries the rest over and caps steps per tick', () => {
      const s = sim3({ fixedTimeStep: 1 / 30, maxStepsPerTick: 3 });
      const step = jest.spyOn(s, 'step');
      expect(s.advance(1 / 60)).toBe(0);
      expect(s.advance(1 / 60)).toBe(1);
      expect(step).toHaveBeenLastCalledWith(1 / 30);
      expect(s.advance(1)).toBe(3);
      expect(s.advance(1 / 60)).toBe(0);
    });

    it('interpolates drawn positions between the last two steps unless told not to', () => {
      const make = (interpolate?: boolean) => {
        const s = sim3({ fixedTimeStep: 0.1, interpolate });
        s.emit(1, p => (p.velocity = { x: 1, y: 0, z: 0 }));
        s.advance(0.1);
        s.advance(0.05);
        return s;
      };
      const smooth = make();
      expect(smooth.interpolationAlpha).toBeCloseTo(0.5);
      expect(positions(smooth)[0].x).toBeCloseTo(0.05);
      const stepped = make(false);
      expect(positions(stepped)[0].x).toBeCloseTo(0.1);
    });

    it('gives the same result at 30, 60 and 144 FPS', () => {
      const run = (fps: number) => {
        const s = sim3(
          {
            fixedTimeStep: 1 / 30,
            interpolate: false,
            gravity: { x: 0, y: 0, z: 1 },
            drag: 0.5,
            lifetime: 3,
            onStep: (dt, sim) => sim.emit(1, p => (p.velocity = { x: 1, y: 0, z: 0 })),
          },
          256,
        );
        // 1 second of world time, as ticks of 1/fps
        for (let i = 0; i < fps; i++) {
          s.advance(1 / fps);
        }
        return positions(s);
      };
      const at30 = run(30);
      expect(at30.length).toBe(30);
      for (const other of [run(60), run(144)]) {
        expect(other.length).toBe(at30.length);
        other.forEach((p, i) => {
          expect(p.x).toBeCloseTo(at30[i].x, 5);
          expect(p.z).toBeCloseTo(at30[i].z, 5);
        });
      }
    });

    it('scales time with timeScale', () => {
      const s = sim3({ lifetime: 1 });
      s.timeScale = 0.5;
      s.emit(1);
      s.advance(1.5);
      expect(s.count).toBe(1);
      s.advance(0.5);
      expect(s.count).toBe(0);
    });
  });

  it('restart re-arms bursts and can clear', () => {
    const s = sim3({ lifetime: 100, bursts: [{ time: 0, count: 2 }] });
    s.step(0.1);
    expect(s.count).toBe(2);
    s.step(0.1);
    expect(s.count).toBe(2);
    s.restart(true);
    expect(s.count).toBe(0);
    s.step(0.1);
    expect(s.count).toBe(2);
  });
});

describe('sortParticlesBackToFront', () => {
  it('orders particles from the farthest to the nearest along the view direction', () => {
    const s = sim3({}, 4);
    for (const x of [5, 20, 1, 20]) {
      s.emit(1, p => (p.position = { x, y: 0, z: 0 }));
    }
    const b = s.writeRenderBuffers();
    const indices = new Uint32Array(4);
    sortParticlesBackToFront(b, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, indices, new Float32Array(4));
    expect(Array.from(indices)).toEqual([1, 3, 0, 2]);
  });
});
