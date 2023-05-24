import { GgEntity, GGTickOrder } from '../../../../base/entities/gg-entity';
import { MouseInput, MouseInputOptions, MouseInputState } from '../../../../base/inputs/mouse.input';
import { Gg3dCameraEntity } from '../../gg-3d-camera.entity';
import { GgWorld } from '../../../../base/gg-world';
import { filter, takeUntil } from 'rxjs';
import { MutableSpherical, Point2, Point3 } from '../../../../base/models/points';
import { Qtrn } from '../../../../base/math/quaternion';
import { Pnt3 } from '../../../../base/math/point3';
import { map } from 'rxjs/operators';

export type OrbitCameraControllerOptions = {
  mouseOptions: Partial<MouseInputOptions>;
  orbiting: { sensitivityX: number; sensitivityY: number } | false;
  zooming: { sensitivity: number } | false;
  panning: { sensitivityX: number; sensitivityY: number } | false;
  dollying: { sensitivity: number } | false;
};

const DEFAULT_OPTIONS: OrbitCameraControllerOptions = {
  mouseOptions: {},
  orbiting: { sensitivityX: 1, sensitivityY: 1 }, // sensitivity units: rotation degree per 5 pixels movement
  zooming: { sensitivity: 1 },
  panning: { sensitivityX: 1, sensitivityY: 1 },
  dollying: { sensitivity: 1 },
};

export class OrbitCameraController extends GgEntity {
  public readonly tickOrder = GGTickOrder.INPUT_CONTROLLERS;

  protected readonly options: OrbitCameraControllerOptions;
  protected readonly mouseInput: MouseInput;

  protected spherical: MutableSpherical = { phi: 0, radius: 10, theta: 0 };

  public target: Point3 = Pnt3.O;
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

  constructor(protected readonly camera: Gg3dCameraEntity, options: Partial<OrbitCameraControllerOptions> = {}) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.mouseInput = new MouseInput(this.options.mouseOptions);
  }

  async onSpawned(world: GgWorld<any, any>): Promise<void> {
    await super.onSpawned(world);
    this.spherical = Pnt3.toSpherical(Pnt3.sub(this.camera.position, this.target));
    if (this.options.orbiting) {
      this.mouseInput.delta$
        .pipe(
          takeUntil(this._onRemoved$),
          filter(() => this.mouseInput.state == MouseInputState.DRAG),
        )
        .subscribe(delta => {
          this.spherical.theta -= (delta.x * (this.options.orbiting as any).sensitivityX * Math.PI) / 900;
          this.spherical.phi -= (delta.y * (this.options.orbiting as any).sensitivityY * Math.PI) / 900;
          this.spherical.phi = Math.max(0.000001, Math.min(Math.PI - 0.000001, this.spherical.phi));
        });
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
