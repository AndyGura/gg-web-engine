import { RawDynamicRayCastVehicleController } from "../raw";
import { VectorOps } from "../math";
/**
 * A character controller to simulate vehicles using ray-casting for the wheels.
 */
export class DynamicRayCastVehicleController {
    constructor(chassis, bodies, colliders, queries) {
        this.raw = new RawDynamicRayCastVehicleController(chassis.handle);
        this.bodies = bodies;
        this.colliders = colliders;
        this.queries = queries;
        this._chassis = chassis;
    }
    /** @internal */
    free() {
        if (!!this.raw) {
            this.raw.free();
        }
        this.raw = undefined;
    }
    /**
     * Updates the vehicle’s velocity based on its suspension, engine force, and brake.
     *
     * This directly updates the velocity of its chassis rigid-body.
     *
     * @param dt - Time increment used to integrate forces.
     * @param filterFlags - Flag to exclude categories of objects from the wheels’ ray-cast.
     * @param filterGroups - Only colliders compatible with these groups will be hit by the wheels’ ray-casts.
     * @param filterPredicate - Callback to filter out which collider will be hit by the wheels’ ray-casts.
     */
    updateVehicle(dt, filterFlags, filterGroups, filterPredicate) {
        this.raw.update_vehicle(dt, this.bodies.raw, this.colliders.raw, this.queries.raw, filterFlags, filterGroups, this.colliders.castClosure(filterPredicate));
    }
    /**
     * The current forward speed of the vehicle.
     */
    currentVehicleSpeed() {
        return this.raw.current_vehicle_speed();
    }
    /**
     * The rigid-body used as the chassis.
     */
    chassis() {
        return this._chassis;
    }
    /**
     * The chassis’ local _up_ direction (`0 = x, 1 = y, 2 = z`).
     */
    get indexUpAxis() {
        return this.raw.index_up_axis();
    }
    /**
     * Sets the chassis’ local _up_ direction (`0 = x, 1 = y, 2 = z`).
     */
    set indexUpAxis(axis) {
        this.raw.set_index_up_axis(axis);
    }
    /**
     * The chassis’ local _forward_ direction (`0 = x, 1 = y, 2 = z`).
     */
    get indexForwardAxis() {
        return this.raw.index_forward_axis();
    }
    /**
     * Sets the chassis’ local _forward_ direction (`0 = x, 1 = y, 2 = z`).
     */
    set setIndexForwardAxis(axis) {
        this.raw.set_index_forward_axis(axis);
    }
    /**
     * Adds a new wheel attached to this vehicle.
     * @param chassisConnectionCs  - The position of the wheel relative to the chassis.
     * @param directionCs - The direction of the wheel’s suspension, relative to the chassis. The ray-casting will
     *                      happen following this direction to detect the ground.
     * @param axleCs - The wheel’s axle axis, relative to the chassis.
     * @param suspensionRestLength - The rest length of the wheel’s suspension spring.
     * @param radius - The wheel’s radius.
     */
    addWheel(chassisConnectionCs, directionCs, axleCs, suspensionRestLength, radius) {
        let rawChassisConnectionCs = VectorOps.intoRaw(chassisConnectionCs);
        let rawDirectionCs = VectorOps.intoRaw(directionCs);
        let rawAxleCs = VectorOps.intoRaw(axleCs);
        this.raw.add_wheel(rawChassisConnectionCs, rawDirectionCs, rawAxleCs, suspensionRestLength, radius);
        rawChassisConnectionCs.free();
        rawDirectionCs.free();
        rawAxleCs.free();
    }
    /**
     * The number of wheels attached to this vehicle.
     */
    numWheels() {
        return this.raw.num_wheels();
    }
    /*
     *
     * Access to wheel properties.
     *
     */
    /*
     * Getters + setters
     */
    /**
     * The position of the i-th wheel, relative to the chassis.
     */
    wheelChassisConnectionPointCs(i) {
        return VectorOps.fromRaw(this.raw.wheel_chassis_connection_point_cs(i));
    }
    /**
     * Sets the position of the i-th wheel, relative to the chassis.
     */
    setWheelChassisConnectionPointCs(i, value) {
        let rawValue = VectorOps.intoRaw(value);
        this.raw.set_wheel_chassis_connection_point_cs(i, rawValue);
        rawValue.free();
    }
    /**
     * The rest length of the i-th wheel’s suspension spring.
     */
    wheelSuspensionRestLength(i) {
        return this.raw.wheel_suspension_rest_length(i);
    }
    /**
     * Sets the rest length of the i-th wheel’s suspension spring.
     */
    setWheelSuspensionRestLength(i, value) {
        this.raw.set_wheel_suspension_rest_length(i, value);
    }
    /**
     * The maximum distance the i-th wheel suspension can travel before and after its resting length.
     */
    wheelMaxSuspensionTravel(i) {
        return this.raw.wheel_max_suspension_travel(i);
    }
    /**
     * Sets the maximum distance the i-th wheel suspension can travel before and after its resting length.
     */
    setWheelMaxSuspensionTravel(i, value) {
        this.raw.set_wheel_max_suspension_travel(i, value);
    }
    /**
     * The i-th wheel’s radius.
     */
    wheelRadius(i) {
        return this.raw.wheel_radius(i);
    }
    /**
     * Sets the i-th wheel’s radius.
     */
    setWheelRadius(i, value) {
        this.raw.set_wheel_radius(i, value);
    }
    /**
     * The i-th wheel’s suspension stiffness.
     *
     * Increase this value if the suspension appears to not push the vehicle strong enough.
     */
    wheelSuspensionStiffness(i) {
        return this.raw.wheel_suspension_stiffness(i);
    }
    /**
     * Sets the i-th wheel’s suspension stiffness.
     *
     * Increase this value if the suspension appears to not push the vehicle strong enough.
     */
    setWheelSuspensionStiffness(i, value) {
        this.raw.set_wheel_suspension_stiffness(i, value);
    }
    /**
     * The i-th wheel’s suspension’s damping when it is being compressed.
     */
    wheelSuspensionCompression(i) {
        return this.raw.wheel_suspension_compression(i);
    }
    /**
     * The i-th wheel’s suspension’s damping when it is being compressed.
     */
    setWheelSuspensionCompression(i, value) {
        this.raw.set_wheel_suspension_compression(i, value);
    }
    /**
     * The i-th wheel’s suspension’s damping when it is being released.
     *
     * Increase this value if the suspension appears to overshoot.
     */
    wheelSuspensionRelaxation(i) {
        return this.raw.wheel_suspension_relaxation(i);
    }
    /**
     * Sets the i-th wheel’s suspension’s damping when it is being released.
     *
     * Increase this value if the suspension appears to overshoot.
     */
    setWheelSuspensionRelaxation(i, value) {
        this.raw.set_wheel_suspension_relaxation(i, value);
    }
    /**
     * The maximum force applied by the i-th wheel’s suspension.
     */
    wheelMaxSuspensionForce(i) {
        return this.raw.wheel_max_suspension_force(i);
    }
    /**
     * Sets the maximum force applied by the i-th wheel’s suspension.
     */
    setWheelMaxSuspensionForce(i, value) {
        this.raw.set_wheel_max_suspension_force(i, value);
    }
    /**
     * The maximum amount of braking impulse applied on the i-th wheel to slow down the vehicle.
     */
    wheelBrake(i) {
        return this.raw.wheel_brake(i);
    }
    /**
     * Set the maximum amount of braking impulse applied on the i-th wheel to slow down the vehicle.
     */
    setWheelBrake(i, value) {
        this.raw.set_wheel_brake(i, value);
    }
    /**
     * The steering angle (radians) for the i-th wheel.
     */
    wheelSteering(i) {
        return this.raw.wheel_steering(i);
    }
    /**
     * Sets the steering angle (radians) for the i-th wheel.
     */
    setWheelSteering(i, value) {
        this.raw.set_wheel_steering(i, value);
    }
    /**
     * The forward force applied by the i-th wheel on the chassis.
     */
    wheelEngineForce(i) {
        return this.raw.wheel_engine_force(i);
    }
    /**
     * Sets the forward force applied by the i-th wheel on the chassis.
     */
    setWheelEngineForce(i, value) {
        this.raw.set_wheel_engine_force(i, value);
    }
    /**
     * The direction of the i-th wheel’s suspension, relative to the chassis.
     *
     * The ray-casting will happen following this direction to detect the ground.
     */
    wheelDirectionCs(i) {
        return VectorOps.fromRaw(this.raw.wheel_direction_cs(i));
    }
    /**
     * Sets the direction of the i-th wheel’s suspension, relative to the chassis.
     *
     * The ray-casting will happen following this direction to detect the ground.
     */
    setWheelDirectionCs(i, value) {
        let rawValue = VectorOps.intoRaw(value);
        this.raw.set_wheel_direction_cs(i, rawValue);
        rawValue.free();
    }
    /**
     * The i-th wheel’s axle axis, relative to the chassis.
     *
     * The axis index defined as 0 = X, 1 = Y, 2 = Z.
     */
    wheelAxleCs(i) {
        return VectorOps.fromRaw(this.raw.wheel_axle_cs(i));
    }
    /**
     * Sets the i-th wheel’s axle axis, relative to the chassis.
     *
     * The axis index defined as 0 = X, 1 = Y, 2 = Z.
     */
    setWheelAxleCs(i, value) {
        let rawValue = VectorOps.intoRaw(value);
        this.raw.set_wheel_axle_cs(i, rawValue);
        rawValue.free();
    }
    /**
     * Parameter controlling how much traction the tire has.
     *
     * The larger the value, the more instantaneous braking will happen (with the risk of
     * causing the vehicle to flip if it’s too strong).
     */
    wheelFrictionSlip(i) {
        return this.raw.wheel_friction_slip(i);
    }
    /**
     * Sets the parameter controlling how much traction the tire has.
     *
     * The larger the value, the more instantaneous braking will happen (with the risk of
     * causing the vehicle to flip if it’s too strong).
     */
    setWheelFrictionSlip(i, value) {
        this.raw.set_wheel_friction_slip(i, value);
    }
    /*
     * Getters only.
     */
    /**
     *  The i-th wheel’s current rotation angle (radians) on its axle.
     */
    wheelRotation(i) {
        return this.raw.wheel_rotation(i);
    }
    /**
     *  The forward impulses applied by the i-th wheel on the chassis.
     */
    wheelForwardImpulse(i) {
        return this.raw.wheel_forward_impulse(i);
    }
    /**
     *  The side impulses applied by the i-th wheel on the chassis.
     */
    wheelSideImpulse(i) {
        return this.raw.wheel_side_impulse(i);
    }
    /**
     *  The force applied by the i-th wheel suspension.
     */
    wheelSuspensionForce(i) {
        return this.raw.wheel_suspension_force(i);
    }
    /**
     *  The (world-space) contact normal between the i-th wheel and the floor.
     */
    wheelContactNormal(i) {
        return VectorOps.fromRaw(this.raw.wheel_contact_normal_ws(i));
    }
    /**
     *  The (world-space) point hit by the wheel’s ray-cast for the i-th wheel.
     */
    wheelContactPoint(i) {
        return VectorOps.fromRaw(this.raw.wheel_contact_point_ws(i));
    }
    /**
     *  The suspension length for the i-th wheel.
     */
    wheelSuspensionLength(i) {
        return this.raw.wheel_suspension_length(i);
    }
    /**
     *  The (world-space) starting point of the ray-cast for the i-th wheel.
     */
    wheelHardPoint(i) {
        return VectorOps.fromRaw(this.raw.wheel_hard_point_ws(i));
    }
    /**
     *  Is the i-th wheel in contact with the ground?
     */
    wheelIsInContact(i) {
        return this.raw.wheel_is_in_contact(i);
    }
    /**
     *  The collider hit by the ray-cast for the i-th wheel.
     */
    wheelGroundObject(i) {
        return this.colliders.get(this.raw.wheel_ground_object(i));
    }
}
//# sourceMappingURL=ray_cast_vehicle_controller.js.map