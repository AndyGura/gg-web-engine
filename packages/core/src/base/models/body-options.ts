export type CollisionGroup = number;

export interface BodyOptions {
  dynamic: boolean;
  mass: number;
  restitution: number;
  friction: number;
  ownCollisionGroups: CollisionGroup[] | 'all';
  interactWithCollisionGroups: CollisionGroup[] | 'all';
}

export type DebugBodySettings = {
  shape: any;
  color: number;
};
