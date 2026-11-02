// Shared contract suite for 2D physics adapters. Each adapter runs it from its own test folder:
//
//   import { describePhysics2dContract } from '../../../core/test/contract/physics-2d.contract';
//   describePhysics2dContract('matter', () => new MatterWorldComponent());
//
// It checks that the same calls succeed, the same events fire and units and axes match: 2D worlds
// are screen-space, +Y points down, and every quantity is in meters, kg and seconds, exactly as in 3D.
// It never checks that two backends produce the same trajectory: damping, friction, sleeping and
// solver details are backend-specific by design (matter-js, for one, damps every body's velocity a
// little each step). So unit checks look at one short window, and tolerances are loose.
import {
  BodyShape2DDescriptor,
  ICharacterController2dComponent,
  IPhysicsWorld2dComponent,
  IRigidBody2dComponent,
  Point2,
  Shape2DDescriptor,
} from '@gg-web-engine/core';

export type Physics2dContractOptions = {
  /** Shapes the backend cannot build; asking for one must fail with an error at creation time. */
  unsupportedShapes?: Shape2DDescriptor['shape'][];
};

const STEP_MS = 1000 / 60;

export function describePhysics2dContract(
  backend: string,
  createWorld: () => IPhysicsWorld2dComponent,
  options: Physics2dContractOptions = {},
): void {
  const unsupported = new Set(options.unsupportedShapes ?? []);

  describe(`2D physics contract: ${backend}`, () => {
    let world: IPhysicsWorld2dComponent;
    // bodies only need `world.physicsWorld` from the GgWorld they are added to
    let ggWorld: any;

    const steps = (n: number) => {
      for (let i = 0; i < n; i++) world.simulate(STEP_MS);
    };
    const add = <T extends { addToWorld(w: any): void }>(body: T): T => {
      body.addToWorld(ggWorld);
      return body;
    };
    const circle = (position: Point2, mass = 1, radius = 0.2): IRigidBody2dComponent =>
      add(
        world.factory.createRigidBody(
          { shape: { shape: 'CIRCLE', radius }, body: { bodyType: 'dynamic', mass, canSleep: false } },
          { position },
        ),
      );
    const staticBox = (position: Point2, dimensions: Point2): IRigidBody2dComponent =>
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

      it('pulls along +Y (screen down) by default, at about 9.8 m/s²', () => {
        expect(world.gravity.x).toBeCloseTo(0);
        expect(world.gravity.y).toBeGreaterThan(9.7);
        expect(world.gravity.y).toBeLessThan(9.9);
      });

      it('reads gravity back as set', () => {
        world.gravity = { x: 1, y: -2 };
        expect(world.gravity.x).toBeCloseTo(1);
        expect(world.gravity.y).toBeCloseTo(-2);
      });

      it('takes simulate() delta in milliseconds and lengths in meters: a body falls about g·t²/2', () => {
        const body = circle({ x: 0, y: 0 });
        steps(30);
        // free fall from rest under 9.82 m/s² for 0.5 s is 1.23 m; backends that damp velocity
        // every step land a little short of it
        expect(body.position.y).toBeGreaterThan(0.9);
        expect(body.position.y).toBeLessThan(1.4);
        expect(body.position.x).toBeCloseTo(0, 3);
      });

      it('tracks children and emits added$/removed$', () => {
        const added: unknown[] = [];
        const removed: unknown[] = [];
        world.added$.subscribe(b => added.push(b));
        world.removed$.subscribe(b => removed.push(b));
        const body = circle({ x: 0, y: 0 });
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
      const shapes: Shape2DDescriptor[] = [
        { shape: 'BOX', dimensions: { x: 0.2, y: 0.4 } },
        { shape: 'CIRCLE', radius: 0.2 },
        { shape: 'CAPSULE', radius: 0.1, centersDistance: 0.2 },
        {
          shape: 'CONVEX_HULL',
          vertices: [
            { x: 0, y: 0 },
            { x: 0.3, y: 0 },
            { x: 0, y: 0.3 },
          ],
        },
        {
          shape: 'POLYGON',
          vertices: [
            { x: -0.2, y: -0.2 },
            { x: 0.2, y: -0.2 },
            { x: 0.2, y: 0.2 },
            { x: -0.2, y: 0.2 },
          ],
        },
        {
          shape: 'COMPOUND',
          children: [
            { position: { x: -0.2, y: 0 }, shape: { shape: 'CIRCLE', radius: 0.1 } },
            { position: { x: 0.2, y: 0 }, shape: { shape: 'BOX', dimensions: { x: 0.2, y: 0.2 } } },
          ],
        },
      ];
      for (const shape of shapes) {
        const descriptor: BodyShape2DDescriptor = { shape, body: { bodyType: 'dynamic', mass: 1 } };
        if (unsupported.has(shape.shape)) {
          it(`refuses a ${shape.shape} body with an error`, () => {
            expect(() => world.factory.createRigidBody(descriptor)).toThrow();
          });
        } else {
          it(`builds a dynamic ${shape.shape} body that falls under gravity`, () => {
            const body = add(world.factory.createRigidBody(descriptor, { position: { x: 0, y: 0 } }));
            steps(30);
            expect(body.position.y).toBeGreaterThan(0.1);
          });
        }
      }

      it('stops a falling body on a static box below it', () => {
        staticBox({ x: 0, y: 2 }, { x: 10, y: 0.4 });
        const body = circle({ x: 0, y: 0 });
        steps(180);
        // the box's top is at y = 1.8, the circle's radius is 0.2
        expect(body.position.y).toBeGreaterThan(1.4);
        expect(body.position.y).toBeLessThan(1.7);
      });

      it('reports the transform it was created with', () => {
        const body = add(
          world.factory.createRigidBody(
            { shape: { shape: 'BOX', dimensions: { x: 0.2, y: 0.2 } }, body: { bodyType: 'dynamic', mass: 1 } },
            { position: { x: 1, y: 2 }, rotation: Math.PI / 4 },
          ),
        );
        expect(body.position).toEqual({ x: expect.closeTo(1), y: expect.closeTo(2) });
        expect(body.rotation).toBeCloseTo(Math.PI / 4);
      });

      it('moves a teleported body to the new position', () => {
        const body = circle({ x: 0, y: 0 });
        body.position = { x: 0.5, y: -0.4 };
        expect(body.position).toEqual({ x: expect.closeTo(0.5), y: expect.closeTo(-0.4) });
      });

      it('moves linearVelocity meters per second', () => {
        world.gravity = { x: 0, y: 0 };
        const body = circle({ x: 0, y: 0 });
        body.linearVelocity = { x: 6, y: 0 };
        expect(body.linearVelocity.x).toBeCloseTo(6);
        steps(6);
        // 6 m/s for 0.1 s
        expect(body.position.x).toBeGreaterThan(0.54);
        expect(body.position.x).toBeLessThan(0.66);
      });

      it('changes velocity by impulse / mass (N·s and kg)', () => {
        world.gravity = { x: 0, y: 0 };
        const body = circle({ x: 0, y: 0 }, 4);
        body.applyImpulse({ x: 8, y: 0 });
        steps(1);
        expect(body.linearVelocity.x).toBeGreaterThan(1.8);
        expect(body.linearVelocity.x).toBeLessThan(2.2);
      });

      it('accelerates by force / mass while the force is applied every step (N and kg)', () => {
        world.gravity = { x: 0, y: 0 };
        const body = circle({ x: 0, y: 0 }, 2);
        for (let i = 0; i < 6; i++) {
          body.applyForce({ x: 40, y: 0 });
          world.simulate(STEP_MS);
        }
        // 40 / 2 per second for 0.1 s
        expect(body.linearVelocity.x).toBeGreaterThan(1.7);
        expect(body.linearVelocity.x).toBeLessThan(2.3);
      });

      it('turns clockwise on screen (positive angle) for a positive torque impulse', () => {
        world.gravity = { x: 0, y: 0 };
        const body = circle({ x: 0, y: 0 });
        // 0.1 N·m·s on a 1 kg, 0.2 m disc (inertia 0.02) is 5 rad/s: a readable angle after 0.1 s, under a half turn
        body.applyTorqueImpulse(0.1);
        steps(1);
        expect(body.angularVelocity).toBeGreaterThan(0);
        steps(5);
        expect(body.rotation).toBeGreaterThan(0);
      });

      it('stops moving after resetMotion()', () => {
        world.gravity = { x: 0, y: 0 };
        const body = circle({ x: 0, y: 0 });
        body.linearVelocity = { x: 3, y: 0 };
        body.angularVelocity = 3;
        body.resetMotion();
        expect(body.linearVelocity.x).toBeCloseTo(0);
        expect(body.angularVelocity).toBeCloseTo(0);
      });

      it('sleeps on sleep() and wakes on wakeUp()', () => {
        world.gravity = { x: 0, y: 0 };
        const body = add(
          world.factory.createRigidBody({
            shape: { shape: 'CIRCLE', radius: 0.2 },
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
          { shape: { shape: 'BOX', dimensions: { x: 0.2, y: 0.2 } }, body: { bodyType: 'dynamic', mass: 3 } },
          { position: { x: 1, y: 2 } },
        );
        const copy = body.clone();
        expect(copy).not.toBe(body);
        expect(copy.bodyOptions.mass).toBeCloseTo(3);
        expect(copy.bodyOptions.bodyType).toBe('dynamic');
        add(body);
        add(copy);
        copy.position = { x: 5, y: 0 };
        expect(body.position.x).toBeCloseTo(1);
      });

      it('fires onCollisionStart on both bodies when they touch', () => {
        world.gravity = { x: 0, y: 0 };
        const a = circle({ x: -1, y: 0 });
        const b = circle({ x: 1, y: 0 });
        const hitsA: unknown[] = [];
        const hitsB: unknown[] = [];
        a.onCollisionStart.subscribe(e => hitsA.push(e.otherBody));
        b.onCollisionStart.subscribe(e => hitsB.push(e.otherBody));
        a.linearVelocity = { x: 2, y: 0 };
        b.linearVelocity = { x: -2, y: 0 };
        steps(90);
        expect(hitsA).toContain(b);
        expect(hitsB).toContain(a);
      });

      it('fires onCollisionStart once per body pair, for a compound body landing on several parts', () => {
        const floor = staticBox({ x: 0, y: 0.5 }, { x: 20, y: 1 });
        const body = add(
          world.factory.createRigidBody(
            {
              shape: {
                shape: 'COMPOUND',
                children: [
                  { position: { x: -1, y: 0 }, shape: { shape: 'BOX', dimensions: { x: 1, y: 1 } } },
                  { position: { x: 1, y: 0 }, shape: { shape: 'BOX', dimensions: { x: 1, y: 1 } } },
                ],
              },
              body: { bodyType: 'dynamic', mass: 1, restitution: 0, canSleep: false },
            },
            { position: { x: 0, y: -1 } },
          ),
        );
        const starts: unknown[] = [];
        const ends: unknown[] = [];
        body.onCollisionStart.subscribe(e => starts.push(e.otherBody));
        body.onCollisionEnd.subscribe(other => ends.push(other));
        const floorStarts: unknown[] = [];
        floor.onCollisionStart.subscribe(e => floorStarts.push(e.otherBody));
        const sequence: string[] = [];
        body.onCollisionStart.subscribe(() => sequence.push('start'));
        body.onCollisionEnd.subscribe(() => sequence.push('end'));
        steps(120);
        // resting on both boxes. It may bounce off and land again, but every start is the body
        // pair beginning to touch: never a second start (one per box) before the pair let go
        expect(body.position.y).toBeCloseTo(-0.5, 1);
        expect(sequence.length % 2).toBe(1);
        sequence.forEach((event, i) => expect(event).toBe(i % 2 === 0 ? 'start' : 'end'));
        [...starts, ...ends].forEach(other => expect(other).toBe(floor));
        expect(floorStarts.length).toBe(starts.length);
        floorStarts.forEach(other => expect(other).toBe(body));
      });

      it('lets bodies in groups that do not interact pass through each other', () => {
        world.gravity = { x: 0, y: 0 };
        const g0 = world.registerCollisionGroup();
        const g1 = world.registerCollisionGroup();
        const a = circle({ x: -1, y: 0 });
        const b = circle({ x: 1, y: 0 });
        a.ownCollisionGroups = a.interactWithCollisionGroups = [g0];
        b.ownCollisionGroups = b.interactWithCollisionGroups = [g1];
        a.linearVelocity = { x: 3, y: 0 };
        b.linearVelocity = { x: -3, y: 0 };
        steps(60);
        expect(a.position.x).toBeGreaterThan(0.3);
        expect(b.position.x).toBeLessThan(-0.3);
      });
    });

    describe('triggers', () => {
      it('fires onEntityEntered and onEntityLeft as a body passes through', () => {
        world.gravity = { x: 0, y: 0 };
        const trigger = add(
          world.factory.createTrigger({ shape: 'BOX', dimensions: { x: 1, y: 1 } }, { position: { x: 0, y: 0 } }),
        );
        const entered: unknown[] = [];
        let left = 0;
        trigger.onEntityEntered.subscribe(b => entered.push(b));
        trigger.onEntityLeft.subscribe(() => left++);
        const body = circle({ x: -2, y: 0 });
        body.linearVelocity = { x: 3, y: 0 };
        // Trigger2dEntity polls checkOverlaps() once per tick; some backends report only from it
        for (let i = 0; i < 120; i++) {
          world.simulate(STEP_MS);
          trigger.checkOverlaps();
        }
        expect(entered).toContain(body);
        expect(left).toBeGreaterThan(0);
        // a trigger never pushes what passes through it
        expect(body.position.x).toBeGreaterThan(1);
      });
    });

    describe('raycast', () => {
      it('hits the near face of a body, with distance in meters and the normal facing the ray', () => {
        const box = staticBox({ x: 0, y: 5 }, { x: 2, y: 2 });
        steps(1);
        const result = world.raycast({ from: { x: 0, y: 0 }, to: { x: 0, y: 10 } });
        expect(result.hasHit).toBe(true);
        expect(result.hitBody).toBe(box);
        expect(result.hitPoint!.y).toBeGreaterThan(3.95);
        expect(result.hitPoint!.y).toBeLessThan(4.05);
        expect(result.hitDistance).toBeGreaterThan(3.95);
        expect(result.hitDistance).toBeLessThan(4.05);
        expect(result.hitNormal!.y).toBeLessThan(-0.9);
      });

      it('reports no hit when nothing is on the ray', () => {
        staticBox({ x: 10, y: 5 }, { x: 2, y: 2 });
        steps(1);
        const result = world.raycast({ from: { x: 0, y: 0 }, to: { x: 0, y: 10 } });
        expect(result.hasHit).toBe(false);
      });
    });

    describe('character controller', () => {
      let character: ICharacterController2dComponent;

      beforeEach(() => {
        // ground top at y = 0
        staticBox({ x: 0, y: 0.5 }, { x: 40, y: 1 });
        character = add(
          world.factory.createCharacterController({ radius: 0.15, centersDistance: 0.5 }, { position: { x: 0, y: -1 } }),
        );
        steps(1);
      });

      it('reports its size and -Y (screen up) as up', () => {
        expect(character.radius).toBeCloseTo(0.15);
        expect(character.centersDistance).toBeCloseTo(0.5);
        expect(character.up).toEqual({ x: expect.closeTo(0), y: expect.closeTo(-1) });
      });

      it('lands on the ground and reports isGrounded with a -Y ground normal', () => {
        for (let i = 0; i < 60; i++) {
          character.move({ x: 0, y: 0.05 }, STEP_MS / 1000);
          world.simulate(STEP_MS);
        }
        expect(character.isGrounded).toBe(true);
        expect(character.groundNormal!.y).toBeLessThan(-0.9);
        // capsule bottom (centre + centersDistance/2 + radius) rests near y = 0
        expect(character.position.y).toBeGreaterThan(-0.5);
        expect(character.position.y).toBeLessThan(-0.3);
      });

      it('moves by the requested translation on open ground', () => {
        for (let i = 0; i < 30; i++) {
          character.move({ x: 0, y: 0.05 }, STEP_MS / 1000);
          world.simulate(STEP_MS);
        }
        const start = character.position;
        for (let i = 0; i < 30; i++) {
          character.move({ x: 0.05, y: 0 }, STEP_MS / 1000);
          world.simulate(STEP_MS);
        }
        expect(character.position.x - start.x).toBeGreaterThan(1.3);
        expect(character.position.x - start.x).toBeLessThan(1.7);
        expect(Math.abs(character.position.y - start.y)).toBeLessThan(0.05);
      });

      it('does not walk through a wall', () => {
        staticBox({ x: 2, y: -1 }, { x: 0.5, y: 2 });
        for (let i = 0; i < 120; i++) {
          character.move({ x: 0.05, y: 0.03 }, STEP_MS / 1000);
          world.simulate(STEP_MS);
        }
        // wall's near face is at x = 1.75; the capsule's centre stays a radius away from it
        expect(character.position.x).toBeLessThan(1.75);
      });
    });
  });
}
