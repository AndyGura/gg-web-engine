import { Rotation, Vector } from "../math";
import { RawGenericJoint, RawImpulseJointSet, RawJointAxis } from "../raw";
import { RigidBody } from "./rigid_body";
import { RigidBodySet } from "./rigid_body_set";
/**
 * The integer identifier of a collider added to a `ColliderSet`.
 */
export type ImpulseJointHandle = number;
/**
 * An enum grouping all possible types of joints:
 *
 * - `Revolute`: A revolute joint that removes all degrees of freedom between the affected
 *               bodies except for the rotation along one axis.
 * - `Fixed`: A fixed joint that removes all relative degrees of freedom between the affected bodies.
 * - `Prismatic`: A prismatic joint that removes all degrees of freedom between the affected
 *                bodies except for the translation along one axis.
 * - `Spherical`: (3D only) A spherical joint that removes all relative linear degrees of freedom between the affected bodies.
 */
export declare enum JointType {
    Revolute = 0,
    Fixed = 1,
    Prismatic = 2,
    Spherical = 3
}
export declare enum MotorModel {
    AccelerationBased = 0,
    ForceBased = 1
}
export declare class ImpulseJoint {
    protected rawSet: RawImpulseJointSet;
    protected bodySet: RigidBodySet;
    handle: ImpulseJointHandle;
    constructor(rawSet: RawImpulseJointSet, bodySet: RigidBodySet, handle: ImpulseJointHandle);
    static newTyped(rawSet: RawImpulseJointSet, bodySet: RigidBodySet, handle: ImpulseJointHandle): ImpulseJoint;
    /** @internal */
    finalizeDeserialization(bodySet: RigidBodySet): void;
    /**
     * Checks if this joint is still valid (i.e. that it has
     * not been deleted from the joint set yet).
     */
    isValid(): boolean;
    /**
     * The first rigid-body this joint it attached to.
     */
    body1(): RigidBody;
    /**
     * The second rigid-body this joint is attached to.
     */
    body2(): RigidBody;
    /**
     * The type of this joint given as a string.
     */
    type(): JointType;
    /**
     * The rotation quaternion that aligns this joint's first local axis to the `x` axis.
     */
    frameX1(): Rotation;
    /**
     * The rotation matrix that aligns this joint's second local axis to the `x` axis.
     */
    frameX2(): Rotation;
    /**
     * The position of the first anchor of this joint.
     *
     * The first anchor gives the position of the application point on the
     * local frame of the first rigid-body it is attached to.
     */
    anchor1(): Vector;
    /**
     * The position of the second anchor of this joint.
     *
     * The second anchor gives the position of the application point on the
     * local frame of the second rigid-body it is attached to.
     */
    anchor2(): Vector;
    /**
     * Sets the position of the first anchor of this joint.
     *
     * The first anchor gives the position of the application point on the
     * local frame of the first rigid-body it is attached to.
     */
    setAnchor1(newPos: Vector): void;
    /**
     * Sets the position of the second anchor of this joint.
     *
     * The second anchor gives the position of the application point on the
     * local frame of the second rigid-body it is attached to.
     */
    setAnchor2(newPos: Vector): void;
    /**
     * Controls whether contacts are computed between colliders attached
     * to the rigid-bodies linked by this joint.
     */
    setContactsEnabled(enabled: boolean): void;
    /**
     * Indicates if contacts are enabled between colliders attached
     * to the rigid-bodies linked by this joint.
     */
    contactsEnabled(): boolean;
}
export declare class UnitImpulseJoint extends ImpulseJoint {
    /**
     * The axis left free by this joint.
     */
    protected rawAxis?(): RawJointAxis;
    /**
     * Are the limits enabled for this joint?
     */
    limitsEnabled(): boolean;
    /**
     * The min limit of this joint.
     */
    limitsMin(): number;
    /**
     * The max limit of this joint.
     */
    limitsMax(): number;
    /**
     * Sets the limits of this joint.
     *
     * @param min - The minimum bound of this joint’s free coordinate.
     * @param max - The maximum bound of this joint’s free coordinate.
     */
    setLimits(min: number, max: number): void;
    configureMotorModel(model: MotorModel): void;
    configureMotorVelocity(targetVel: number, factor: number): void;
    configureMotorPosition(targetPos: number, stiffness: number, damping: number): void;
    configureMotor(targetPos: number, targetVel: number, stiffness: number, damping: number): void;
}
export declare class FixedImpulseJoint extends ImpulseJoint {
}
export declare class PrismaticImpulseJoint extends UnitImpulseJoint {
    rawAxis(): RawJointAxis;
}
export declare class RevoluteImpulseJoint extends UnitImpulseJoint {
    rawAxis(): RawJointAxis;
}
export declare class SphericalImpulseJoint extends ImpulseJoint {
}
export declare class JointData {
    anchor1: Vector;
    anchor2: Vector;
    axis: Vector;
    frame1: Rotation;
    frame2: Rotation;
    jointType: JointType;
    limitsEnabled: boolean;
    limits: Array<number>;
    private constructor();
    /**
     * Creates a new joint descriptor that builds a Fixed joint.
     *
     * A fixed joint removes all the degrees of freedom between the affected bodies, ensuring their
     * anchor and local frames coincide in world-space.
     *
     * @param anchor1 - Point where the joint is attached on the first rigid-body affected by this joint. Expressed in the
     *                  local-space of the rigid-body.
     * @param frame1 - The reference orientation of the joint wrt. the first rigid-body.
     * @param anchor2 - Point where the joint is attached on the second rigid-body affected by this joint. Expressed in the
     *                  local-space of the rigid-body.
     * @param frame2 - The reference orientation of the joint wrt. the second rigid-body.
     */
    static fixed(anchor1: Vector, frame1: Rotation, anchor2: Vector, frame2: Rotation): JointData;
    /**
     * Create a new joint descriptor that builds spherical joints.
     *
     * A spherical joint allows three relative rotational degrees of freedom
     * by preventing any relative translation between the anchors of the
     * two attached rigid-bodies.
     *
     * @param anchor1 - Point where the joint is attached on the first rigid-body affected by this joint. Expressed in the
     *                  local-space of the rigid-body.
     * @param anchor2 - Point where the joint is attached on the second rigid-body affected by this joint. Expressed in the
     *                  local-space of the rigid-body.
     */
    static spherical(anchor1: Vector, anchor2: Vector): JointData;
    /**
     * Creates a new joint descriptor that builds a Prismatic joint.
     *
     * A prismatic joint removes all the degrees of freedom between the
     * affected bodies, except for the translation along one axis.
     *
     * @param anchor1 - Point where the joint is attached on the first rigid-body affected by this joint. Expressed in the
     *                  local-space of the rigid-body.
     * @param anchor2 - Point where the joint is attached on the second rigid-body affected by this joint. Expressed in the
     *                  local-space of the rigid-body.
     * @param axis - Axis of the joint, expressed in the local-space of the rigid-bodies it is attached to.
     */
    static prismatic(anchor1: Vector, anchor2: Vector, axis: Vector): JointData;
    /**
     * Create a new joint descriptor that builds Revolute joints.
     *
     * A revolute joint removes all degrees of freedom between the affected
     * bodies except for the rotation along one axis.
     *
     * @param anchor1 - Point where the joint is attached on the first rigid-body affected by this joint. Expressed in the
     *                  local-space of the rigid-body.
     * @param anchor2 - Point where the joint is attached on the second rigid-body affected by this joint. Expressed in the
     *                  local-space of the rigid-body.
     * @param axis - Axis of the joint, expressed in the local-space of the rigid-bodies it is attached to.
     */
    static revolute(anchor1: Vector, anchor2: Vector, axis: Vector): JointData;
    intoRaw(): RawGenericJoint;
}
