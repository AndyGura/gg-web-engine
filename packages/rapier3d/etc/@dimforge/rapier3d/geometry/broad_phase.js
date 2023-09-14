import { RawBroadPhase } from "../raw";
/**
 * The broad-phase used for coarse collision-detection.
 *
 * To avoid leaking WASM resources, this MUST be freed manually with `broadPhase.free()`
 * once you are done using it.
 */
export class BroadPhase {
    /**
     * Release the WASM memory occupied by this broad-phase.
     */
    free() {
        if (!!this.raw) {
            this.raw.free();
        }
        this.raw = undefined;
    }
    constructor(raw) {
        this.raw = raw || new RawBroadPhase();
    }
}
//# sourceMappingURL=broad_phase.js.map