import { VectorOps } from "../math";
import { FeatureType } from "./feature";
/**
 * A ray. This is a directed half-line.
 */
export class Ray {
    /**
     * Builds a ray from its origin and direction.
     *
     * @param origin - The ray's starting point.
     * @param dir - The ray's direction of propagation.
     */
    constructor(origin, dir) {
        this.origin = origin;
        this.dir = dir;
    }
    pointAt(t) {
        return {
            x: this.origin.x + this.dir.x * t,
            y: this.origin.y + this.dir.y * t,
            // #if DIM3
            z: this.origin.z + this.dir.z * t,
            // #endif
        };
    }
}
/**
 * The intersection between a ray and a collider.
 */
export class RayIntersection {
    constructor(toi, normal, featureType, featureId) {
        /**
         * The type of the geometric feature the point was projected on.
         */
        this.featureType = FeatureType.Unknown;
        /**
         * The id of the geometric feature the point was projected on.
         */
        this.featureId = undefined;
        this.toi = toi;
        this.normal = normal;
        if (featureId !== undefined)
            this.featureId = featureId;
        if (featureType !== undefined)
            this.featureType = featureType;
    }
    static fromRaw(raw) {
        if (!raw)
            return null;
        const result = new RayIntersection(raw.toi(), VectorOps.fromRaw(raw.normal()), raw.featureType(), raw.featureId());
        raw.free();
        return result;
    }
}
/**
 * The intersection between a ray and a collider (includes the collider handle).
 */
export class RayColliderIntersection {
    constructor(collider, toi, normal, featureType, featureId) {
        /**
         * The type of the geometric feature the point was projected on.
         */
        this.featureType = FeatureType.Unknown;
        /**
         * The id of the geometric feature the point was projected on.
         */
        this.featureId = undefined;
        this.collider = collider;
        this.toi = toi;
        this.normal = normal;
        if (featureId !== undefined)
            this.featureId = featureId;
        if (featureType !== undefined)
            this.featureType = featureType;
    }
    static fromRaw(colliderSet, raw) {
        if (!raw)
            return null;
        const result = new RayColliderIntersection(colliderSet.get(raw.colliderHandle()), raw.toi(), VectorOps.fromRaw(raw.normal()), raw.featureType(), raw.featureId());
        raw.free();
        return result;
    }
}
/**
 * The time of impact between a ray and a collider.
 */
export class RayColliderToi {
    constructor(collider, toi) {
        this.collider = collider;
        this.toi = toi;
    }
    static fromRaw(colliderSet, raw) {
        if (!raw)
            return null;
        const result = new RayColliderToi(colliderSet.get(raw.colliderHandle()), raw.toi());
        raw.free();
        return result;
    }
}
//# sourceMappingURL=ray.js.map