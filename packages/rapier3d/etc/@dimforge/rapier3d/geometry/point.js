import { VectorOps } from "../math";
import { FeatureType } from "./feature";
/**
 * The projection of a point on a collider.
 */
export class PointProjection {
    constructor(point, isInside) {
        this.point = point;
        this.isInside = isInside;
    }
    static fromRaw(raw) {
        if (!raw)
            return null;
        const result = new PointProjection(VectorOps.fromRaw(raw.point()), raw.isInside());
        raw.free();
        return result;
    }
}
/**
 * The projection of a point on a collider (includes the collider handle).
 */
export class PointColliderProjection {
    constructor(collider, point, isInside, featureType, featureId) {
        /**
         * The type of the geometric feature the point was projected on.
         */
        this.featureType = FeatureType.Unknown;
        /**
         * The id of the geometric feature the point was projected on.
         */
        this.featureId = undefined;
        this.collider = collider;
        this.point = point;
        this.isInside = isInside;
        if (featureId !== undefined)
            this.featureId = featureId;
        if (featureType !== undefined)
            this.featureType = featureType;
    }
    static fromRaw(colliderSet, raw) {
        if (!raw)
            return null;
        const result = new PointColliderProjection(colliderSet.get(raw.colliderHandle()), VectorOps.fromRaw(raw.point()), raw.isInside(), raw.featureType(), raw.featureId());
        raw.free();
        return result;
    }
}
//# sourceMappingURL=point.js.map