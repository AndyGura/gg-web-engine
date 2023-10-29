import { VectorOps } from "../math";
/**
 * The intersection between a ray and a collider.
 */
export class ShapeTOI {
    constructor(toi, witness1, witness2, normal1, normal2) {
        this.toi = toi;
        this.witness1 = witness1;
        this.witness2 = witness2;
        this.normal1 = normal1;
        this.normal2 = normal2;
    }
    static fromRaw(colliderSet, raw) {
        if (!raw)
            return null;
        const result = new ShapeTOI(raw.toi(), VectorOps.fromRaw(raw.witness1()), VectorOps.fromRaw(raw.witness2()), VectorOps.fromRaw(raw.normal1()), VectorOps.fromRaw(raw.normal2()));
        raw.free();
        return result;
    }
}
/**
 * The intersection between a ray and a collider.
 */
export class ShapeColliderTOI extends ShapeTOI {
    constructor(collider, toi, witness1, witness2, normal1, normal2) {
        super(toi, witness1, witness2, normal1, normal2);
        this.collider = collider;
    }
    static fromRaw(colliderSet, raw) {
        if (!raw)
            return null;
        const result = new ShapeColliderTOI(colliderSet.get(raw.colliderHandle()), raw.toi(), VectorOps.fromRaw(raw.witness1()), VectorOps.fromRaw(raw.witness2()), VectorOps.fromRaw(raw.normal1()), VectorOps.fromRaw(raw.normal2()));
        raw.free();
        return result;
    }
}
//# sourceMappingURL=toi.js.map