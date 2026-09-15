export type CollisionGroup = number;
export type BodyType = 'dynamic' | 'static' | 'kinematic_pos' | 'kinematic_vel';

export interface BodyOptions {
  bodyType: BodyType;
  mass: number;
  restitution: number;
  friction: number;
  ownCollisionGroups: ReadonlyArray<CollisionGroup> | 'all';
  interactWithCollisionGroups: ReadonlyArray<CollisionGroup> | 'all';
  ccd: boolean;
}

export type DebugBodyType =
  | { type: 'RIGID_KINEMATIC' }
  | { type: 'RIGID_STATIC' }
  | { type: 'TRIGGER'; activated: () => boolean }
  | { type: 'RIGID_DYNAMIC'; sleeping: () => boolean };

export abstract class DebugBodySettings<S> {
  // this value changes on each change inside the settings.
  // Debug view skips updating anything if value stays the same
  private _revision: number = 0;
  public get revision(): number {
    // force check of color
    let _ = this.color;
    return this._revision;
  }

  get type(): DebugBodyType {
    return this._type;
  }

  set type(value: DebugBodyType) {
    this._type = value;
    this._revision++;
  }

  get shape(): S {
    return this._shape;
  }

  set shape(value: S) {
    this._shape = value;
    this._revision++;
  }

  get ignoreTransform(): boolean {
    return this._ignoreTransform;
  }

  set ignoreTransform(value: boolean) {
    this._ignoreTransform = value;
    this._revision++;
  }

  private lastRetrievedColorCache: number = 0;

  get color(): number {
    let color = 0;
    if (this._color !== undefined) {
      color = this._color;
    } else {
      switch (this.type.type) {
        case 'RIGID_DYNAMIC':
          color = this.type.sleeping() ? 0x4dabf7 : 0xff4d4d;
          break;
        case 'RIGID_STATIC':
          color = 0x51cf66;
          break;
        case 'RIGID_KINEMATIC':
          color = 0xae77ff;
          break;
        case 'TRIGGER':
          color = this.type.activated() ? 0xff922b : 0xffd43b;
          break;
      }
    }
    if (color !== this.lastRetrievedColorCache) {
      this._revision++;
      this.lastRetrievedColorCache = color;
    }
    return color;
  }

  set color(value: number | undefined) {
    this._color = value;
  }

  protected constructor(
    private _type: DebugBodyType,
    private _shape: S,
    private _ignoreTransform: boolean = false,
    private _color: number | undefined = undefined,
  ) {}
}
