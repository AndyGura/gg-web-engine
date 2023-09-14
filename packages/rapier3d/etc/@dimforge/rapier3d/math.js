import { RawVector, RawRotation } from "./raw";
/**
 * A 3D vector.
 */
export class Vector3 {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
}
export class VectorOps {
    static new(x, y, z) {
        return new Vector3(x, y, z);
    }
    static intoRaw(v) {
        return new RawVector(v.x, v.y, v.z);
    }
    static zeros() {
        return VectorOps.new(0.0, 0.0, 0.0);
    }
    // FIXME: type ram: RawVector?
    static fromRaw(raw) {
        if (!raw)
            return null;
        let res = VectorOps.new(raw.x, raw.y, raw.z);
        raw.free();
        return res;
    }
    static copy(out, input) {
        out.x = input.x;
        out.y = input.y;
        out.z = input.z;
    }
}
/**
 * A quaternion.
 */
export class Quaternion {
    constructor(x, y, z, w) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
    }
}
export class RotationOps {
    static identity() {
        return new Quaternion(0.0, 0.0, 0.0, 1.0);
    }
    static fromRaw(raw) {
        if (!raw)
            return null;
        let res = new Quaternion(raw.x, raw.y, raw.z, raw.w);
        raw.free();
        return res;
    }
    static intoRaw(rot) {
        return new RawRotation(rot.x, rot.y, rot.z, rot.w);
    }
    static copy(out, input) {
        out.x = input.x;
        out.y = input.y;
        out.z = input.z;
        out.w = input.w;
    }
}
/**
 * A 3D symmetric-positive-definite matrix.
 */
export class SdpMatrix3 {
    /**
     * Matrix element at row 1, column 1.
     */
    get m11() {
        return this.elements[0];
    }
    /**
     * Matrix element at row 1, column 2.
     */
    get m12() {
        return this.elements[1];
    }
    /**
     * Matrix element at row 2, column 1.
     */
    get m21() {
        return this.m12;
    }
    /**
     * Matrix element at row 1, column 3.
     */
    get m13() {
        return this.elements[2];
    }
    /**
     * Matrix element at row 3, column 1.
     */
    get m31() {
        return this.m13;
    }
    /**
     * Matrix element at row 2, column 2.
     */
    get m22() {
        return this.elements[3];
    }
    /**
     * Matrix element at row 2, column 3.
     */
    get m23() {
        return this.elements[4];
    }
    /**
     * Matrix element at row 3, column 2.
     */
    get m32() {
        return this.m23;
    }
    /**
     * Matrix element at row 3, column 3.
     */
    get m33() {
        return this.elements[5];
    }
    constructor(elements) {
        this.elements = elements;
    }
}
export class SdpMatrix3Ops {
    static fromRaw(raw) {
        const sdpMatrix3 = new SdpMatrix3(raw.elements());
        raw.free();
        return sdpMatrix3;
    }
}
// #endif
//# sourceMappingURL=math.js.map