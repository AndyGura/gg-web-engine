import { GgEntity } from '../../../base/entities/gg-entity';
import { ITickListener } from '../../../base/entities/interfaces/i-tick-listener';
import { Subject, takeUntil } from 'rxjs';
import { Gg3dWorld } from '../../gg-3d-world';
import { GgPositionable3dEntity } from '../gg-positionable-3d-entity';
import { Pnt3 } from '../../../base/math/point3';
import { averageAngle } from '../../../base/math/numbers';
import { Qtrn } from '../../../base/math/quaternion';

export class CameraFollowEntityController extends GgEntity implements ITickListener {
  public readonly tick$: Subject<[number, number]> = new Subject<[number, number]>();

  protected readonly removed$: Subject<void> = new Subject<void>();
  public readonly tickOrder: number = 750;

  constructor(
    // TODO probably can change those
    protected readonly camera: GgPositionable3dEntity,
    protected readonly entityToFollow: GgPositionable3dEntity,
  ) {
    super();
  }

  onSpawned(world: Gg3dWorld) {
    // TODO refactor, parametrize
    super.onSpawned(world);
    const elasticAngle: (inertia: number, easing?: (x: number) => number) => ((value: number, deltaMs: number) => number) =
      (inertia: number, easing: ((x: number) => number) = x => x) => {
        let latestValue: number | null = null;
        return (value, deltaMs) => {
          if (latestValue !== null) {
            let newFactor = easing(deltaMs / inertia);
            if (newFactor < 1) {
              value = averageAngle(latestValue, value, newFactor);
            }
          }
          latestValue = value;
          return value;
        };
      };
    const elasticZAngle = elasticAngle(250);
    this.tick$.pipe(takeUntil(this.removed$)).subscribe(([_, delta]) => {
      const vectorLength = 6.5;
      const vectorAngle = 0.3948;
      const objectPosition = this.entityToFollow.position;
      const carVector = Pnt3.rot({ x: 0, y: 1, z: 0 }, this.entityToFollow.rotation);
      // FIXME jitters when turning during FPS drop, but elasticZAngle calculation is correct
      const zAngle = elasticZAngle(Math.atan2(carVector.y, carVector.x) - Math.PI / 2, delta);
      const cameraVector = Pnt3.rotAround(
        Pnt3.rotAround(
          { x: 0, y: -vectorLength, z: 0 },
          { x: 1, y: 0, z: 0 },
          -vectorAngle
        ),
        { x: 0, y: 0, z: 1 },
        zAngle
      );
      let cameraTargetVector = { x: 0, y: 0, z: vectorLength * Math.sin(vectorAngle) };
      this.camera.position = Pnt3.add(objectPosition, cameraVector);
      this.camera.rotation = Qtrn.lookAt(
        this.camera.position,
        Pnt3.add(objectPosition, cameraTargetVector),
        Pnt3.norm(cameraTargetVector),
      );
    });
  }

  onRemoved() {
    super.onRemoved();
    this.removed$.next();
  }

  dispose(): void {
    this.tick$.unsubscribe();
    this.tick$.complete();
  }
}
