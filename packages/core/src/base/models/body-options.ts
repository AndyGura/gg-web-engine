export type CollisionGroup = number;

export interface BodyOptions {
  dynamic: boolean;
  mass: number;
  restitution: number;
  friction: number;
  ownCollisionGroups: ReadonlyArray<CollisionGroup> | 'all';
  interactWithCollisionGroups: ReadonlyArray<CollisionGroup> | 'all';
}

export type DebugBodyType =
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
          color = this.type.sleeping() ? 0x0000ff : 0xff0000;
          break;
        case 'RIGID_STATIC':
          color = 0x00ff00;
          break;
        case 'TRIGGER':
          color = this.type.activated() ? 0xff9900 : 0xffff00;
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
