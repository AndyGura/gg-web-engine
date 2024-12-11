import {
  ggElastic,
  GgWorld,
  IEntity,
  MouseInput,
  MouseInputOptions,
  MouseInputState,
  MutableSpherical,
  Pnt2,
  Pnt3,
  Point2,
  Point3,
  Qtrn,
  Spherical,
  TickOrder,
} from '../../../../base';
import { BehaviorSubject, filter, Subject, takeUntil } from 'rxjs';
import { map } from 'rxjs/operators';
import { Renderer3dEntity } from '../../renderer-3d.entity';

export type OrbitCameraControllerOptions = {
  /**
   * Options for configuring mouse input.
   */
  mouseOptions: Partial<MouseInputOptions>;
  /**
   * Orbiting options. false disables orbiting, sensitivity fields are the speed in radians per 1000px mouse movement. 1 by default
   */
  orbiting: { sensitivityX: number; sensitivityY: number } | false;
  /**
   * An elasticity factor for orbiting. 0 by default (no elastic motion)
   */
  orbitingElasticity: number;
  /**
   * Zooming options. false disables zooming. Enabled by default
   */
  zooming: { sensitivity: number } | false;
  /**
   * Panning options. false disables panning. Enabled by default
   */
  panning: { sensitivityX: number; sensitivityY: number } | false;
  /**
   * Dollying options. false disables dollying. Enabled by default
   */
  dollying: { sensitivity: number } | false;
};

const DEFAULT_OPTIONS: OrbitCameraControllerOptions = {
  mouseOptions: {},
  orbiting: { sensitivityX: 1, sensitivityY: 1 },
  orbitingElasticity: 0,
  zooming: { sensitivity: 1 },
  panning: { sensitivityX: 1, sensitivityY: 1 },
  dollying: { sensitivity: 1 },
};

export class OrbitCameraController extends IEntity {
  public readonly tickOrder = TickOrder.INPUT_CONTROLLERS;

  protected readonly options: OrbitCameraControllerOptions;
  public readonly mouseInput: MouseInput;

  protected spherical: MutableSpherical = { phi: 0, radius: 10, theta: 0 };

  public target: Point3 = Pnt3.O;

  get active(): boolean {
    return super.active;
  }

  set active(value: boolean) {
    if (!super.active && value) {
      this.reset();
    }
    super.active = value;
  }

  public get radius(): number {
    return this.spherical.radius;
  }

  public set radius(value: number) {
    this.spherical.radius = value;
  }

  public get phi(): number {
    return this.spherical.phi;
  }

  public set phi(value: number) {
    this.spherical.phi = Math.max(0.000001, Math.min(Math.PI - 0.000001, value));
  }

  public get theta(): number {
    return this.spherical.theta;
  }

  public set theta(value: number) {
    this.spherical.theta = value;
  }

  protected resetMotion$: Subject<void> = new Subject<void>();

  constructor(
    protected readonly camera: Renderer3dEntity,
    options: Partial<OrbitCameraControllerOptions> = {},
  ) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.mouseInput = new MouseInput(this.options.mouseOptions);
  }

  public reset(): void {
    let targetDistance = Pnt3.dist(this.target, this.camera.position);
    this.target = Pnt3.add(this.camera.position, Pnt3.rot({ x: 0, y: 0, z: -targetDistance }, this.camera.rotation));
    this.spherical = Pnt3.toSpherical(Pnt3.sub(this.camera.position, this.target));
    this.resetMotion$.next();
  }

  async onSpawned(world: GgWorld<any, any>): Promise<void> {
    await super.onSpawned(world);
    this.spherical = Pnt3.toSpherical(Pnt3.sub(this.camera.position, this.target));
    if (this.options.orbiting) {
      let mouseDelta$ = this.mouseInput.delta$.pipe(
        takeUntil(this._onRemoved$),
        filter(() => this.active && this.mouseInput.state == MouseInputState.DRAG),
      );
      if (this.options.orbitingElasticity > 0) {
        const s$: BehaviorSubject<Spherical> = new BehaviorSubject(this.spherical);
        mouseDelta$.subscribe(delta => {
          const s = s$.getValue();
          s$.next({
            phi: Math.max(
              0.000001,
              Math.min(Math.PI - 0.000001, s.phi - (delta.y * (this.options.orbiting as any).sensitivityY) / 1000),
            ),
            theta: s.theta - (delta.x * (this.options.orbiting as any).sensitivityX) / 1000,
            radius: 1,
          });
        });
        const startElasticMotion = () => {
          s$.pipe(
            takeUntil(this._onRemoved$),
            ggElastic(
              this.tick$,
              this.options.orbitingElasticity,
              (a, b, f) => ({ phi: a.phi + f * (b.phi - a.phi), theta: a.theta + f * (b.theta - a.theta), radius: 1 }),
              (a, b) => Pnt2.dist({ x: a.phi, y: a.theta }, { x: b.phi, y: b.theta }) < 0.0001,
            ),
            takeUntil(this.resetMotion$),
          ).subscribe(s => {
            this.spherical.theta = s.theta;
            this.spherical.phi = s.phi;
          });
        };
        this.resetMotion$.pipe(takeUntil(this._onRemoved$)).subscribe(() => {
          s$.next(this.spherical);
          startElasticMotion();
        });
        startElasticMotion();
      } else {
        mouseDelta$.subscribe(delta => {
          this.spherical.theta -= (delta.x * (this.options.orbiting as any).sensitivityX) / 1000;
          this.spherical.phi -= (delta.y * (this.options.orbiting as any).sensitivityY) / 1000;
          this.spherical.phi = Math.max(0.000001, Math.min(Math.PI - 0.000001, this.spherical.phi));
        });
      }
    }
    if (this.options.zooming) {
      this.mouseInput.wheel$.pipe(takeUntil(this._onRemoved$)).subscribe(delta => {
        if (delta != 0) {
          this.spherical.radius *= Math.pow(0.95, (this.options.zooming as any).sensitivity * (delta > 0 ? -1 : 1));
        }
      });
    }

    const performPan = (delta: Point2) => {
      const targetCameraVector = Pnt3.fromSpherical(this.spherical);
      const viewUp = Pnt3.rotAround(
        targetCameraVector,
        {
          x: -Math.sin(this.spherical.theta),
          y: Math.cos(this.spherical.theta),
          z: 0,
        },
        Math.PI / 2,
      );
      const viewRight = Pnt3.rotAround(targetCameraVector, Pnt3.norm(viewUp), Math.PI / 2);
      this.target = Pnt3.add(
        this.target,
        Pnt3.add(
          Pnt3.scalarMult(viewUp, (-(this.options.panning as any).sensitivityY * delta.y) / 1000),
          Pnt3.scalarMult(viewRight, ((this.options.panning as any).sensitivityX * delta.x) / 1000),
        ),
      );
    };
    if (this.options.panning) {
      this.mouseInput.delta$
        .pipe(
          takeUntil(this._onRemoved$),
          filter(() => this.mouseInput.state == MouseInputState.DRAG_RIGHT_BUTTON),
        )
        .subscribe(delta => {
          performPan(delta);
        });
    }
    if (this.options.dollying) {
      this.mouseInput.delta$
        .pipe(
          takeUntil(this._onRemoved$),
          filter(() => this.mouseInput.state == MouseInputState.DRAG_MIDDLE_BUTTON),
        )
        .subscribe(delta => {
          this.spherical.radius *= Math.pow(0.95, (-(this.options.dollying as any).sensitivity * delta.y) / 10);
        });
    }
    if (MouseInput.isTouchDevice() && (this.options.dollying || this.options.panning)) {
      this.mouseInput.twoTouchGestureDelta$.pipe(takeUntil(this._onRemoved$)).subscribe(delta => {
        // dolly on fingers pitch
        if (this.options.dollying) {
          this.spherical.radius *= Math.pow(
            0.95,
            ((this.options.dollying as any).sensitivity * delta.distanceDelta) / 10,
          );
        }
        // pan on fingers move
        if (this.options.panning) {
          performPan(delta.centerPointDelta);
        }
      });
    }

    // Setup updating camera position and rotation based on input
    this.camera.tick$
      .pipe(
        takeUntil(this._onRemoved$),
        filter(() => this.active),
        map(() => this.spherical),
      )
      .subscribe(spherical => {
        this.camera.position = Pnt3.add(this.target, Pnt3.fromSpherical(spherical));
        this.camera.rotation = Qtrn.lookAt(this.camera.position, this.target);
      });

    // start input
    await this.mouseInput.start();
  }

  async onRemoved(): Promise<void> {
    await super.onRemoved();
    await this.mouseInput.stop(true);
  }
}
