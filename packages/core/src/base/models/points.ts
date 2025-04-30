export type MutablePoint2 = { x: number; y: number };
export type MutablePoint3 = { x: number; y: number; z: number };
export type MutablePoint4 = { x: number; y: number; z: number; w: number };

export type MutablePolar = { radius: number; phi: number };
export type MutableSpherical = { radius: number; phi: number; theta: number };

export type Point2 = Readonly<MutablePoint2>;
export type Point3 = Readonly<MutablePoint3>;
export type Point4 = Readonly<MutablePoint4>;

export type Polar = Readonly<MutablePolar>;
export type Spherical = Readonly<MutableSpherical>;
