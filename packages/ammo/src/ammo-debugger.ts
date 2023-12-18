import Ammo from 'ammojs-typed';
import { IDebugPhysicsDrawer, Point3, Point4 } from '@gg-web-engine/core';
import { AmmoWorldComponent } from './components/ammo-world.component';

export const DebugBufferSize = 3 * 1000000;

export enum AmmoDebugMode {
  NoDebug = 0,
  DrawWireframe = 1,
  DrawAabb = 2,
  DrawFeaturesText = 4,
  DrawContactPoints = 8,
  NoDeactivation = 16,
  NoHelpText = 32,
  DrawText = 64,
  ProfileTimings = 128,
  EnableSatComparison = 256,
  DisableBulletLCP = 512,
  EnableCCD = 1024,
  DrawConstraints = 1 << 11, //2048
  DrawConstraintLimits = 1 << 12, //4096
  FastWireframe = 1 << 13, //8192
  DrawNormals = 1 << 14, //16384
  MAX_DEBUG_DRAW_MODE = 0xffffffff,
}

const deserializeVector = function (vec: Ammo.btVector3): Point3 {
  if (!isNaN(+vec)) {
    const heap = Ammo.HEAPF32;
    return {
      x: heap[+vec / 4],
      y: heap[(+vec + 4) / 4],
      z: heap[(+vec + 8) / 4],
    };
  }
  return { x: vec.x(), y: vec.y(), z: vec.z() };
};

export class AmmoDebugger implements Ammo.btIDebugDraw {
  protected debugMode: AmmoDebugMode = AmmoDebugMode.DrawWireframe;

  constructor(
    protected readonly world: AmmoWorldComponent,
    private readonly drawer: IDebugPhysicsDrawer<Point3, Point4>,
  ) {
    this.ammoInstance = new Ammo.DebugDrawer();
    this.ammoInstance.drawLine = this.drawLine.bind(this);
    this.ammoInstance.drawContactPoint = this.drawContactPoint.bind(this);
    this.ammoInstance.reportErrorWarning = this.reportErrorWarning.bind(this);
    this.ammoInstance.draw3dText = this.draw3dText.bind(this);
    this.ammoInstance.setDebugMode = this.setDebugMode.bind(this);
    this.ammoInstance.getDebugMode = this.getDebugMode.bind(this);
  }

  public readonly ammoInstance: Ammo.btIDebugDraw;

  draw3dText(location: Ammo.btVector3, textString: string): void {
    console.log('DRAWER DEBUG', 'draw3dtext');
  }

  drawContactPoint(
    pointOnB: Ammo.btVector3,
    normalOnB: Ammo.btVector3,
    distance: number,
    lifeTime: number,
    color: Ammo.btVector3,
  ): void {
    this.drawer.drawContactPoint(deserializeVector(pointOnB), deserializeVector(normalOnB), deserializeVector(color));
  }

  drawLine(from: Ammo.btVector3, to: Ammo.btVector3, color: Ammo.btVector3): void {
    this.drawer.drawLine(deserializeVector(from), deserializeVector(to), deserializeVector(color));
  }

  getDebugMode(): number {
    return this.debugMode;
  }

  update(): void {
    this.world.dynamicAmmoWorld?.debugDrawWorld();
    this.drawer.update();
  }

  setDebugFlags(flags: AmmoDebugMode[]): void {
    let res = 0;
    for (const flag of flags) {
      res = res | flag;
    }
    this.setDebugMode(res);
  }

  setDebugMode(debugMode: number): void {
    this.debugMode = debugMode;
  }

  reportErrorWarning(warningString: string): void {
    console.log('DRAWER DEBUG', 'reportErrorWarning', warningString);
  }
}
