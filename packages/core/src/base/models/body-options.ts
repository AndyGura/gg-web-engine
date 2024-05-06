export type CollisionGroup = number;

export interface BodyOptions {
  dynamic: boolean;
  mass: number;
  restitution: number;
  friction: number;
  ownCollisionGroups: CollisionGroup[] | 'all';
  interactWithCollisionGroups: CollisionGroup[] | 'all';
}

export type DebugBodySettings = { shape: any; ignoreTransform?: boolean } & (
  | {
      type: 'RIGID_STATIC' | 'TRIGGER';
    }
  | {
      type: 'RIGID_DYNAMIC';
      sleeping: boolean;
    }
);
