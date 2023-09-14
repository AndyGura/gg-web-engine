import { VectorOps } from "../math";
/**
 * The contact info between two shapes.
 */
export class ShapeContact {
    constructor(dist, point1, point2, normal1, normal2) {
        this.distance = dist;
        this.point1 = point1;
        this.point2 = point2;
        this.normal1 = normal1;
        this.normal2 = normal2;
    }
    static fromRaw(raw) {
        if (!raw)
            return null;
        const result = new ShapeContact(raw.distance(), VectorOps.fromRaw(raw.point1()), VectorOps.fromRaw(raw.point2()), VectorOps.fromRaw(raw.normal1()), VectorOps.fromRaw(raw.normal2()));
        raw.free();
        return result;
    }
}
//# sourceMappingURL=contact.js.map