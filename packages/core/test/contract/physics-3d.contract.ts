// Shared contract suite for 3D physics adapters. Each adapter runs it from its own test folder:
//
//   import { describePhysics3dContract } from '../../core/test/contract/physics-3d.contract';
//   describePhysics3dContract('Rapier', () => new Rapier3dWorldComponent());
//
// It checks that the same calls succeed, the same events fire and units and axes match (Z-up,
// meters, seconds, kilograms). It never checks that two backends produce the same trajectory:
// friction, restitution, sleeping and solver details are backend-specific by design. Tolerances
// are therefore loose, and every assertion is about the API contract, not simulation quality.
import {
  BodyShape3DDescriptor,
  ICharacterController3dComponent,
  IPhysicsWorld3dComponent,
  IRigidBody3dComponent,
  Point3,
  Qtrn,
  Shape3DDescriptor,
} from '@gg-web-engine/core';

export type Physics3dContractOptions = {
  /**
   * Shapes the backend cannot build. The suite checks that asking for one fails with an error at
   * creation time, instead of returning a body that silently has no collider. Keep this in sync
   * with the README FAQ's list of known differences.
   */
  unsupportedShapes?: Shape3DDescriptor['shape'][];
};

const STEP_MS = 1000 / 60;

export function describePhysics3dContract(
  backend: string,
  createWorld: () => IPhysicsWorld3dComponent,
  options: Physics3dContractOptions = {},
): void {
  const unsupported = new Set(options.unsupportedShapes ?? []);

  describe(`3D physics contract: ${backend}`, () => {
    let world: IPhysicsWorld3dComponent;
    // bodies only need `world.physicsWorld` from the GgWorld they are added to
    let ggWorld: any;

    const simulate = (seconds: number) => {
      for (let i = 0; i < Math.round(seconds * 60); i++) world.simulate(STEP_MS);
    };
    const add = <T extends { addToWorld(w: any): void }>(body: T): T => {
      body.addToWorld(ggWorld);
      return body;
    };
    const ball = (position: Point3, mass = 1, radius = 0.5): IRigidBody3dComponent =>
      add(
        world.factory.createRigidBody(
          { shape: { shape: 'SPHERE', radius }, body: { bodyType: 'dynamic', mass, canSleep: false } },
          { position },
        ),
      );
    const staticBox = (position: Point3, dimensions: Point3): IRigidBody3dComponent =>
      add(
        world.factory.createRigidBody(
          { shape: { shape: 'BOX', dimensions }, body: { bodyType: 'static', mass: 0 } },
          { position },
        ),
      );

    beforeEach(async () => {
      world = createWorld();
      await world.init();
      ggWorld = { physicsWorld: world };
    });

    afterEach(() => {
      world.dispose();
    });

    describe('world', () => {
      it('names its backend', () => {
        expect(typeof world.backendName).toBe('string');
        expect(world.backendName.length).toBeGreaterThan(0);
      });

      it('pulls along -Z by default (Z-up), at about 9.8 m/s²', () => {
        expect(world.gravity.x).toBeCloseTo(0);
        expect(world.gravity.y).toBeCloseTo(0);
        expect(world.gravity.z).toBeLessThan(-9.7);
        expect(world.gravity.z).toBeGreaterThan(-9.9);
      });

      it('reads gravity back as set', () => {
        world.gravity = { x: 1, y: -2, z: -3 };
        expect(world.gravity.x).toBeCloseTo(1);
        expect(world.gravity.y).toBeCloseTo(-2);
        expect(world.gravity.z).toBeCloseTo(-3);
      });

      it('takes simulate() delta in milliseconds: a body falls about g·t²/2 meters in one second', () => {
        const body = ball({ x: 0, y: 0, z: 100 });
        simulate(1);
        // free fall from rest under 9.82 m/s² for 1 s is 4.91 m; accept integrator differences
        expect(100 - body.position.z).toBeGreaterThan(4);
        expect(100 - body.position.z).toBeLessThan(6);
        expect(body.position.x).toBeCloseTo(0, 3);
        expect(body.position.y).toBeCloseTo(0, 3);
      });

      it('tracks children and emits added$/removed$', () => {
        const added: unknown[] = [];
        const removed: unknown[] = [];
        world.added$.subscribe(b => added.push(b));
        world.removed$.subscribe(b => removed.push(b));
        const body = ball({ x: 0, y: 0, z: 0 });
        expect(world.children).toContain(body);
        expect(added).toContain(body);
        body.removeFromWorld(ggWorld, true);
        expect(world.children).not.toContain(body);
        expect(removed).toContain(body);
      });

      it('registers distinct collision groups, other than the main one', () => {
        const a = world.registerCollisionGroup();
        const b = world.registerCollisionGroup();
        expect(a).not.toBe(b);
        expect(a).not.toBe(world.mainCollisionGroup);
        expect(b).not.toBe(world.mainCollisionGroup);
        world.deregisterCollisionGroup(a);
        world.deregisterCollisionGroup(b);
      });
    });

    describe('rigid bodies', () => {
      const shapes: Shape3DDescriptor[] = [
        { shape: 'BOX', dimensions: { x: 1, y: 2, z: 3 } },
        { shape: 'SPHERE', radius: 0.5 },
        { shape: 'CAPSULE', radius: 0.5, centersDistance: 1 },
        { shape: 'CYLINDER', radius: 0.5, height: 2 },
        { shape: 'CONE', radius: 0.5, height: 2 },
        {
          shape: 'CONVEX_HULL',
          vertices: [
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 0, z: 0 },
            { x: 0, y: 1, z: 0 },
            { x: 0, y: 0, z: 1 },
          ],
        },
        {
          shape: 'COMPOUND',
          children: [
            { position: { x: -1, y: 0, z: 0 }, shape: { shape: 'SPHERE', radius: 0.5 } },
            { position: { x: 1, y: 0, z: 0 }, shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } } },
          ],
        },
      ];
      for (const shape of shapes) {
        const descriptor: BodyShape3DDescriptor = { shape, body: { bodyType: 'dynamic', mass: 1 } };
        if (unsupported.has(shape.shape)) {
          it(`refuses a ${shape.shape} body with an error`, () => {
            expect(() => world.factory.createRigidBody(descriptor)).toThrow();
          });
        } else {
          it(`builds a dynamic ${shape.shape} body that falls under gravity`, () => {
            const body = add(world.factory.createRigidBody(descriptor, { position: { x: 0, y: 0, z: 10 } }));
            simulate(0.5);
            expect(body.position.z).toBeLessThan(10);
          });
        }
      }

      const statics: Shape3DDescriptor[] = [
        { shape: 'PLANE' },
        {
          shape: 'MESH',
          vertices: [
            { x: -5, y: -5, z: 0 },
            { x: 5, y: -5, z: 0 },
            { x: 5, y: 5, z: 0 },
            { x: -5, y: 5, z: 0 },
          ],
          faces: [
            [0, 1, 2],
            [0, 2, 3],
          ],
        },
      ];
      for (const shape of statics) {
        const descriptor: BodyShape3DDescriptor = { shape, body: { bodyType: 'static', mass: 0 } };
        if (unsupported.has(shape.shape)) {
          it(`refuses a static ${shape.shape} body with an error`, () => {
            expect(() => world.factory.createRigidBody(descriptor)).toThrow();
          });
        } else {
          it(`builds a static ${shape.shape} ground (facing +Z) that stops a falling body`, () => {
            add(world.factory.createRigidBody(descriptor));
            const body = ball({ x: 0, y: 0, z: 3 });
            simulate(3);
            expect(body.position.z).toBeGreaterThan(0.2);
            expect(body.position.z).toBeLessThan(1);
          });
        }
      }

      it('reports the transform it was created with', () => {
        const rotation = Qtrn.fromEuler({ x: 0, y: 0, z: Math.PI / 2 });
        const body = world.factory.createRigidBody(
          { shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } }, body: { bodyType: 'dynamic', mass: 1 } },
          { position: { x: 1, y: 2, z: 3 }, rotation },
        );
        add(body);
        expect(body.position).toEqual({ x: expect.closeTo(1), y: expect.closeTo(2), z: expect.closeTo(3) });
        // q and -q are the same rotation
        const sign = Math.sign(body.rotation.w) === Math.sign(rotation.w) ? 1 : -1;
        expect(body.rotation.x * sign).toBeCloseTo(rotation.x);
        expect(body.rotation.y * sign).toBeCloseTo(rotation.y);
        expect(body.rotation.z * sign).toBeCloseTo(rotation.z);
        expect(body.rotation.w * sign).toBeCloseTo(rotation.w);
      });

      it('moves a teleported body to the new position', () => {
        const body = ball({ x: 0, y: 0, z: 0 });
        body.position = { x: 5, y: -4, z: 3 };
        expect(body.position).toEqual({ x: expect.closeTo(5), y: expect.closeTo(-4), z: expect.closeTo(3) });
      });

      it('moves linearVelocity meters per second', () => {
        world.gravity = { x: 0, y: 0, z: 0 };
        const body = ball({ x: 0, y: 0, z: 0 });
        body.linearVelocity = { x: 2, y: 0, z: 0 };
        expect(body.linearVelocity.x).toBeCloseTo(2);
        simulate(1);
        expect(body.position.x).toBeGreaterThan(1.8);
        expect(body.position.x).toBeLessThan(2.2);
      });

      it('changes velocity by impulse / mass (N·s and kg)', () => {
        world.gravity = { x: 0, y: 0, z: 0 };
        const body = ball({ x: 0, y: 0, z: 0 }, 4);
        body.applyImpulse({ x: 8, y: 0, z: 0 });
        simulate(1 / 60);
        expect(body.linearVelocity.x).toBeGreaterThan(1.8);
        expect(body.linearVelocity.x).toBeLessThan(2.2);
      });

      it('accelerates by force / mass while the force is applied every step (N and kg)', () => {
        world.gravity = { x: 0, y: 0, z: 0 };
        const body = ball({ x: 0, y: 0, z: 0 }, 2);
        for (let i = 0; i < 60; i++) {
          body.applyForce({ x: 4, y: 0, z: 0 });
          world.simulate(STEP_MS);
        }
        // 4 N on 2 kg for 1 s
        expect(body.linearVelocity.x).toBeGreaterThan(1.8);
        expect(body.linearVelocity.x).toBeLessThan(2.2);
      });

      it('spins around +Z for a positive Z torque impulse (right-handed)', () => {
        world.gravity = { x: 0, y: 0, z: 0 };
        const body = ball({ x: 0, y: 0, z: 0 });
        body.applyTorqueImpulse({ x: 0, y: 0, z: 1 });
        simulate(1 / 60);
        expect(body.angularVelocity.z).toBeGreaterThan(0);
        expect(Math.abs(body.angularVelocity.x)).toBeLessThan(1e-3);
        expect(Math.abs(body.angularVelocity.y)).toBeLessThan(1e-3);
      });

      it('stops moving after resetMotion()', () => {
        world.gravity = { x: 0, y: 0, z: 0 };
        const body = ball({ x: 0, y: 0, z: 0 });
        body.linearVelocity = { x: 3, y: 0, z: 0 };
        body.angularVelocity = { x: 0, y: 0, z: 3 };
        body.resetMotion();
        expect(body.linearVelocity.x).toBeCloseTo(0);
        expect(body.angularVelocity.z).toBeCloseTo(0);
      });

      it('sleeps on sleep() and wakes on wakeUp()', () => {
        world.gravity = { x: 0, y: 0, z: 0 };
        const body = add(
          world.factory.createRigidBody({
            shape: { shape: 'SPHERE', radius: 0.5 },
            body: { bodyType: 'dynamic', mass: 1 },
          }),
        );
        body.sleep();
        expect(body.isSleeping).toBe(true);
        body.wakeUp();
        expect(body.isSleeping).toBe(false);
      });

      it('clones into an independent body with the same options', () => {
        const body = world.factory.createRigidBody(
          { shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } }, body: { bodyType: 'dynamic', mass: 3 } },
          { position: { x: 1, y: 2, z: 3 } },
        );
        const copy = body.clone();
        expect(copy).not.toBe(body);
        expect(copy.bodyOptions.mass).toBeCloseTo(3);
        expect(copy.bodyOptions.bodyType).toBe('dynamic');
        add(body);
        add(copy);
        copy.position = { x: 10, y: 0, z: 0 };
        expect(body.position.x).toBeCloseTo(1);
      });

      it('fires onCollisionStart on both bodies when they touch', () => {
        world.gravity = { x: 0, y: 0, z: 0 };
        const a = ball({ x: -2, y: 0, z: 0 });
        const b = ball({ x: 2, y: 0, z: 0 });
        const hitsA: unknown[] = [];
        const hitsB: unknown[] = [];
        a.onCollisionStart.subscribe(e => hitsA.push(e.otherBody));
        b.onCollisionStart.subscribe(e => hitsB.push(e.otherBody));
        a.linearVelocity = { x: 2, y: 0, z: 0 };
        b.linearVelocity = { x: -2, y: 0, z: 0 };
        simulate(2);
        expect(hitsA).toContain(b);
        expect(hitsB).toContain(a);
      });

      it('lets bodies in groups that do not interact pass through each other', () => {
        world.gravity = { x: 0, y: 0, z: 0 };
        const g0 = world.registerCollisionGroup();
        const g1 = world.registerCollisionGroup();
        const a = ball({ x: -2, y: 0, z: 0 });
        const b = ball({ x: 2, y: 0, z: 0 });
        a.ownCollisionGroups = a.interactWithCollisionGroups = [g0];
        b.ownCollisionGroups = b.interactWithCollisionGroups = [g1];
        a.linearVelocity = { x: 2, y: 0, z: 0 };
        b.linearVelocity = { x: -2, y: 0, z: 0 };
        simulate(2);
        expect(a.position.x).toBeGreaterThan(1);
        expect(b.position.x).toBeLessThan(-1);
      });
    });

    describe('triggers', () => {
      it('fires onEntityEntered and onEntityLeft as a body passes through', () => {
        world.gravity = { x: 0, y: 0, z: 0 };
        const trigger = add(
          world.factory.createTrigger(
            { shape: 'BOX', dimensions: { x: 2, y: 2, z: 2 } },
            { position: { x: 0, y: 0, z: 0 } },
          ),
        );
        const entered: unknown[] = [];
        let left = 0;
        trigger.onEntityEntered.subscribe(b => entered.push(b));
        trigger.onEntityLeft.subscribe(() => left++);
        const body = ball({ x: -4, y: 0, z: 0 });
        body.linearVelocity = { x: 4, y: 0, z: 0 };
        // Trigger3dEntity polls checkOverlaps() once per tick; some backends report only from it
        for (let i = 0; i < 150; i++) {
          world.simulate(STEP_MS);
          trigger.checkOverlaps();
        }
        expect(entered).toContain(body);
        expect(left).toBeGreaterThan(0);
        // a trigger never pushes what passes through it
        expect(body.position.x).toBeGreaterThan(4);
      });
    });

    describe('raycast', () => {
      it('hits the near face of a body, with distance in meters and the normal facing the ray', () => {
        const box = staticBox({ x: 0, y: 0, z: -5 }, { x: 2, y: 2, z: 2 });
        simulate(1 / 60);
        const result = world.raycast({ from: { x: 0, y: 0, z: 0 }, to: { x: 0, y: 0, z: -10 } });
        expect(result.hasHit).toBe(true);
        expect(result.hitBody).toBe(box);
        expect(result.hitPoint!.z).toBeCloseTo(-4, 1);
        expect(result.hitDistance).toBeCloseTo(4, 1);
        expect(result.hitNormal!.z).toBeGreaterThan(0.9);
      });

      it('reports no hit when nothing is on the ray', () => {
        staticBox({ x: 10, y: 0, z: -5 }, { x: 2, y: 2, z: 2 });
        simulate(1 / 60);
        const result = world.raycast({ from: { x: 0, y: 0, z: 0 }, to: { x: 0, y: 0, z: -10 } });
        expect(result.hasHit).toBe(false);
      });
    });

    describe('character controller', () => {
      let character: ICharacterController3dComponent;

      beforeEach(() => {
        staticBox({ x: 0, y: 0, z: -0.5 }, { x: 40, y: 40, z: 1 });
        character = add(
          world.factory.createCharacterController(
            { radius: 0.3, centersDistance: 1 },
            { position: { x: 0, y: 0, z: 2 } },
          ),
        );
        simulate(1 / 60);
      });

      it('reports its size and +Z as up', () => {
        expect(character.radius).toBeCloseTo(0.3);
        expect(character.centersDistance).toBeCloseTo(1);
        expect(character.up).toEqual({ x: expect.closeTo(0), y: expect.closeTo(0), z: expect.closeTo(1) });
      });

      it('lands on the ground and reports isGrounded with a +Z ground normal', () => {
        for (let i = 0; i < 60; i++) {
          character.move({ x: 0, y: 0, z: -0.1 }, STEP_MS / 1000);
          world.simulate(STEP_MS);
        }
        expect(character.isGrounded).toBe(true);
        expect(character.groundNormal!.z).toBeGreaterThan(0.9);
        // capsule bottom (centre - centersDistance/2 - radius) rests near z = 0
        expect(character.position.z).toBeGreaterThan(0.6);
        expect(character.position.z).toBeLessThan(1.2);
      });

      it('moves by the requested translation on open ground', () => {
        for (let i = 0; i < 30; i++) {
          character.move({ x: 0, y: 0, z: -0.1 }, STEP_MS / 1000);
          world.simulate(STEP_MS);
        }
        const start = character.position;
        for (let i = 0; i < 30; i++) {
          character.move({ x: 0.05, y: 0, z: 0 }, STEP_MS / 1000);
          world.simulate(STEP_MS);
        }
        expect(character.position.x - start.x).toBeGreaterThan(1.3);
        expect(character.position.x - start.x).toBeLessThan(1.7);
        expect(Math.abs(character.position.y - start.y)).toBeLessThan(0.05);
      });

      it('does not walk through a wall', () => {
        staticBox({ x: 2, y: 0, z: 1 }, { x: 0.5, y: 10, z: 2 });
        for (let i = 0; i < 120; i++) {
          character.move({ x: 0.05, y: 0, z: -0.05 }, STEP_MS / 1000);
          world.simulate(STEP_MS);
        }
        // wall's near face is at x = 1.75; the capsule's centre stays a radius away from it
        expect(character.position.x).toBeLessThan(1.75);
      });
    });
  });
}
