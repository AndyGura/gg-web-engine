export default Ammo;
declare function Ammo<T>(target?: T): Promise<T & typeof Ammo>;
declare module Ammo {
    function destroy(obj: any): void;
    function _malloc(size: number): number;
    function _free(ptr: number): void;
    const HEAP8: Int8Array;
    const HEAP16: Int16Array;
    const HEAP32: Int32Array;
    const HEAPU8: Uint8Array;
    const HEAPU16: Uint16Array;
    const HEAPU32: Uint32Array;
    const HEAPF32: Float32Array;
    const HEAPF64: Float64Array;
    class TopLevelFunctions {
        quatRotate_(rotation: btQuaternion, v: btVector3): btVector3;
        set_gContactAddedCallback(cb: unknown): void;
    }
    class AdapterFunctions {
        setInternalTickCallback(world: btDynamicsWorld, cb: unknown, worldUserInfo?: unknown, isPreTick?: boolean): void;
    }
    class Clone {
        Vector3(v: btVector3): btVector3;
        Quaternion(q: btQuaternion): btQuaternion;
    }
    class btIDebugDraw {
        drawLine(from: btVector3, to: btVector3, color: btVector3): void;
        drawContactPoint(pointOnB: btVector3, normalOnB: btVector3, distance: number, lifeTime: number, color: btVector3): void;
        reportErrorWarning(warningString: string): void;
        draw3dText(location: btVector3, textString: string): void;
        setDebugMode(debugMode: number): void;
        getDebugMode(): number;
    }
    class DebugDrawer {
        constructor();
        drawLine(from: btVector3, to: btVector3, color: btVector3): void;
        drawContactPoint(pointOnB: btVector3, normalOnB: btVector3, distance: number, lifeTime: number, color: btVector3): void;
        reportErrorWarning(warningString: string): void;
        draw3dText(location: btVector3, textString: string): void;
        setDebugMode(debugMode: number): void;
        getDebugMode(): number;
    }
    class btVector3 {
        constructor();
        constructor(x: number, y: number, z: number);
        length(): number;
        x(): number;
        y(): number;
        z(): number;
        setX(x: number): void;
        setY(y: number): void;
        setZ(z: number): void;
        setValue(x: number, y: number, z: number): void;
        normalize(): void;
        normalized(): btVector3;
        rotate(wAxis: btVector3, angle: number): btVector3;
        dot(v: btVector3): number;
        angle(v: btVector3): number;
        absolute(): btVector3;
        cross(v: btVector3): btVector3;
        triple(v1: btVector3, v2: btVector3): number;
        minAxis(): number;
        maxAxis(): number;
        furthestAxis(): number;
        closestAxis(): number;
        setInterpolate3(v0: btVector3, v1: btVector3, rt: number): void;
        op_mul(x: number): btVector3;
        op_add(v: btVector3): btVector3;
        op_sub(v: btVector3): btVector3;
    }
    class btVector4 extends btVector3 {
        constructor();
        constructor(x: number, y: number, z: number, w: number);
        w(): number;
        absolute4(): btVector4;
        maxAxis4(): number;
        minAxis4(): number;
        closestAxis4(): number;
        op_set(v: btVector4): void;
        length(): number;
        x(): number;
        y(): number;
        z(): number;
        setX(x: number): void;
        setY(y: number): void;
        setZ(z: number): void;
        normalize(): void;
        normalized(): btVector3;
        rotate(wAxis: btVector3, angle: number): btVector3;
        dot(v: btVector3): number;
        angle(v: btVector3): number;
        absolute(): btVector3;
        cross(v: btVector3): btVector3;
        triple(v1: btVector3, v2: btVector3): number;
        minAxis(): number;
        maxAxis(): number;
        furthestAxis(): number;
        closestAxis(): number;
        setInterpolate3(v0: btVector3, v1: btVector3, rt: number): void;
        op_mul(x: number): btVector3;
        op_add(v: btVector3): btVector3;
        op_sub(v: btVector3): btVector3;
    }
    class btQuadWord {
        x(): number;
        y(): number;
        z(): number;
        w(): number;
        setX(x: number): void;
        setY(y: number): void;
        setZ(z: number): void;
        setW(w: number): void;
    }
    class btQuaternion extends btQuadWord {
        constructor();
        constructor(x: number, y: number, z: number, w: number);
        setValue(x: number, y: number, z: number, w: number): void;
        setEulerZYX(z: number, y: number, x: number): void;
        setRotation(axis: btVector3, angle: number): void;
        normalize(): void;
        length2(): number;
        length(): number;
        dot(q: btQuaternion): number;
        normalized(): btQuaternion;
        getAxis(): btVector3;
        inverse(): btQuaternion;
        getAngle(): number;
        getAngleShortestPath(): number;
        angle(q: btQuaternion): number;
        angleShortestPath(q: btQuaternion): number;
        op_add(q: btQuaternion): btQuaternion;
        op_sub(q: btQuaternion): btQuaternion;
        op_mul(s: number): btQuaternion;
        op_mulq(q: btQuaternion): btQuaternion;
        op_div(s: number): btQuaternion;
    }
    class btMatrix3x3 {
        setEulerZYX(ex: number, ey: number, ez: number): void;
        getRotation(q: btQuaternion): void;
        getRow(y: number): btVector3;
    }
    class btTransform {
        constructor();
        constructor(q: btQuaternion, v: btVector3);
        setIdentity(): void;
        setOrigin(origin: btVector3): void;
        setRotation(rotation: btQuaternion): void;
        getOrigin(): btVector3;
        getRotation(): btQuaternion;
        getBasis(): btMatrix3x3;
        setFromOpenGLMatrix(m: ReadonlyArray<number>): void;
        inverse(): btTransform;
        op_mul(t: btTransform): btTransform;
    }
    class btMotionState {
        getWorldTransform(worldTrans: btTransform): void;
        setWorldTransform(worldTrans: btTransform): void;
    }
    class MotionState {
        constructor();
        getWorldTransform(worldTrans: btTransform): void;
        setWorldTransform(worldTrans: btTransform): void;
    }
    class btDefaultMotionState extends btMotionState {
        constructor(startTrans?: btTransform, centerOfMassOffset?: btTransform);
        get_m_graphicsWorldTrans(): btTransform;
        set_m_graphicsWorldTrans(m_graphicsWorldTrans: btTransform): void;
        m_graphicsWorldTrans: btTransform;
    }
    class btSpatialForceVector {
        get_m_topVec(): btVector3;
        set_m_topVec(m_topVec: btVector3): void;
        m_topVec: btVector3;
        get_m_bottomVec(): btVector3;
        set_m_bottomVec(m_bottomVec: btVector3): void;
        m_bottomVec: btVector3;
        constructor();
        constructor(angular: btVector3, linear: btVector3);
        setVector(angular: btVector3, linear: btVector3): void;
        addVector(angular: btVector3, linear: btVector3): void;
        getLinear(): btVector3;
        getAngular(): btVector3;
        setLinear(linear: btVector3): void;
        setAngular(angular: btVector3): void;
        addAngular(angular: btVector3): void;
        addLinear(linear: btVector3): void;
        setZero(): void;
        op_add(vec: btSpatialForceVector): btSpatialForceVector;
        op_sub(vec: btSpatialForceVector): btSpatialForceVector;
    }
    class btSpatialMotionVector {
        get_m_topVec(): btVector3;
        set_m_topVec(m_topVec: btVector3): void;
        m_topVec: btVector3;
        get_m_bottomVec(): btVector3;
        set_m_bottomVec(m_bottomVec: btVector3): void;
        m_bottomVec: btVector3;
        constructor();
        constructor(angular: btVector3, linear: btVector3);
        setVector(angular: btVector3, linear: btVector3): void;
        addVector(angular: btVector3, linear: btVector3): void;
        getAngular(): btVector3;
        getLinear(): btVector3;
        setAngular(angular: btVector3): void;
        setLinear(linear: btVector3): void;
        addAngular(angular: btVector3): void;
        addLinear(linear: btVector3): void;
        setZero(): void;
        dot(b: btSpatialForceVector): number;
        op_add(vec: btSpatialMotionVector): btSpatialMotionVector;
        op_sub(vec: btSpatialMotionVector): btSpatialMotionVector;
    }
    class btSymmetricSpatialDyad {
        get_m_topLeftMat(): btMatrix3x3;
        set_m_topLeftMat(m_topLeftMat: btMatrix3x3): void;
        m_topLeftMat: btMatrix3x3;
        get_m_topRightMat(): btMatrix3x3;
        set_m_topRightMat(m_topRightMat: btMatrix3x3): void;
        m_topRightMat: btMatrix3x3;
        get_m_bottomLeftMat(): btMatrix3x3;
        set_m_bottomLeftMat(m_bottomLeftMat: btMatrix3x3): void;
        m_bottomLeftMat: btMatrix3x3;
        constructor();
        constructor(topLeftMat: btMatrix3x3, topRightMat: btMatrix3x3, bottomLeftMat: btMatrix3x3);
        setMatrix(topLeftMat: btMatrix3x3, topRightMat: btMatrix3x3, bottomLeftMat: btMatrix3x3): void;
        addMatrix(topLeftMat: btMatrix3x3, topRightMat: btMatrix3x3, bottomLeftMat: btMatrix3x3): void;
        setIdentity(): void;
        op_sub(mat: btSymmetricSpatialDyad): btSymmetricSpatialDyad;
    }
    type btCollisionObject_CollisionFlags = "btCollisionObject::CF_DYNAMIC_OBJECT" | "btCollisionObject::CF_STATIC_OBJECT" | "btCollisionObject::CF_KINEMATIC_OBJECT" | "btCollisionObject::CF_NO_CONTACT_RESPONSE" | "btCollisionObject::CF_CUSTOM_MATERIAL_CALLBACK" | "btCollisionObject::CF_CHARACTER_OBJECT" | "btCollisionObject::CF_DISABLE_VISUALIZE_OBJECT" | "btCollisionObject::CF_DISABLE_SPU_COLLISION_PROCESSING" | "btCollisionObject::CF_HAS_CONTACT_STIFFNESS_DAMPING" | "btCollisionObject::CF_HAS_CUSTOM_DEBUG_RENDERING_COLOR" | "btCollisionObject::CF_HAS_FRICTION_ANCHOR" | "btCollisionObject::CF_HAS_COLLISION_SOUND_TRIGGER";
    type btCollisionObject_CollisionObjectTypes = "btCollisionObject::CO_COLLISION_OBJECT" | "btCollisionObject::CO_RIGID_BODY" | "btCollisionObject::CO_GHOST_OBJECT" | "btCollisionObject::CO_SOFT_BODY" | "btCollisionObject::CO_HF_FLUID" | "btCollisionObject::CO_USER_TYPE" | "btCollisionObject::CO_FEATHERSTONE_LINK";
    type btCollisionObject_AnisotropicFrictionFlags = "btCollisionObject::CF_ANISOTROPIC_FRICTION_DISABLED" | "btCollisionObject::CF_ANISOTROPIC_FRICTION" | "btCollisionObject::CF_ANISOTROPIC_ROLLING_FRICTION";
    class btCollisionObject {
        getAnisotropicFriction(): btVector3;
        setAnisotropicFriction(anisotropicFriction: btVector3, frictionMode: number): void;
        hasAnisotropicFriction(frictionMode?: number): boolean;
        getCollisionShape(): btCollisionShape;
        getContactProcessingThreshold(): number;
        setContactProcessingThreshold(contactProcessingThreshold: number): void;
        getActivationState(): number;
        setActivationState(newState: number): void;
        forceActivationState(newState: number): void;
        activate(forceActivation?: boolean): void;
        setDeactivationTime(time: number): void;
        getDeactivationTime(): number;
        isActive(): boolean;
        isKinematicObject(): boolean;
        isStaticObject(): boolean;
        isStaticOrKinematicObject(): boolean;
        getRestitution(): number;
        getFriction(): number;
        getRollingFriction(): number;
        getSpinningFriction(): number;
        getContactStiffness(): number;
        getContactDamping(): number;
        setRestitution(rest: number): void;
        setFriction(frict: number): void;
        setRollingFriction(frict: number): void;
        setSpinningFriction(frict: number): void;
        setContactStiffnessAndDamping(stiffness: number, damping: number): void;
        getWorldTransform(): btTransform;
        getCollisionFlags(): number;
        setCollisionFlags(flags: number): void;
        setWorldTransform(worldTrans: btTransform): void;
        setCollisionShape(collisionShape: btCollisionShape): void;
        setCcdMotionThreshold(ccdMotionThreshold: number): void;
        setCcdSweptSphereRadius(radius: number): void;
        getUserIndex(): number;
        getUserIndex2(): number;
        getUserIndex3(): number;
        setUserIndex(index: number): void;
        setUserIndex2(index: number): void;
        setUserIndex3(index: number): void;
        getUserPointer(): unknown;
        setUserPointer(userPointer: unknown): void;
        getBroadphaseHandle(): btBroadphaseProxy;
    }
    class btCollisionObjectWrapper {
        getWorldTransform(): btTransform;
        getCollisionObject(): btCollisionObject;
        getCollisionShape(): btCollisionShape;
    }
    class RayResultCallback {
        hasHit(): boolean;
        get_m_collisionFilterGroup(): number;
        set_m_collisionFilterGroup(m_collisionFilterGroup: number): void;
        m_collisionFilterGroup: number;
        get_m_collisionFilterMask(): number;
        set_m_collisionFilterMask(m_collisionFilterMask: number): void;
        m_collisionFilterMask: number;
        get_m_closestHitFraction(): number;
        set_m_closestHitFraction(m_closestHitFraction: number): void;
        m_closestHitFraction: number;
        get_m_collisionObject(): btCollisionObject;
        set_m_collisionObject(m_collisionObject: btCollisionObject): void;
        m_collisionObject: btCollisionObject;
        get_m_flags(): number;
        set_m_flags(m_flags: number): void;
        m_flags: number;
    }
    class ClosestRayResultCallback extends RayResultCallback {
        constructor(from: btVector3, to: btVector3);
        get_m_rayFromWorld(): btVector3;
        set_m_rayFromWorld(m_rayFromWorld: btVector3): void;
        m_rayFromWorld: btVector3;
        get_m_rayToWorld(): btVector3;
        set_m_rayToWorld(m_rayToWorld: btVector3): void;
        m_rayToWorld: btVector3;
        get_m_hitNormalWorld(): btVector3;
        set_m_hitNormalWorld(m_hitNormalWorld: btVector3): void;
        m_hitNormalWorld: btVector3;
        get_m_hitPointWorld(): btVector3;
        set_m_hitPointWorld(m_hitPointWorld: btVector3): void;
        m_hitPointWorld: btVector3;
    }
    class btConstCollisionObjectArray {
        size(): number;
        at(n: number): btCollisionObject;
    }
    class btScalarArray {
        size(): number;
        at(n: number): number;
    }
    class AllHitsRayResultCallback extends RayResultCallback {
        constructor(from: btVector3, to: btVector3);
        get_m_collisionObjects(): btConstCollisionObjectArray;
        set_m_collisionObjects(m_collisionObjects: btConstCollisionObjectArray): void;
        m_collisionObjects: btConstCollisionObjectArray;
        get_m_rayFromWorld(): btVector3;
        set_m_rayFromWorld(m_rayFromWorld: btVector3): void;
        m_rayFromWorld: btVector3;
        get_m_rayToWorld(): btVector3;
        set_m_rayToWorld(m_rayToWorld: btVector3): void;
        m_rayToWorld: btVector3;
        get_m_hitNormalWorld(): btVector3Array;
        set_m_hitNormalWorld(m_hitNormalWorld: btVector3Array): void;
        m_hitNormalWorld: btVector3Array;
        get_m_hitPointWorld(): btVector3Array;
        set_m_hitPointWorld(m_hitPointWorld: btVector3Array): void;
        m_hitPointWorld: btVector3Array;
        get_m_hitFractions(): btScalarArray;
        set_m_hitFractions(m_hitFractions: btScalarArray): void;
        m_hitFractions: btScalarArray;
    }
    class btManifoldPoint {
        getPositionWorldOnA(): btVector3;
        getPositionWorldOnB(): btVector3;
        getAppliedImpulse(): number;
        getDistance(): number;
        get_m_localPointA(): btVector3;
        set_m_localPointA(m_localPointA: btVector3): void;
        m_localPointA: btVector3;
        get_m_localPointB(): btVector3;
        set_m_localPointB(m_localPointB: btVector3): void;
        m_localPointB: btVector3;
        get_m_positionWorldOnB(): btVector3;
        set_m_positionWorldOnB(m_positionWorldOnB: btVector3): void;
        m_positionWorldOnB: btVector3;
        get_m_positionWorldOnA(): btVector3;
        set_m_positionWorldOnA(m_positionWorldOnA: btVector3): void;
        m_positionWorldOnA: btVector3;
        get_m_normalWorldOnB(): btVector3;
        set_m_normalWorldOnB(m_normalWorldOnB: btVector3): void;
        m_normalWorldOnB: btVector3;
        get_m_userPersistentData(): any;
        set_m_userPersistentData(m_userPersistentData: any): void;
        m_userPersistentData: any;
    }
    class ContactResultCallback {
        addSingleResult(cp: btManifoldPoint, colObj0Wrap: btCollisionObjectWrapper, partId0: number, index0: number, colObj1Wrap: btCollisionObjectWrapper, partId1: number, index1: number): number;
    }
    class ConcreteContactResultCallback {
        constructor();
        addSingleResult(cp: btManifoldPoint, colObj0Wrap: btCollisionObjectWrapper, partId0: number, index0: number, colObj1Wrap: btCollisionObjectWrapper, partId1: number, index1: number): number;
    }
    class LocalShapeInfo {
        get_m_shapePart(): number;
        set_m_shapePart(m_shapePart: number): void;
        m_shapePart: number;
        get_m_triangleIndex(): number;
        set_m_triangleIndex(m_triangleIndex: number): void;
        m_triangleIndex: number;
    }
    class LocalConvexResult {
        constructor(hitCollisionObject: btCollisionObject, localShapeInfo: LocalShapeInfo, hitNormalLocal: btVector3, hitPointLocal: btVector3, hitFraction: number);
        get_m_hitCollisionObject(): btCollisionObject;
        set_m_hitCollisionObject(m_hitCollisionObject: btCollisionObject): void;
        m_hitCollisionObject: btCollisionObject;
        get_m_localShapeInfo(): LocalShapeInfo;
        set_m_localShapeInfo(m_localShapeInfo: LocalShapeInfo): void;
        m_localShapeInfo: LocalShapeInfo;
        get_m_hitNormalLocal(): btVector3;
        set_m_hitNormalLocal(m_hitNormalLocal: btVector3): void;
        m_hitNormalLocal: btVector3;
        get_m_hitPointLocal(): btVector3;
        set_m_hitPointLocal(m_hitPointLocal: btVector3): void;
        m_hitPointLocal: btVector3;
        get_m_hitFraction(): number;
        set_m_hitFraction(m_hitFraction: number): void;
        m_hitFraction: number;
    }
    class ConvexResultCallback {
        hasHit(): boolean;
        get_m_collisionFilterGroup(): number;
        set_m_collisionFilterGroup(m_collisionFilterGroup: number): void;
        m_collisionFilterGroup: number;
        get_m_collisionFilterMask(): number;
        set_m_collisionFilterMask(m_collisionFilterMask: number): void;
        m_collisionFilterMask: number;
        get_m_closestHitFraction(): number;
        set_m_closestHitFraction(m_closestHitFraction: number): void;
        m_closestHitFraction: number;
    }
    class ClosestConvexResultCallback extends ConvexResultCallback {
        constructor(convexFromWorld: btVector3, convexToWorld: btVector3);
        get_m_hitCollisionObject(): btCollisionObject;
        set_m_hitCollisionObject(m_hitCollisionObject: btCollisionObject): void;
        m_hitCollisionObject: btCollisionObject;
        get_m_convexFromWorld(): btVector3;
        set_m_convexFromWorld(m_convexFromWorld: btVector3): void;
        m_convexFromWorld: btVector3;
        get_m_convexToWorld(): btVector3;
        set_m_convexToWorld(m_convexToWorld: btVector3): void;
        m_convexToWorld: btVector3;
        get_m_hitNormalWorld(): btVector3;
        set_m_hitNormalWorld(m_hitNormalWorld: btVector3): void;
        m_hitNormalWorld: btVector3;
        get_m_hitPointWorld(): btVector3;
        set_m_hitPointWorld(m_hitPointWorld: btVector3): void;
        m_hitPointWorld: btVector3;
    }
    class btCollisionShape {
        setLocalScaling(scaling: btVector3): void;
        getLocalScaling(): btVector3;
        calculateLocalInertia(mass: number, inertia: btVector3): void;
        setMargin(margin: number): void;
        getMargin(): number;
    }
    class btConvexShape extends btCollisionShape {
    }
    class btConvexTriangleMeshShape extends btConvexShape {
        constructor(meshInterface: btStridingMeshInterface, calcAabb?: boolean);
    }
    class btBoxShape extends btCollisionShape {
        constructor(boxHalfExtents: btVector3);
        setMargin(margin: number): void;
        getMargin(): number;
    }
    class btCapsuleShape extends btCollisionShape {
        constructor(radius: number, height: number);
        setMargin(margin: number): void;
        getMargin(): number;
        getUpAxis(): number;
        getRadius(): number;
        getHalfHeight(): number;
    }
    class btCapsuleShapeX extends btCapsuleShape {
        constructor(radius: number, height: number);
        setMargin(margin: number): void;
        getMargin(): number;
    }
    class btCapsuleShapeZ extends btCapsuleShape {
        constructor(radius: number, height: number);
        setMargin(margin: number): void;
        getMargin(): number;
    }
    class btCylinderShape extends btCollisionShape {
        constructor(halfExtents: btVector3);
        setMargin(margin: number): void;
        getMargin(): number;
    }
    class btCylinderShapeX extends btCylinderShape {
        constructor(halfExtents: btVector3);
        setMargin(margin: number): void;
        getMargin(): number;
    }
    class btCylinderShapeZ extends btCylinderShape {
        constructor(halfExtents: btVector3);
        setMargin(margin: number): void;
        getMargin(): number;
    }
    class btSphereShape extends btCollisionShape {
        constructor(radius: number);
        setMargin(margin: number): void;
        getMargin(): number;
    }
    class btMultiSphereShape extends btCollisionShape {
        constructor(positions: btVector3, radii: ReadonlyArray<number>, numPoints: number);
    }
    class btConeShape extends btCollisionShape {
        constructor(radius: number, height: number);
    }
    class btConeShapeX extends btConeShape {
        constructor(radius: number, height: number);
    }
    class btConeShapeZ extends btConeShape {
        constructor(radius: number, height: number);
    }
    class btIntArray {
        size(): number;
        at(n: number): number;
    }
    class btFace {
        get_m_indices(): btIntArray;
        set_m_indices(m_indices: btIntArray): void;
        m_indices: btIntArray;
        get_m_plane(): ReadonlyArray<number>;
        set_m_plane(m_plane: ReadonlyArray<number>): void;
        m_plane: ReadonlyArray<number>;
    }
    class btVector3Array {
        constructor();
        size(): number;
        at(n: number): btVector3;
        clear(): void;
        pop_back(): void;
        resize(newsize: number, fillData: btVector3): void;
        expandNonInitializing(): btVector3;
        expand(fillValue: btVector3): btVector3;
        push_back(Val: btVector3): void;
        capacity(): number;
        reserve(Count: number): void;
    }
    class btQuaternionArray {
        constructor();
        size(): number;
        at(n: number): btQuaternion;
        clear(): void;
        pop_back(): void;
        resize(newsize: number, fillData: btQuaternion): void;
        expandNonInitializing(): btQuaternion;
        expand(fillValue: btQuaternion): btQuaternion;
        push_back(Val: btQuaternion): void;
        capacity(): number;
        reserve(Count: number): void;
    }
    class btMatrix3x3Array {
        constructor();
        size(): number;
        at(n: number): btMatrix3x3;
        clear(): void;
        pop_back(): void;
        resize(newsize: number, fillData: btMatrix3x3): void;
        expandNonInitializing(): btMatrix3x3;
        expand(fillValue: btMatrix3x3): btMatrix3x3;
        push_back(Val: btMatrix3x3): void;
        capacity(): number;
        reserve(Count: number): void;
    }
    class btFaceArray {
        constructor();
        size(): number;
        at(n: number): btFace;
        clear(): void;
        pop_back(): void;
        resize(newsize: number, fillData: btFace): void;
        expandNonInitializing(): btFace;
        expand(fillValue: btFace): btFace;
        push_back(Val: btFace): void;
        capacity(): number;
        reserve(Count: number): void;
    }
    class btConvexPolyhedron {
        get_m_vertices(): btVector3Array;
        set_m_vertices(m_vertices: btVector3Array): void;
        m_vertices: btVector3Array;
        get_m_faces(): btFaceArray;
        set_m_faces(m_faces: btFaceArray): void;
        m_faces: btFaceArray;
    }
    class btConvexHullShape extends btCollisionShape {
        constructor(points?: ReadonlyArray<number>, numPoints?: number);
        addPoint(point: btVector3, recalculateLocalAABB?: boolean): void;
        setMargin(margin: number): void;
        getMargin(): number;
        getNumVertices(): number;
        initializePolyhedralFeatures(shiftVerticesByMargin: number): boolean;
        recalcLocalAabb(): void;
        getConvexPolyhedron(): btConvexPolyhedron;
    }
    class btShapeHull {
        constructor(shape: btConvexShape);
        buildHull(margin: number): boolean;
        numVertices(): number;
        getVertexPointer(): btVector3;
    }
    class btCompoundShape extends btCollisionShape {
        constructor(enableDynamicAabbTree?: boolean);
        addChildShape(localTransform: btTransform, shape: btCollisionShape): void;
        removeChildShape(shape: btCollisionShape): void;
        removeChildShapeByIndex(childShapeindex: number): void;
        getNumChildShapes(): number;
        getChildShape(index: number): btCollisionShape;
        updateChildTransform(childIndex: number, newChildTransform: btTransform, shouldRecalculateLocalAabb?: boolean): void;
        setMargin(margin: number): void;
        getMargin(): number;
    }
    class btStridingMeshInterface {
        setScaling(scaling: btVector3): void;
    }
    class btIndexedMesh {
        get_m_numTriangles(): number;
        set_m_numTriangles(m_numTriangles: number): void;
        m_numTriangles: number;
    }
    class btIndexedMeshArray {
        size(): number;
        at(n: number): btIndexedMesh;
    }
    class btTriangleMesh extends btStridingMeshInterface {
        constructor(use32bitIndices?: boolean, use4componentVertices?: boolean);
        addTriangle(vertex0: btVector3, vertex1: btVector3, vertex2: btVector3, removeDuplicateVertices?: boolean): void;
        addTriangleIndices(index1: number, index2: number, index3: number): void;
        findOrAddVertex(vertex: btVector3, removeDuplicateVertices: boolean): number;
        addIndex(index: number): void;
        getIndexedMeshArray(): btIndexedMeshArray;
    }
    type PHY_ScalarType = "PHY_FLOAT" | "PHY_DOUBLE" | "PHY_INTEGER" | "PHY_SHORT" | "PHY_FIXEDPOINT88" | "PHY_UCHAR";
    class btTriangleCallback {
        processTriangle(triangle: btVector3, partId: number, triangleIndex: number): void;
    }
    class btTriangleCallback_implJS {
        processTriangle(triangle: btVector3, partId: number, triangleIndex: number): void;
    }
    class btConcaveShape extends btCollisionShape {
    }
    class btEmptyShape extends btConcaveShape {
        constructor();
    }
    class btStaticPlaneShape extends btConcaveShape {
        constructor(planeNormal: btVector3, planeConstant: number);
    }
    class btTriangleMeshShape extends btConcaveShape {
    }
    class btBvhTriangleMeshShape extends btTriangleMeshShape {
        constructor(meshInterface: btStridingMeshInterface, useQuantizedAabbCompression: boolean, buildBvh?: boolean);
        performRaycast(callback: btTriangleCallback, raySource: btVector3, rayTarget: btVector3): void;
    }
    class btHeightfieldTerrainShape extends btConcaveShape {
        constructor(heightStickWidth: number, heightStickLength: number, heightfieldData: unknown, heightScale: number, minHeight: number, maxHeight: number, upAxis: number, hdt: PHY_ScalarType, flipQuadEdges: boolean);
        setMargin(margin: number): void;
        getMargin(): number;
    }
    class btAABB {
        constructor(V1: btVector3, V2: btVector3, V3: btVector3, margin: number);
        invalidate(): void;
        increment_margin(margin: number): void;
        copy_with_margin(other: btAABB, margin: number): void;
    }
    class btPrimitiveTriangle {
        constructor();
    }
    class btTriangleShapeEx {
        constructor(p1: btVector3, p2: btVector3, p3: btVector3);
        getAabb(t: btTransform, aabbMin: btVector3, aabbMax: btVector3): void;
        applyTransform(t: btTransform): void;
    }
    class btPrimitiveManagerBase {
        is_trimesh(): boolean;
        get_primitive_count(): number;
        get_primitive_box(prim_index: number, primbox: btAABB): void;
        get_primitive_triangle(prim_index: number, triangle: btPrimitiveTriangle): void;
    }
    type eGIMPACT_SHAPE_TYPE = "CONST_GIMPACT_COMPOUND_SHAPE" | "CONST_GIMPACT_TRIMESH_SHAPE_PART" | "CONST_GIMPACT_TRIMESH_SHAPE";
    class btTetrahedronShapeEx {
        constructor();
        setVertices(v0: btVector3, v1: btVector3, v2: btVector3, v3: btVector3): void;
    }
    class btGImpactShapeInterface extends btConcaveShape {
        updateBound(): void;
        postUpdate(): void;
        getShapeType(): number;
        getName(): string;
        getGImpactShapeType(): eGIMPACT_SHAPE_TYPE;
        getPrimitiveManager(): btPrimitiveManagerBase;
        getNumChildShapes(): number;
        childrenHasTransform(): boolean;
        needsRetrieveTriangles(): boolean;
        needsRetrieveTetrahedrons(): boolean;
        getBulletTriangle(prim_index: number, triangle: btTriangleShapeEx): void;
        getBulletTetrahedron(prim_index: number, tetrahedron: btTetrahedronShapeEx): void;
        getChildShape(index: number): btCollisionShape;
        getChildTransform(index: number): btTransform;
        setChildTransform(index: number, transform: btTransform): void;
    }
    class CompoundPrimitiveManager extends btPrimitiveManagerBase {
        get_m_compoundShape(): btGImpactCompoundShape;
        set_m_compoundShape(m_compoundShape: btGImpactCompoundShape): void;
        m_compoundShape: btGImpactCompoundShape;
        get_primitive_count(): number;
        get_primitive_box(prim_index: number, primbox: btAABB): void;
        get_primitive_triangle(prim_index: number, triangle: btPrimitiveTriangle): void;
    }
    class btGImpactCompoundShape extends btGImpactShapeInterface {
        constructor(children_has_transform?: boolean);
        childrenHasTransform(): boolean;
        getPrimitiveManager(): btPrimitiveManagerBase;
        getCompoundPrimitiveManager(): CompoundPrimitiveManager;
        getNumChildShapes(): number;
        addChildShape(localTransform: btTransform, shape: btCollisionShape): void;
        getChildShape(index: number): btCollisionShape;
        getChildAabb(child_index: number, t: btTransform, aabbMin: btVector3, aabbMax: btVector3): void;
        getChildTransform(index: number): btTransform;
        setChildTransform(index: number, transform: btTransform): void;
        calculateLocalInertia(mass: number, inertia: btVector3): void;
        getName(): string;
        getGImpactShapeType(): eGIMPACT_SHAPE_TYPE;
    }
    class TrimeshPrimitiveManager extends btPrimitiveManagerBase {
        get_m_margin(): number;
        set_m_margin(m_margin: number): void;
        m_margin: number;
        get_m_meshInterface(): btStridingMeshInterface;
        set_m_meshInterface(m_meshInterface: btStridingMeshInterface): void;
        m_meshInterface: btStridingMeshInterface;
        get_m_part(): number;
        set_m_part(m_part: number): void;
        m_part: number;
        get_m_lock_count(): number;
        set_m_lock_count(m_lock_count: number): void;
        m_lock_count: number;
        get_numverts(): number;
        set_numverts(numverts: number): void;
        numverts: number;
        get_type(): PHY_ScalarType;
        set_type(type: PHY_ScalarType): void;
        type: PHY_ScalarType;
        get_stride(): number;
        set_stride(stride: number): void;
        stride: number;
        get_indexstride(): number;
        set_indexstride(indexstride: number): void;
        indexstride: number;
        get_numfaces(): number;
        set_numfaces(numfaces: number): void;
        numfaces: number;
        get_indicestype(): PHY_ScalarType;
        set_indicestype(indicestype: PHY_ScalarType): void;
        indicestype: PHY_ScalarType;
        constructor(manager?: TrimeshPrimitiveManager);
        lock(): void;
        unlock(): void;
        is_trimesh(): boolean;
        get_vertex_count(): number;
        get_indices(face_index: number, i0: number, i1: number, i2: number): void;
        get_vertex(vertex_index: number, vertex: btVector3): void;
        get_bullet_triangle(prim_index: number, triangle: btTriangleShapeEx): void;
    }
    class btGImpactMeshShapePart extends btGImpactShapeInterface {
        constructor(meshInterface: btStridingMeshInterface, part: number);
        getTrimeshPrimitiveManager(): TrimeshPrimitiveManager;
        getVertexCount(): number;
        getVertex(vertex_index: number, vertex: btVector3): void;
        getPart(): number;
    }
    class btGImpactMeshShape extends btGImpactShapeInterface {
        constructor(meshInterface: btStridingMeshInterface);
        getMeshInterface(): btStridingMeshInterface;
        getMeshPartCount(): number;
        getMeshPart(index: number): btGImpactMeshShapePart;
        calculateSerializeBufferSize(): number;
    }
    class btCollisionAlgorithmConstructionInfo {
        constructor();
        constructor(dispatcher: btDispatcher, temp: number);
        get_m_dispatcher1(): btDispatcher;
        set_m_dispatcher1(m_dispatcher1: btDispatcher): void;
        m_dispatcher1: btDispatcher;
        get_m_manifold(): btPersistentManifold;
        set_m_manifold(m_manifold: btPersistentManifold): void;
        m_manifold: btPersistentManifold;
    }
    class btCollisionAlgorithm {
    }
    class btActivatingCollisionAlgorithm extends btCollisionAlgorithm {
    }
    class btGImpactCollisionAlgorithm extends btActivatingCollisionAlgorithm {
        constructor(ci: btCollisionAlgorithmConstructionInfo, body0Wrap: btCollisionObjectWrapper, body1Wrap: btCollisionObjectWrapper);
        registerAlgorithm(dispatcher: btCollisionDispatcher): void;
    }
    class btDefaultCollisionConstructionInfo {
        constructor();
    }
    class btDefaultCollisionConfiguration {
        constructor(info?: btDefaultCollisionConstructionInfo);
    }
    class btPersistentManifold {
        constructor();
        getBody0(): btCollisionObject;
        getBody1(): btCollisionObject;
        getNumContacts(): number;
        getContactPoint(index: number): btManifoldPoint;
    }
    class btDispatcher {
        getNumManifolds(): number;
        getManifoldByIndexInternal(index: number): btPersistentManifold;
    }
    class btCollisionDispatcher extends btDispatcher {
        constructor(conf: btDefaultCollisionConfiguration);
    }
    class btOverlappingPairCallback {
    }
    class btOverlappingPairCache {
        setInternalGhostPairCallback(ghostPairCallback: btOverlappingPairCallback): void;
        getNumOverlappingPairs(): number;
    }
    class btAxisSweep3 {
        constructor(worldAabbMin: btVector3, worldAabbMax: btVector3, maxHandles?: number, pairCache?: btOverlappingPairCache, disableRaycastAccelerator?: boolean);
    }
    class btBroadphaseInterface {
        getOverlappingPairCache(): btOverlappingPairCache;
    }
    class btCollisionConfiguration {
    }
    class btDbvtBroadphase {
        constructor();
    }
    class btBroadphaseProxy {
        get_m_collisionFilterGroup(): number;
        set_m_collisionFilterGroup(m_collisionFilterGroup: number): void;
        m_collisionFilterGroup: number;
        get_m_collisionFilterMask(): number;
        set_m_collisionFilterMask(m_collisionFilterMask: number): void;
        m_collisionFilterMask: number;
    }
    class btRigidBodyConstructionInfo {
        constructor(mass: number, motionState: btMotionState, collisionShape: btCollisionShape, localInertia?: btVector3);
        get_m_linearDamping(): number;
        set_m_linearDamping(m_linearDamping: number): void;
        m_linearDamping: number;
        get_m_angularDamping(): number;
        set_m_angularDamping(m_angularDamping: number): void;
        m_angularDamping: number;
        get_m_friction(): number;
        set_m_friction(m_friction: number): void;
        m_friction: number;
        get_m_rollingFriction(): number;
        set_m_rollingFriction(m_rollingFriction: number): void;
        m_rollingFriction: number;
        get_m_restitution(): number;
        set_m_restitution(m_restitution: number): void;
        m_restitution: number;
        get_m_linearSleepingThreshold(): number;
        set_m_linearSleepingThreshold(m_linearSleepingThreshold: number): void;
        m_linearSleepingThreshold: number;
        get_m_angularSleepingThreshold(): number;
        set_m_angularSleepingThreshold(m_angularSleepingThreshold: number): void;
        m_angularSleepingThreshold: number;
        get_m_additionalDamping(): boolean;
        set_m_additionalDamping(m_additionalDamping: boolean): void;
        m_additionalDamping: boolean;
        get_m_additionalDampingFactor(): number;
        set_m_additionalDampingFactor(m_additionalDampingFactor: number): void;
        m_additionalDampingFactor: number;
        get_m_additionalLinearDampingThresholdSqr(): number;
        set_m_additionalLinearDampingThresholdSqr(m_additionalLinearDampingThresholdSqr: number): void;
        m_additionalLinearDampingThresholdSqr: number;
        get_m_additionalAngularDampingThresholdSqr(): number;
        set_m_additionalAngularDampingThresholdSqr(m_additionalAngularDampingThresholdSqr: number): void;
        m_additionalAngularDampingThresholdSqr: number;
        get_m_additionalAngularDampingFactor(): number;
        set_m_additionalAngularDampingFactor(m_additionalAngularDampingFactor: number): void;
        m_additionalAngularDampingFactor: number;
    }
    class btRigidBody extends btCollisionObject {
        constructor(constructionInfo: btRigidBodyConstructionInfo);
        getCenterOfMassTransform(): btTransform;
        setCenterOfMassTransform(xform: btTransform): void;
        setSleepingThresholds(linear: number, angular: number): void;
        getLinearSleepingThreshold(): number;
        getAngularSleepingThreshold(): number;
        getLinearDamping(): number;
        getAngularDamping(): number;
        setDamping(lin_damping: number, ang_damping: number): void;
        applyDamping(timeStep: number): void;
        setMassProps(mass: number, inertia: btVector3): void;
        getInvMass(): number;
        getMass(): number;
        getLinearFactor(): btVector3;
        setLinearFactor(linearFactor: btVector3): void;
        applyTorque(torque: btVector3): void;
        applyForce(force: btVector3, rel_pos: btVector3): void;
        applyCentralImpulse(impulse: btVector3): void;
        applyTorqueImpulse(torque: btVector3): void;
        applyImpulse(impulse: btVector3, rel_pos: btVector3): void;
        applyPushImpulse(impulse: btVector3, rel_pos: btVector3): void;
        getPushVelocity(): btVector3;
        getTurnVelocity(): btVector3;
        setPushVelocity(v: btVector3): void;
        setTurnVelocity(v: btVector3): void;
        applyCentralPushImpulse(impulse: btVector3): void;
        applyTorqueTurnImpulse(torque: btVector3): void;
        getCenterOfMassPosition(): btVector3;
        getOrientation(): btQuaternion;
        getTotalForce(): btVector3;
        getTotalTorque(): btVector3;
        getInvInertiaDiagLocal(): btVector3;
        setInvInertiaDiagLocal(diagInvInertia: btVector3): void;
        updateInertiaTensor(): void;
        getLinearVelocity(): btVector3;
        getAngularVelocity(): btVector3;
        setLinearVelocity(lin_vel: btVector3): void;
        setAngularVelocity(ang_vel: btVector3): void;
        getVelocityInLocalPoint(rel_pos: btVector3): btVector3;
        getPushVelocityInLocalPoint(rel_pos: btVector3): btVector3;
        translate(v: btVector3): void;
        getMotionState(): btMotionState;
        setMotionState(motionState: btMotionState): void;
        getAngularFactor(): btVector3;
        setAngularFactor(angularFactor: btVector3): void;
        upcast(colObj: btCollisionObject): btRigidBody;
        getAabb(aabbMin: btVector3, aabbMax: btVector3): void;
        applyGravity(): void;
        clearGravity(): void;
        getGravity(): btVector3;
        setGravity(acceleration: btVector3): void;
        getBroadphaseProxy(): btBroadphaseProxy;
        clearForces(): void;
        setFlags(flags: number): void;
        getFlags(): number;
    }
    class btSolverBody {
        get_m_worldTransform(): btTransform;
        set_m_worldTransform(m_worldTransform: btTransform): void;
        m_worldTransform: btTransform;
        get_m_deltaLinearVelocity(): btVector3;
        set_m_deltaLinearVelocity(m_deltaLinearVelocity: btVector3): void;
        m_deltaLinearVelocity: btVector3;
        get_m_deltaAngularVelocity(): btVector3;
        set_m_deltaAngularVelocity(m_deltaAngularVelocity: btVector3): void;
        m_deltaAngularVelocity: btVector3;
        get_m_angularFactor(): btVector3;
        set_m_angularFactor(m_angularFactor: btVector3): void;
        m_angularFactor: btVector3;
        get_m_linearFactor(): btVector3;
        set_m_linearFactor(m_linearFactor: btVector3): void;
        m_linearFactor: btVector3;
        get_m_invMass(): btVector3;
        set_m_invMass(m_invMass: btVector3): void;
        m_invMass: btVector3;
        get_m_pushVelocity(): btVector3;
        set_m_pushVelocity(m_pushVelocity: btVector3): void;
        m_pushVelocity: btVector3;
        get_m_turnVelocity(): btVector3;
        set_m_turnVelocity(m_turnVelocity: btVector3): void;
        m_turnVelocity: btVector3;
        get_m_linearVelocity(): btVector3;
        set_m_linearVelocity(m_linearVelocity: btVector3): void;
        m_linearVelocity: btVector3;
        get_m_angularVelocity(): btVector3;
        set_m_angularVelocity(m_angularVelocity: btVector3): void;
        m_angularVelocity: btVector3;
        get_m_externalForceImpulse(): btVector3;
        set_m_externalForceImpulse(m_externalForceImpulse: btVector3): void;
        m_externalForceImpulse: btVector3;
        get_m_externalTorqueImpulse(): btVector3;
        set_m_externalTorqueImpulse(m_externalTorqueImpulse: btVector3): void;
        m_externalTorqueImpulse: btVector3;
        get_m_originalBody(): btRigidBody;
        set_m_originalBody(m_originalBody: btRigidBody): void;
        m_originalBody: btRigidBody;
        setWorldTransform(worldTransform: btTransform): void;
        getWorldTransform(): btTransform;
        getVelocityInLocalPointNoDelta(rel_pos: btVector3, velocity: btVector3): void;
        getVelocityInLocalPointObsolete(rel_pos: btVector3, velocity: btVector3): void;
        getAngularVelocity(angVel: btVector3): void;
        applyImpulse(linearComponent: btVector3, angularComponent: btVector3, impulseMagnitude: number): void;
        internalApplyPushImpulse(linearComponent: btVector3, angularComponent: btVector3, impulseMagnitude: number): void;
        getDeltaLinearVelocity(): btVector3;
        getDeltaAngularVelocity(): btVector3;
        getPushVelocity(): btVector3;
        getTurnVelocity(): btVector3;
    }
    class btSolverBodyArray {
        size(): number;
        at(n: number): btSolverBody;
    }
    class btConstraintSetting {
        constructor();
        get_m_tau(): number;
        set_m_tau(m_tau: number): void;
        m_tau: number;
        get_m_damping(): number;
        set_m_damping(m_damping: number): void;
        m_damping: number;
        get_m_impulseClamp(): number;
        set_m_impulseClamp(m_impulseClamp: number): void;
        m_impulseClamp: number;
    }
    class btJointFeedback {
        get_m_appliedForceBodyA(): btVector3;
        set_m_appliedForceBodyA(m_appliedForceBodyA: btVector3): void;
        m_appliedForceBodyA: btVector3;
        get_m_appliedTorqueBodyA(): btVector3;
        set_m_appliedTorqueBodyA(m_appliedTorqueBodyA: btVector3): void;
        m_appliedTorqueBodyA: btVector3;
        get_m_appliedForceBodyB(): btVector3;
        set_m_appliedForceBodyB(m_appliedForceBodyB: btVector3): void;
        m_appliedForceBodyB: btVector3;
        get_m_appliedTorqueBodyB(): btVector3;
        set_m_appliedTorqueBodyB(m_appliedTorqueBodyB: btVector3): void;
        m_appliedTorqueBodyB: btVector3;
    }
    class btTypedConstraint {
        getOverrideNumSolverIterations(): number;
        setOverrideNumSolverIterations(overideNumIterations: number): void;
        enableFeedback(needsFeedback: boolean): void;
        needsFeedback(): boolean;
        setJointFeedback(jointFeedback: btJointFeedback): void;
        getJointFeedback(): btJointFeedback;
        getAppliedImpulse(): number;
        getConstraintType(): btTypedConstraintType;
        getBreakingImpulseThreshold(): number;
        setBreakingImpulseThreshold(threshold: number): void;
        getParam(num: number, axis: number): number;
        setParam(num: number, value: number, axis: number): void;
        isEnabled(): boolean;
        setEnabled(enabled: boolean): void;
        getRigidBodyA(): btRigidBody;
        getRigidBodyB(): btRigidBody;
        getUserConstraintType(): number;
        setUserConstraintType(userConstraintType: number): void;
        getFixedBody(): btRigidBody;
    }
    type btTypedConstraintType = "POINT2POINT_CONSTRAINT_TYPE" | "HINGE_CONSTRAINT_TYPE" | "CONETWIST_CONSTRAINT_TYPE" | "D6_CONSTRAINT_TYPE" | "SLIDER_CONSTRAINT_TYPE" | "CONTACT_CONSTRAINT_TYPE" | "D6_SPRING_CONSTRAINT_TYPE" | "GEAR_CONSTRAINT_TYPE" | "FIXED_CONSTRAINT_TYPE" | "MAX_CONSTRAINT_TYPE";
    type btConstraintParams = "BT_CONSTRAINT_ERP" | "BT_CONSTRAINT_STOP_ERP" | "BT_CONSTRAINT_CFM" | "BT_CONSTRAINT_STOP_CFM";
    class btPoint2PointConstraint extends btTypedConstraint {
        constructor(rbA: btRigidBody, rbB: btRigidBody, pivotInA: btVector3, pivotInB: btVector3);
        constructor(rbA: btRigidBody, pivotInA: btVector3);
        setPivotA(pivotA: btVector3): void;
        setPivotB(pivotB: btVector3): void;
        getPivotInA(): btVector3;
        getPivotInB(): btVector3;
        get_m_setting(): btConstraintSetting;
        set_m_setting(m_setting: btConstraintSetting): void;
        m_setting: btConstraintSetting;
    }
    class btGeneric6DofConstraint extends btTypedConstraint {
        constructor(rbA: btRigidBody, rbB: btRigidBody, frameInA: btTransform, frameInB: btTransform, useLinearFrameReferenceFrameA: boolean);
        constructor(rbB: btRigidBody, frameInB: btTransform, useLinearFrameReferenceFrameB: boolean);
        setLinearLowerLimit(linearLower: btVector3): void;
        setLinearUpperLimit(linearUpper: btVector3): void;
        setAngularLowerLimit(angularLower: btVector3): void;
        setAngularUpperLimit(angularUpper: btVector3): void;
        getFrameOffsetA(): btTransform;
    }
    class btGeneric6DofSpringConstraint extends btGeneric6DofConstraint {
        constructor(rbA: btRigidBody, rbB: btRigidBody, frameInA: btTransform, frameInB: btTransform, useLinearFrameReferenceFrameA: boolean);
        constructor(rbB: btRigidBody, frameInB: btTransform, useLinearFrameReferenceFrameB: boolean);
        enableSpring(index: number, onOff: boolean): void;
        setStiffness(index: number, stiffness: number): void;
        setDamping(index: number, damping: number): void;
        setEquilibriumPoint(index: number, val: number): void;
        setEquilibriumPoint(index: number): void;
        setEquilibriumPoint(): void;
    }
    class btSequentialImpulseConstraintSolver {
        constructor();
    }
    class btConeTwistConstraint extends btTypedConstraint {
        constructor(rbA: btRigidBody, rbB: btRigidBody, rbAFrame: btTransform, rbBFrame: btTransform);
        constructor(rbA: btRigidBody, rbAFrame: btTransform);
        setLimit(limitIndex: number, limitValue: number): void;
        setAngularOnly(angularOnly: boolean): void;
        setDamping(damping: number): void;
        enableMotor(b: boolean): void;
        setMaxMotorImpulse(maxMotorImpulse: number): void;
        setMaxMotorImpulseNormalized(maxMotorImpulse: number): void;
        setMotorTarget(q: btQuaternion): void;
        setMotorTargetInConstraintSpace(q: btQuaternion): void;
    }
    class btHingeConstraint extends btTypedConstraint {
        constructor(rbA: btRigidBody, rbB: btRigidBody, pivotInA: btVector3, pivotInB: btVector3, axisInA: btVector3, axisInB: btVector3, useReferenceFrameA?: boolean);
        constructor(rbA: btRigidBody, rbB: btRigidBody, rbAFrame: btTransform, rbBFrame: btTransform, useReferenceFrameA?: boolean);
        constructor(rbA: btRigidBody, rbAFrame: btTransform, useReferenceFrameA?: boolean);
        getHingeAngle(): number;
        setLimit(low: number, high: number, softness: number, biasFactor: number, relaxationFactor?: number): void;
        enableAngularMotor(enableMotor: boolean, targetVelocity: number, maxMotorImpulse: number): void;
        setAngularOnly(angularOnly: boolean): void;
        enableMotor(enableMotor: boolean): void;
        setMaxMotorImpulse(maxMotorImpulse: number): void;
        setMotorTarget(targetAngle: number, dt: number): void;
    }
    class btSliderConstraint extends btTypedConstraint {
        constructor(rbA: btRigidBody, rbB: btRigidBody, frameInA: btTransform, frameInB: btTransform, useLinearReferenceFrameA: boolean);
        constructor(rbB: btRigidBody, frameInB: btTransform, useLinearReferenceFrameA: boolean);
        getLinearPos(): number;
        getAngularPos(): number;
        setLowerLinLimit(lowerLimit: number): void;
        setUpperLinLimit(upperLimit: number): void;
        setLowerAngLimit(lowerAngLimit: number): void;
        setUpperAngLimit(upperAngLimit: number): void;
        setPoweredLinMotor(onOff: boolean): void;
        setMaxLinMotorForce(maxLinMotorForce: number): void;
        setTargetLinMotorVelocity(targetLinMotorVelocity: number): void;
    }
    class btFixedConstraint extends btTypedConstraint {
        constructor(rbA: btRigidBody, rbB: btRigidBody, frameInA: btTransform, frameInB: btTransform);
    }
    type btConstraintSolverType = "BT_SEQUENTIAL_IMPULSE_SOLVER" | "BT_MLCP_SOLVER";
    class btConstraintSolver {
    }
    class btDispatcherInfo {
        get_m_timeStep(): number;
        set_m_timeStep(m_timeStep: number): void;
        m_timeStep: number;
        get_m_stepCount(): number;
        set_m_stepCount(m_stepCount: number): void;
        m_stepCount: number;
        get_m_dispatchFunc(): number;
        set_m_dispatchFunc(m_dispatchFunc: number): void;
        m_dispatchFunc: number;
        get_m_timeOfImpact(): number;
        set_m_timeOfImpact(m_timeOfImpact: number): void;
        m_timeOfImpact: number;
        get_m_useContinuous(): boolean;
        set_m_useContinuous(m_useContinuous: boolean): void;
        m_useContinuous: boolean;
        get_m_enableSatConvex(): boolean;
        set_m_enableSatConvex(m_enableSatConvex: boolean): void;
        m_enableSatConvex: boolean;
        get_m_enableSPU(): boolean;
        set_m_enableSPU(m_enableSPU: boolean): void;
        m_enableSPU: boolean;
        get_m_useEpa(): boolean;
        set_m_useEpa(m_useEpa: boolean): void;
        m_useEpa: boolean;
        get_m_allowedCcdPenetration(): number;
        set_m_allowedCcdPenetration(m_allowedCcdPenetration: number): void;
        m_allowedCcdPenetration: number;
        get_m_useConvexConservativeDistanceUtil(): boolean;
        set_m_useConvexConservativeDistanceUtil(m_useConvexConservativeDistanceUtil: boolean): void;
        m_useConvexConservativeDistanceUtil: boolean;
        get_m_convexConservativeDistanceThreshold(): number;
        set_m_convexConservativeDistanceThreshold(m_convexConservativeDistanceThreshold: number): void;
        m_convexConservativeDistanceThreshold: number;
    }
    class btCollisionWorld {
        getDispatcher(): btDispatcher;
        rayTest(rayFromWorld: btVector3, rayToWorld: btVector3, resultCallback: RayResultCallback): void;
        getPairCache(): btOverlappingPairCache;
        getDispatchInfo(): btDispatcherInfo;
        addCollisionObject(collisionObject: btCollisionObject, collisionFilterGroup?: number, collisionFilterMask?: number): void;
        removeCollisionObject(collisionObject: btCollisionObject): void;
        getBroadphase(): btBroadphaseInterface;
        convexSweepTest(castShape: btConvexShape, from: btTransform, to: btTransform, resultCallback: ConvexResultCallback, allowedCcdPenetration: number): void;
        contactPairTest(colObjA: btCollisionObject, colObjB: btCollisionObject, resultCallback: ContactResultCallback): void;
        contactTest(colObj: btCollisionObject, resultCallback: ContactResultCallback): void;
        updateSingleAabb(colObj: btCollisionObject): void;
        setDebugDrawer(debugDrawer: btIDebugDraw): void;
        getDebugDrawer(): btIDebugDraw;
        debugDrawWorld(): void;
        debugDrawObject(worldTransform: btTransform, shape: btCollisionShape, color: btVector3): void;
    }
    class btContactSolverInfo {
        get_m_splitImpulse(): boolean;
        set_m_splitImpulse(m_splitImpulse: boolean): void;
        m_splitImpulse: boolean;
        get_m_splitImpulsePenetrationThreshold(): number;
        set_m_splitImpulsePenetrationThreshold(m_splitImpulsePenetrationThreshold: number): void;
        m_splitImpulsePenetrationThreshold: number;
        get_m_numIterations(): number;
        set_m_numIterations(m_numIterations: number): void;
        m_numIterations: number;
    }
    class btDynamicsWorld extends btCollisionWorld {
        addAction(action: btActionInterface): void;
        removeAction(action: btActionInterface): void;
        getSolverInfo(): btContactSolverInfo;
    }
    class btDiscreteDynamicsWorld extends btDynamicsWorld {
        constructor(dispatcher: btDispatcher, pairCache: btBroadphaseInterface, constraintSolver: btConstraintSolver, collisionConfiguration: btCollisionConfiguration);
        setGravity(gravity: btVector3): void;
        getGravity(): btVector3;
        addRigidBody(body: btRigidBody): void;
        addRigidBody(body: btRigidBody, group: number, mask: number): void;
        removeRigidBody(body: btRigidBody): void;
        addConstraint(constraint: btTypedConstraint, disableCollisionsBetweenLinkedBodies?: boolean): void;
        removeConstraint(constraint: btTypedConstraint): void;
        stepSimulation(timeStep: number, maxSubSteps?: number, fixedTimeStep?: number): number;
    }
    class btVehicleTuning {
        constructor();
        get_m_suspensionStiffness(): number;
        set_m_suspensionStiffness(m_suspensionStiffness: number): void;
        m_suspensionStiffness: number;
        get_m_suspensionCompression(): number;
        set_m_suspensionCompression(m_suspensionCompression: number): void;
        m_suspensionCompression: number;
        get_m_suspensionDamping(): number;
        set_m_suspensionDamping(m_suspensionDamping: number): void;
        m_suspensionDamping: number;
        get_m_maxSuspensionTravelCm(): number;
        set_m_maxSuspensionTravelCm(m_maxSuspensionTravelCm: number): void;
        m_maxSuspensionTravelCm: number;
        get_m_frictionSlip(): number;
        set_m_frictionSlip(m_frictionSlip: number): void;
        m_frictionSlip: number;
        get_m_maxSuspensionForce(): number;
        set_m_maxSuspensionForce(m_maxSuspensionForce: number): void;
        m_maxSuspensionForce: number;
    }
    class btVehicleRaycasterResult {
        get_m_hitPointInWorld(): btVector3;
        set_m_hitPointInWorld(m_hitPointInWorld: btVector3): void;
        m_hitPointInWorld: btVector3;
        get_m_hitNormalInWorld(): btVector3;
        set_m_hitNormalInWorld(m_hitNormalInWorld: btVector3): void;
        m_hitNormalInWorld: btVector3;
        get_m_distFraction(): number;
        set_m_distFraction(m_distFraction: number): void;
        m_distFraction: number;
    }
    class btVehicleRaycaster {
        get_m_collisionFilterGroup(): number;
        set_m_collisionFilterGroup(m_collisionFilterGroup: number): void;
        m_collisionFilterGroup: number;
        get_m_collisionFilterMask(): number;
        set_m_collisionFilterMask(m_collisionFilterMask: number): void;
        m_collisionFilterMask: number;
        castRay(from: btVector3, to: btVector3, result: btVehicleRaycasterResult): void;
    }
    class btDefaultVehicleRaycaster extends btVehicleRaycaster {
        constructor(world: btDynamicsWorld);
    }
    class RaycastInfo {
        get_m_contactNormalWS(): btVector3;
        set_m_contactNormalWS(m_contactNormalWS: btVector3): void;
        m_contactNormalWS: btVector3;
        get_m_contactPointWS(): btVector3;
        set_m_contactPointWS(m_contactPointWS: btVector3): void;
        m_contactPointWS: btVector3;
        get_m_suspensionLength(): number;
        set_m_suspensionLength(m_suspensionLength: number): void;
        m_suspensionLength: number;
        get_m_hardPointWS(): btVector3;
        set_m_hardPointWS(m_hardPointWS: btVector3): void;
        m_hardPointWS: btVector3;
        get_m_wheelDirectionWS(): btVector3;
        set_m_wheelDirectionWS(m_wheelDirectionWS: btVector3): void;
        m_wheelDirectionWS: btVector3;
        get_m_wheelAxleWS(): btVector3;
        set_m_wheelAxleWS(m_wheelAxleWS: btVector3): void;
        m_wheelAxleWS: btVector3;
        get_m_isInContact(): boolean;
        set_m_isInContact(m_isInContact: boolean): void;
        m_isInContact: boolean;
        get_m_groundObject(): any;
        set_m_groundObject(m_groundObject: any): void;
        m_groundObject: any;
    }
    class btWheelInfoConstructionInfo {
        get_m_chassisConnectionCS(): btVector3;
        set_m_chassisConnectionCS(m_chassisConnectionCS: btVector3): void;
        m_chassisConnectionCS: btVector3;
        get_m_wheelDirectionCS(): btVector3;
        set_m_wheelDirectionCS(m_wheelDirectionCS: btVector3): void;
        m_wheelDirectionCS: btVector3;
        get_m_wheelAxleCS(): btVector3;
        set_m_wheelAxleCS(m_wheelAxleCS: btVector3): void;
        m_wheelAxleCS: btVector3;
        get_m_suspensionRestLength(): number;
        set_m_suspensionRestLength(m_suspensionRestLength: number): void;
        m_suspensionRestLength: number;
        get_m_maxSuspensionTravelCm(): number;
        set_m_maxSuspensionTravelCm(m_maxSuspensionTravelCm: number): void;
        m_maxSuspensionTravelCm: number;
        get_m_wheelRadius(): number;
        set_m_wheelRadius(m_wheelRadius: number): void;
        m_wheelRadius: number;
        get_m_suspensionStiffness(): number;
        set_m_suspensionStiffness(m_suspensionStiffness: number): void;
        m_suspensionStiffness: number;
        get_m_wheelsDampingCompression(): number;
        set_m_wheelsDampingCompression(m_wheelsDampingCompression: number): void;
        m_wheelsDampingCompression: number;
        get_m_wheelsDampingRelaxation(): number;
        set_m_wheelsDampingRelaxation(m_wheelsDampingRelaxation: number): void;
        m_wheelsDampingRelaxation: number;
        get_m_frictionSlip(): number;
        set_m_frictionSlip(m_frictionSlip: number): void;
        m_frictionSlip: number;
        get_m_maxSuspensionForce(): number;
        set_m_maxSuspensionForce(m_maxSuspensionForce: number): void;
        m_maxSuspensionForce: number;
        get_m_bIsFrontWheel(): boolean;
        set_m_bIsFrontWheel(m_bIsFrontWheel: boolean): void;
        m_bIsFrontWheel: boolean;
    }
    class btWheelInfo {
        get_m_suspensionStiffness(): number;
        set_m_suspensionStiffness(m_suspensionStiffness: number): void;
        m_suspensionStiffness: number;
        get_m_frictionSlip(): number;
        set_m_frictionSlip(m_frictionSlip: number): void;
        m_frictionSlip: number;
        get_m_engineForce(): number;
        set_m_engineForce(m_engineForce: number): void;
        m_engineForce: number;
        get_m_rollInfluence(): number;
        set_m_rollInfluence(m_rollInfluence: number): void;
        m_rollInfluence: number;
        get_m_suspensionRestLength1(): number;
        set_m_suspensionRestLength1(m_suspensionRestLength1: number): void;
        m_suspensionRestLength1: number;
        get_m_wheelsRadius(): number;
        set_m_wheelsRadius(m_wheelsRadius: number): void;
        m_wheelsRadius: number;
        get_m_wheelsDampingCompression(): number;
        set_m_wheelsDampingCompression(m_wheelsDampingCompression: number): void;
        m_wheelsDampingCompression: number;
        get_m_wheelsDampingRelaxation(): number;
        set_m_wheelsDampingRelaxation(m_wheelsDampingRelaxation: number): void;
        m_wheelsDampingRelaxation: number;
        get_m_steering(): number;
        set_m_steering(m_steering: number): void;
        m_steering: number;
        get_m_maxSuspensionForce(): number;
        set_m_maxSuspensionForce(m_maxSuspensionForce: number): void;
        m_maxSuspensionForce: number;
        get_m_maxSuspensionTravelCm(): number;
        set_m_maxSuspensionTravelCm(m_maxSuspensionTravelCm: number): void;
        m_maxSuspensionTravelCm: number;
        get_m_wheelsSuspensionForce(): number;
        set_m_wheelsSuspensionForce(m_wheelsSuspensionForce: number): void;
        m_wheelsSuspensionForce: number;
        get_m_bIsFrontWheel(): boolean;
        set_m_bIsFrontWheel(m_bIsFrontWheel: boolean): void;
        m_bIsFrontWheel: boolean;
        get_m_raycastInfo(): RaycastInfo;
        set_m_raycastInfo(m_raycastInfo: RaycastInfo): void;
        m_raycastInfo: RaycastInfo;
        get_m_chassisConnectionPointCS(): btVector3;
        set_m_chassisConnectionPointCS(m_chassisConnectionPointCS: btVector3): void;
        m_chassisConnectionPointCS: btVector3;
        constructor(ci: btWheelInfoConstructionInfo);
        getSuspensionRestLength(): number;
        updateWheel(chassis: btRigidBody, raycastInfo: RaycastInfo): void;
        get_m_worldTransform(): btTransform;
        set_m_worldTransform(m_worldTransform: btTransform): void;
        m_worldTransform: btTransform;
        get_m_wheelDirectionCS(): btVector3;
        set_m_wheelDirectionCS(m_wheelDirectionCS: btVector3): void;
        m_wheelDirectionCS: btVector3;
        get_m_wheelAxleCS(): btVector3;
        set_m_wheelAxleCS(m_wheelAxleCS: btVector3): void;
        m_wheelAxleCS: btVector3;
        get_m_rotation(): number;
        set_m_rotation(m_rotation: number): void;
        m_rotation: number;
        get_m_deltaRotation(): number;
        set_m_deltaRotation(m_deltaRotation: number): void;
        m_deltaRotation: number;
        get_m_brake(): number;
        set_m_brake(m_brake: number): void;
        m_brake: number;
        get_m_clippedInvContactDotSuspension(): number;
        set_m_clippedInvContactDotSuspension(m_clippedInvContactDotSuspension: number): void;
        m_clippedInvContactDotSuspension: number;
        get_m_suspensionRelativeVelocity(): number;
        set_m_suspensionRelativeVelocity(m_suspensionRelativeVelocity: number): void;
        m_suspensionRelativeVelocity: number;
        get_m_skidInfo(): number;
        set_m_skidInfo(m_skidInfo: number): void;
        m_skidInfo: number;
    }
    class btActionInterface {
        updateAction(collisionWorld: btCollisionWorld, deltaTimeStep: number): void;
    }
    class btKinematicCharacterController extends btActionInterface {
        constructor(ghostObject: btPairCachingGhostObject, convexShape: btConvexShape, stepHeight: number, up?: btVector3);
        getUp(): btVector3;
        setUp(axis: btVector3): void;
        setWalkDirection(walkDirection: btVector3): void;
        setVelocityForTimeInterval(velocity: btVector3, timeInterval: number): void;
        setAngularVelocity(velocity: btVector3): void;
        getAngularVelocity(): btVector3;
        setLinearVelocity(velocity: btVector3): void;
        getLinearVelocity(): btVector3;
        setLinearDamping(d: number): void;
        getLinearDamping(): number;
        setAngularDamping(d: number): void;
        getAngularDamping(): number;
        reset(collisionWorld: btCollisionWorld): void;
        warp(origin: btVector3): void;
        preStep(collisionWorld: btCollisionWorld): void;
        playerStep(collisionWorld: btCollisionWorld, dt: number): void;
        setStepHeight(h: number): void;
        getStepHeight(): number;
        setFallSpeed(fallSpeed: number): void;
        getFallSpeed(): number;
        setJumpSpeed(jumpSpeed: number): void;
        getJumpSpeed(): number;
        setMaxJumpHeight(maxJumpHeight: number): void;
        canJump(): boolean;
        jump(v?: btVector3): void;
        applyImpulse(v: btVector3): void;
        setGravity(gravity: btVector3): void;
        getGravity(): btVector3;
        setMaxSlope(slopeRadians: number): void;
        getMaxSlope(): number;
        setMaxPenetrationDepth(d: number): void;
        getMaxPenetrationDepth(): number;
        getGhostObject(): btPairCachingGhostObject;
        setUseGhostSweepTest(useGhostObjectSweepTest: boolean): void;
        onGround(): boolean;
        setUpInterpolate(value: boolean): void;
    }
    class btRaycastVehicle extends btActionInterface {
        constructor(tuning: btVehicleTuning, chassis: btRigidBody, raycaster: btVehicleRaycaster);
        applyEngineForce(force: number, wheel: number): void;
        setSteeringValue(steering: number, wheel: number): void;
        getWheelTransformWS(wheelIndex: number): btTransform;
        updateWheelTransform(wheelIndex: number, interpolatedTransform: boolean): void;
        addWheel(connectionPointCS0: btVector3, wheelDirectionCS0: btVector3, wheelAxleCS: btVector3, suspensionRestLength: number, wheelRadius: number, tuning: btVehicleTuning, isFrontWheel: boolean): btWheelInfo;
        getNumWheels(): number;
        getRigidBody(): btRigidBody;
        getWheelInfo(index: number): btWheelInfo;
        setBrake(brake: number, wheelIndex: number): void;
        setCoordinateSystem(rightIndex: number, upIndex: number, forwardIndex: number): void;
        getCurrentSpeedKmHour(): number;
        getChassisWorldTransform(): btTransform;
        rayCast(wheel: btWheelInfo): number;
        updateVehicle(step: number): void;
        resetSuspension(): void;
        getSteeringValue(wheel: number): number;
        updateWheelTransformsWS(wheel: btWheelInfo, interpolatedTransform?: boolean): void;
        setPitchControl(pitch: number): void;
        updateSuspension(deltaTime: number): void;
        updateFriction(timeStep: number): void;
        getRightAxis(): number;
        getUpAxis(): number;
        getForwardAxis(): number;
        getForwardVector(): btVector3;
        getUserConstraintType(): number;
        setUserConstraintType(userConstraintType: number): void;
        setUserConstraintId(uid: number): void;
        getUserConstraintId(): number;
    }
    class btGhostObject extends btCollisionObject {
        constructor();
        getNumOverlappingObjects(): number;
        getOverlappingObject(index: number): btCollisionObject;
    }
    class btPairCachingGhostObject extends btGhostObject {
        constructor();
    }
    class btGhostPairCallback {
        constructor();
    }
    type btMultibodyLink_eFeatherstoneJointType = "btMultibodyLink::eRevolute" | "btMultibodyLink::ePrismatic" | "btMultibodyLink::eSpherical" | "btMultibodyLink::ePlanar" | "btMultibodyLink::eFixed" | "btMultibodyLink::eInvalid";
    class btMultibodyLink {
        get_m_mass(): number;
        set_m_mass(m_mass: number): void;
        m_mass: number;
        get_m_inertiaLocal(): btVector3;
        set_m_inertiaLocal(m_inertiaLocal: btVector3): void;
        m_inertiaLocal: btVector3;
        get_m_parent(): number;
        set_m_parent(m_parent: number): void;
        m_parent: number;
        get_m_zeroRotParentToThis(): btQuaternion;
        set_m_zeroRotParentToThis(m_zeroRotParentToThis: btQuaternion): void;
        m_zeroRotParentToThis: btQuaternion;
        get_m_dVector(): btVector3;
        set_m_dVector(m_dVector: btVector3): void;
        m_dVector: btVector3;
        get_m_eVector(): btVector3;
        set_m_eVector(m_eVector: btVector3): void;
        m_eVector: btVector3;
        get_m_absFrameTotVelocity(): btSpatialMotionVector;
        set_m_absFrameTotVelocity(m_absFrameTotVelocity: btSpatialMotionVector): void;
        m_absFrameTotVelocity: btSpatialMotionVector;
        get_m_absFrameLocVelocity(): btSpatialMotionVector;
        set_m_absFrameLocVelocity(m_absFrameLocVelocity: btSpatialMotionVector): void;
        m_absFrameLocVelocity: btSpatialMotionVector;
        setAxisTop(dof: number, axis: btVector3): void;
        setAxisBottom(dof: number, axis: btVector3): void;
        getAxisTop(dof: number): btVector3;
        getAxisBottom(dof: number): btVector3;
        get_m_dofOffset(): number;
        set_m_dofOffset(m_dofOffset: number): void;
        m_dofOffset: number;
        get_m_cfgOffset(): number;
        set_m_cfgOffset(m_cfgOffset: number): void;
        m_cfgOffset: number;
        get_m_cachedRotParentToThis(): btQuaternion;
        set_m_cachedRotParentToThis(m_cachedRotParentToThis: btQuaternion): void;
        m_cachedRotParentToThis: btQuaternion;
        get_m_cachedRVector(): btVector3;
        set_m_cachedRVector(m_cachedRVector: btVector3): void;
        m_cachedRVector: btVector3;
        get_m_cachedRotParentToThis_interpolate(): btQuaternion;
        set_m_cachedRotParentToThis_interpolate(m_cachedRotParentToThis_interpolate: btQuaternion): void;
        m_cachedRotParentToThis_interpolate: btQuaternion;
        get_m_cachedRVector_interpolate(): btVector3;
        set_m_cachedRVector_interpolate(m_cachedRVector_interpolate: btVector3): void;
        m_cachedRVector_interpolate: btVector3;
        get_m_appliedForce(): btVector3;
        set_m_appliedForce(m_appliedForce: btVector3): void;
        m_appliedForce: btVector3;
        get_m_appliedTorque(): btVector3;
        set_m_appliedTorque(m_appliedTorque: btVector3): void;
        m_appliedTorque: btVector3;
        get_m_appliedConstraintForce(): btVector3;
        set_m_appliedConstraintForce(m_appliedConstraintForce: btVector3): void;
        m_appliedConstraintForce: btVector3;
        get_m_appliedConstraintTorque(): btVector3;
        set_m_appliedConstraintTorque(m_appliedConstraintTorque: btVector3): void;
        m_appliedConstraintTorque: btVector3;
        get_m_collider(): btMultiBodyLinkCollider;
        set_m_collider(m_collider: btMultiBodyLinkCollider): void;
        m_collider: btMultiBodyLinkCollider;
        get_m_flags(): number;
        set_m_flags(m_flags: number): void;
        m_flags: number;
        get_m_dofCount(): number;
        set_m_dofCount(m_dofCount: number): void;
        m_dofCount: number;
        get_m_posVarCount(): number;
        set_m_posVarCount(m_posVarCount: number): void;
        m_posVarCount: number;
        get_m_jointType(): btMultibodyLink_eFeatherstoneJointType;
        set_m_jointType(m_jointType: btMultibodyLink_eFeatherstoneJointType): void;
        m_jointType: btMultibodyLink_eFeatherstoneJointType;
        get_m_cachedWorldTransform(): btTransform;
        set_m_cachedWorldTransform(m_cachedWorldTransform: btTransform): void;
        m_cachedWorldTransform: btTransform;
        get_m_linkName(): string;
        set_m_linkName(m_linkName: string): void;
        m_linkName: string;
        get_m_jointName(): string;
        set_m_jointName(m_jointName: string): void;
        m_jointName: string;
        get_m_userPtr(): unknown;
        set_m_userPtr(m_userPtr: unknown): void;
        m_userPtr: unknown;
        get_m_jointDamping(): number;
        set_m_jointDamping(m_jointDamping: number): void;
        m_jointDamping: number;
        get_m_jointFriction(): number;
        set_m_jointFriction(m_jointFriction: number): void;
        m_jointFriction: number;
        get_m_jointLowerLimit(): number;
        set_m_jointLowerLimit(m_jointLowerLimit: number): void;
        m_jointLowerLimit: number;
        get_m_jointUpperLimit(): number;
        set_m_jointUpperLimit(m_jointUpperLimit: number): void;
        m_jointUpperLimit: number;
        get_m_jointMaxForce(): number;
        set_m_jointMaxForce(m_jointMaxForce: number): void;
        m_jointMaxForce: number;
        get_m_jointMaxVelocity(): number;
        set_m_jointMaxVelocity(m_jointMaxVelocity: number): void;
        m_jointMaxVelocity: number;
        constructor();
    }
    class btMultiBodyLinkCollider extends btCollisionObject {
        get_m_multiBody(): btMultiBody;
        set_m_multiBody(m_multiBody: btMultiBody): void;
        m_multiBody: btMultiBody;
        get_m_link(): number;
        set_m_link(m_link: number): void;
        m_link: number;
        constructor(multiBody: btMultiBody, link: number);
        upcast(colObj: btCollisionObject): btMultiBodyLinkCollider;
        checkCollideWithOverride(co: btCollisionObject): boolean;
    }
    class btMultiBody {
        constructor(n_links: number, mass: number, inertia: btVector3, fixed_base_: boolean, can_sleep_: boolean, deprecatedMultiDof?: boolean);
        setupFixed(i: number, mass: number, inertia: btVector3, parent: number, rotParentToThis: btQuaternion, parentComToThisPivotOffset: btVector3, thisPivotToThisComOffset: btVector3, deprecatedDisableParentCollision?: boolean): void;
        setupPrismatic(i: number, mass: number, inertia: btVector3, parent: number, rot_parent_to_this: btQuaternion, joint_axis: btVector3, parentComToThisPivotOffset: btVector3, thisPivotToThisComOffset: btVector3, disableParentCollision: boolean): void;
        setupRevolute(i: number, mass: number, inertia: btVector3, parent: number, zero_rot_parent_to_this: btQuaternion, joint_axis: btVector3, parent_axis_position: btVector3, my_axis_position: btVector3, disableParentCollision?: boolean): void;
        setupSpherical(i: number, mass: number, inertia: btVector3, parent: number, rotParentToThis: btQuaternion, parentComToThisPivotOffset: btVector3, thisPivotToThisComOffset: btVector3, disableParentCollision?: boolean): void;
        setupPlanar(i: number, mass: number, inertia: btVector3, parent: number, rotParentToThis: btQuaternion, rotationAxis: btVector3, parentComToThisComOffset: btVector3, disableParentCollision?: boolean): void;
        getLink(index: number): btMultibodyLink;
        setBaseCollider(collider: btMultiBodyLinkCollider): void;
        getBaseCollider(): btMultiBodyLinkCollider;
        getLinkCollider(index: number): btMultiBodyLinkCollider;
        getParent(link_num: number): number;
        getNumLinks(): number;
        getNumDofs(): number;
        getNumPosVars(): number;
        getBaseMass(): number;
        getBaseInertia(): btVector3;
        getLinkMass(i: number): number;
        getLinkInertia(i: number): btVector3;
        setBaseMass(mass: number): void;
        setBaseInertia(inertia: btVector3): void;
        getBasePos(): btVector3;
        getBaseVel(): btVector3;
        getWorldToBaseRot(): btQuaternion;
        getInterpolateBasePos(): btVector3;
        getInterpolateWorldToBaseRot(): btQuaternion;
        getBaseOmega(): btVector3;
        setBasePos(pos: btVector3): void;
        setInterpolateBasePos(pos: btVector3): void;
        setBaseWorldTransform(tr: btTransform): void;
        getBaseWorldTransform(): btTransform;
        setInterpolateBaseWorldTransform(tr: btTransform): void;
        getInterpolateBaseWorldTransform(): btTransform;
        setBaseVel(vel: btVector3): void;
        setWorldToBaseRot(rot: btQuaternion): void;
        setInterpolateWorldToBaseRot(rot: btQuaternion): void;
        setBaseOmega(omega: btVector3): void;
        getJointPos(i: number): number;
        getJointVel(i: number): number;
        setJointPos(i: number, q: number): void;
        setJointVel(i: number, qdot: number): void;
        getRVector(i: number): btVector3;
        getParentToLocalRot(i: number): btQuaternion;
        getInterpolateRVector(i: number): btVector3;
        getInterpolateParentToLocalRot(i: number): btQuaternion;
        localPosToWorld(i: number, vec: btVector3): btVector3;
        localDirToWorld(i: number, vec: btVector3): btVector3;
        worldPosToLocal(i: number, vec: btVector3): btVector3;
        worldDirToLocal(i: number, vec: btVector3): btVector3;
        localFrameToWorld(i: number, local_frame: btMatrix3x3): btMatrix3x3;
        clearForcesAndTorques(): void;
        clearConstraintForces(): void;
        clearVelocities(): void;
        addBaseForce(f: btVector3): void;
        addBaseTorque(t: btVector3): void;
        addLinkForce(i: number, f: btVector3): void;
        addLinkTorque(i: number, t: btVector3): void;
        addBaseConstraintForce(f: btVector3): void;
        addBaseConstraintTorque(t: btVector3): void;
        addLinkConstraintForce(i: number, f: btVector3): void;
        addLinkConstraintTorque(i: number, t: btVector3): void;
        addJointTorque(i: number, Q: number): void;
        addJointTorqueMultiDof(i: number, dof: number, Q: number): void;
        getBaseForce(): btVector3;
        getBaseTorque(): btVector3;
        getLinkForce(i: number): btVector3;
        getLinkTorque(i: number): btVector3;
        getJointTorque(i: number): number;
        computeAccelerationsArticulatedBodyAlgorithmMultiDof(dt: number, scratch_r: btScalarArray, scratch_v: btVector3Array, scratch_m: btMatrix3x3Array, isConstraintPass: boolean, jointFeedbackInWorldSpace: boolean, jointFeedbackInJointFrame: boolean): void;
        setCanSleep(canSleep: boolean): void;
        getCanSleep(): boolean;
        getCanWakeup(): boolean;
        setCanWakeup(canWakeup: boolean): void;
        isAwake(): boolean;
        wakeUp(): void;
        goToSleep(): void;
        checkMotionAndSleepIfRequired(timestep: number): void;
        hasFixedBase(): boolean;
        isBaseKinematic(): boolean;
        isBaseStaticOrKinematic(): boolean;
        setBaseDynamicType(dynamicType: number): void;
        setFixedBase(fixedBase: boolean): void;
        getCompanionId(): number;
        setCompanionId(id: number): void;
        setNumLinks(numLinks: number): void;
        getLinearDamping(): number;
        setLinearDamping(damp: number): void;
        getAngularDamping(): number;
        setAngularDamping(damp: number): void;
        getUseGyroTerm(): boolean;
        setUseGyroTerm(useGyro: boolean): void;
        getMaxCoordinateVelocity(): number;
        setMaxCoordinateVelocity(maxVel: number): void;
        getMaxAppliedImpulse(): number;
        setMaxAppliedImpulse(maxImp: number): void;
        setHasSelfCollision(hasSelfCollision: boolean): void;
        hasSelfCollision(): boolean;
        finalizeMultiDof(): void;
        useRK4Integration(use: boolean): void;
        isUsingRK4Integration(): boolean;
        useGlobalVelocities(use: boolean): void;
        isUsingGlobalVelocities(): boolean;
        setLinkDynamicType(i: number, type: number): void;
        isLinkStaticOrKinematic(i: number): boolean;
        isLinkKinematic(i: number): boolean;
        isLinkAndAllAncestorsStaticOrKinematic(i: number): boolean;
        isLinkAndAllAncestorsKinematic(i: number): boolean;
        setSleepThreshold(sleepThreshold: number): void;
        setSleepTimeout(sleepTimeout: number): void;
    }
    class btMultiBodyJacobianData {
        get_m_jacobians(): btScalarArray;
        set_m_jacobians(m_jacobians: btScalarArray): void;
        m_jacobians: btScalarArray;
        get_m_deltaVelocitiesUnitImpulse(): btScalarArray;
        set_m_deltaVelocitiesUnitImpulse(m_deltaVelocitiesUnitImpulse: btScalarArray): void;
        m_deltaVelocitiesUnitImpulse: btScalarArray;
        get_m_deltaVelocities(): btScalarArray;
        set_m_deltaVelocities(m_deltaVelocities: btScalarArray): void;
        m_deltaVelocities: btScalarArray;
        get_scratch_r(): btScalarArray;
        set_scratch_r(scratch_r: btScalarArray): void;
        scratch_r: btScalarArray;
        get_scratch_v(): btVector3Array;
        set_scratch_v(scratch_v: btVector3Array): void;
        scratch_v: btVector3Array;
        get_scratch_m(): btMatrix3x3Array;
        set_scratch_m(scratch_m: btMatrix3x3Array): void;
        scratch_m: btMatrix3x3Array;
        get_m_solverBodyPool(): btSolverBodyArray;
        set_m_solverBodyPool(m_solverBodyPool: btSolverBodyArray): void;
        m_solverBodyPool: btSolverBodyArray;
        get_m_fixedBodyId(): number;
        set_m_fixedBodyId(m_fixedBodyId: number): void;
        m_fixedBodyId: number;
    }
    class btMultiBodyConstraint {
        getIslandIdA(): number;
        getIslandIdB(): number;
        getNumRows(): number;
        getMultiBodyA(): btMultiBody;
        getMultiBodyB(): btMultiBody;
        getPosition(row: number): number;
        setPosition(row: number, pos: number): void;
        isUnilateral(): boolean;
        getMaxAppliedImpulse(): number;
        setMaxAppliedImpulse(maxImp: number): void;
    }
    class btMultiBodyMLCPConstraintSolver extends btMultiBodyConstraintSolver {
        constructor(solver: btMLCPSolverInterface);
        setMLCPSolver(solver: btMLCPSolverInterface): void;
        getNumFallbacks(): number;
        setNumFallbacks(num: number): void;
        getSolverType(): btConstraintSolverType;
    }
    class btMultiBodyConstraintSolver extends btSequentialImpulseConstraintSolver {
        constructor();
    }
    class btMultiBodyDynamicsWorld extends btDiscreteDynamicsWorld {
        constructor(dispatcher: btDispatcher, pairCache: btBroadphaseInterface, constraintSolver: btMultiBodyConstraintSolver, collisionConfiguration: btCollisionConfiguration);
        addMultiBody(body: btMultiBody, group: number, mask: number): void;
        removeMultiBody(body: btMultiBody): void;
        addMultiBodyConstraint(constraint: btMultiBodyConstraint): void;
        removeMultiBodyConstraint(constraint: btMultiBodyConstraint): void;
    }
    class btMultiBodyFixedConstraint extends btMultiBodyConstraint {
        constructor(bodyA: btMultiBody, linkA: number, bodyB: btMultiBody, linkB: number, pivotInA: btVector3, pivotInB: btVector3, frameInA: btMatrix3x3, frameInB: btMatrix3x3);
        finalizeMultiDof(): void;
        getIslandIdA(): number;
        getIslandIdB(): number;
        createConstraintRows(constraintRows: btMultiBodyConstraintArray, data: btMultiBodyJacobianData, infoGlobal: btContactSolverInfo): void;
        getPivotInA(): btVector3;
        setPivotInA(pivotInA: btVector3): void;
        getPivotInB(): btVector3;
        setPivotInB(pivotInB: btVector3): void;
        getFrameInA(): btMatrix3x3;
        setFrameInA(frameInA: btMatrix3x3): void;
        getFrameInB(): btMatrix3x3;
        setFrameInB(frameInB: btMatrix3x3): void;
    }
    class btMultiBodyGearConstraint extends btMultiBodyConstraint {
        constructor(bodyA: btMultiBody, linkA: number, bodyB: btMultiBody, linkB: number, pivotInA: btVector3, pivotInB: btVector3, frameInA: btMatrix3x3, frameInB: btMatrix3x3);
        finalizeMultiDof(): void;
        getIslandIdA(): number;
        getIslandIdB(): number;
        createConstraintRows(constraintRows: btMultiBodyConstraintArray, data: btMultiBodyJacobianData, infoGlobal: btContactSolverInfo): void;
        getPivotInA(): btVector3;
        setPivotInA(pivotInA: btVector3): void;
        getPivotInB(): btVector3;
        setPivotInB(pivotInB: btVector3): void;
        getFrameInA(): btMatrix3x3;
        setFrameInA(frameInA: btMatrix3x3): void;
        getFrameInB(): btMatrix3x3;
        setFrameInB(frameInB: btMatrix3x3): void;
        setGearRatio(gearRatio: number): void;
        setGearAuxLink(gearAuxLink: number): void;
        setRelativePositionTarget(relPosTarget: number): void;
        setErp(erp: number): void;
    }
    class btMultiBodyJointLimitConstraint extends btMultiBodyConstraint {
        constructor(body: btMultiBody, link: number, lower: number, upper: number);
        finalizeMultiDof(): void;
        getIslandIdA(): number;
        getIslandIdB(): number;
        createConstraintRows(constraintRows: btMultiBodyConstraintArray, data: btMultiBodyJacobianData, infoGlobal: btContactSolverInfo): void;
        getLowerBound(): number;
        getUpperBound(): number;
        setLowerBound(lower: number): void;
        setUpperBound(upper: number): void;
    }
    class btMultiBodyJointMotor extends btMultiBodyConstraint {
        constructor(body: btMultiBody, link: number, linkDoF: number, desiredVelocity: number, maxMotorImpulse: number);
        finalizeMultiDof(): void;
        getIslandIdA(): number;
        getIslandIdB(): number;
        createConstraintRows(constraintRows: btMultiBodyConstraintArray, data: btMultiBodyJacobianData, infoGlobal: btContactSolverInfo): void;
        setVelocityTarget(velTarget: number, kd?: number): void;
        setPositionTarget(posTarget: number, kp?: number): void;
        setErp(erp: number): void;
        getErp(): number;
        setRhsClamp(rhsClamp: number): void;
    }
    class btMultiBodyPoint2Point extends btMultiBodyConstraint {
        constructor(body: btMultiBody, link: number, bodyB: btRigidBody, pivotInA: btVector3, pivotInB: btVector3);
        constructor(bodyA: btMultiBody, linkA: number, bodyB: btMultiBody, linkB: number, pivotInA: btVector3, pivotInB: btVector3);
        finalizeMultiDof(): void;
        getIslandIdA(): number;
        getIslandIdB(): number;
        createConstraintRows(constraintRows: btMultiBodyConstraintArray, data: btMultiBodyJacobianData, infoGlobal: btContactSolverInfo): void;
        getPivotInB(): btVector3;
        setPivotInB(pivotInB: btVector3): void;
    }
    class btMultiBodySliderConstraint extends btMultiBodyConstraint {
        constructor(body: btMultiBody, link: number, bodyB: btRigidBody, pivotInA: btVector3, pivotInB: btVector3, frameInA: btMatrix3x3, frameInB: btMatrix3x3, jointAxis: btVector3);
        constructor(bodyA: btMultiBody, linkA: number, bodyB: btMultiBody, linkB: number, pivotInA: btVector3, pivotInB: btVector3, frameInA: btMatrix3x3, frameInB: btMatrix3x3, jointAxis: btVector3);
        finalizeMultiDof(): void;
        getIslandIdA(): number;
        getIslandIdB(): number;
        createConstraintRows(constraintRows: btMultiBodyConstraintArray, data: btMultiBodyJacobianData, infoGlobal: btContactSolverInfo): void;
        getPivotInA(): btVector3;
        setPivotInA(pivotInA: btVector3): void;
        getPivotInB(): btVector3;
        setPivotInB(pivotInB: btVector3): void;
        getFrameInA(): btMatrix3x3;
        setFrameInA(frameInA: btMatrix3x3): void;
        getFrameInB(): btMatrix3x3;
        setFrameInB(frameInB: btMatrix3x3): void;
        getJointAxis(): btVector3;
        setJointAxis(jointAxis: btVector3): void;
    }
    class btMultiBodySphericalJointLimit extends btMultiBodyConstraint {
        constructor(body: btMultiBody, link: number, swingxRange: number, swingyRange: number, twistRange: number, maxAppliedImpulse: number);
        finalizeMultiDof(): void;
        getIslandIdA(): number;
        getIslandIdB(): number;
        createConstraintRows(constraintRows: btMultiBodyConstraintArray, data: btMultiBodyJacobianData, infoGlobal: btContactSolverInfo): void;
        setVelocityTarget(velTarget: btVector3, kd?: number): void;
        setVelocityTargetMultiDof(velTarget: btVector3, kd?: btVector3): void;
        setPositionTarget(posTarget: btQuaternion, kp?: number): void;
        setPositionTargetMultiDof(posTarget: btQuaternion, kp?: btVector3): void;
        setErp(erp: number): void;
        getErp(): number;
        setRhsClamp(rhsClamp: number): void;
        getMaxAppliedImpulseMultiDof(i: number): number;
        setMaxAppliedImpulseMultiDof(maxImp: btVector3): void;
    }
    class btMultiBodySphericalJointMotor extends btMultiBodyConstraint {
        constructor(body: btMultiBody, link: number, maxMotorImpulse: number);
        finalizeMultiDof(): void;
        getIslandIdA(): number;
        getIslandIdB(): number;
        createConstraintRows(constraintRows: btMultiBodyConstraintArray, data: btMultiBodyJacobianData, infoGlobal: btContactSolverInfo): void;
        setVelocityTarget(velTarget: btVector3, kd?: number): void;
        setVelocityTargetMultiDof(velTarget: btVector3, kd?: btVector3): void;
        setPositionTarget(posTarget: btQuaternion, kp?: number): void;
        setPositionTargetMultiDof(posTarget: btQuaternion, kp?: btVector3): void;
        setErp(erp: number): void;
        getErp(): number;
        setRhsClamp(rhsClamp: number): void;
        getMaxAppliedImpulseMultiDof(i: number): number;
        setMaxAppliedImpulseMultiDof(maxImp: btVector3): void;
        getDamping(i: number): number;
        setDamping(damping: btVector3): void;
    }
    class btMultiBodySolverConstraint {
        get_m_deltaVelAindex(): number;
        set_m_deltaVelAindex(m_deltaVelAindex: number): void;
        m_deltaVelAindex: number;
        get_m_relpos1CrossNormal(): btVector3;
        set_m_relpos1CrossNormal(m_relpos1CrossNormal: btVector3): void;
        m_relpos1CrossNormal: btVector3;
        get_m_contactNormal1(): btVector3;
        set_m_contactNormal1(m_contactNormal1: btVector3): void;
        m_contactNormal1: btVector3;
        get_m_jacAindex(): number;
        set_m_jacAindex(m_jacAindex: number): void;
        m_jacAindex: number;
        get_m_deltaVelBindex(): number;
        set_m_deltaVelBindex(m_deltaVelBindex: number): void;
        m_deltaVelBindex: number;
        get_m_contactNormal2(): btVector3;
        set_m_contactNormal2(m_contactNormal2: btVector3): void;
        m_contactNormal2: btVector3;
        get_m_relpos2CrossNormal(): btVector3;
        set_m_relpos2CrossNormal(m_relpos2CrossNormal: btVector3): void;
        m_relpos2CrossNormal: btVector3;
        get_m_jacBindex(): number;
        set_m_jacBindex(m_jacBindex: number): void;
        m_jacBindex: number;
        get_m_angularComponentA(): btVector3;
        set_m_angularComponentA(m_angularComponentA: btVector3): void;
        m_angularComponentA: btVector3;
        get_m_angularComponentB(): btVector3;
        set_m_angularComponentB(m_angularComponentB: btVector3): void;
        m_angularComponentB: btVector3;
        get_m_friction(): number;
        set_m_friction(m_friction: number): void;
        m_friction: number;
        get_m_jacDiagABInv(): number;
        set_m_jacDiagABInv(m_jacDiagABInv: number): void;
        m_jacDiagABInv: number;
        get_m_rhs(): number;
        set_m_rhs(m_rhs: number): void;
        m_rhs: number;
        get_m_cfm(): number;
        set_m_cfm(m_cfm: number): void;
        m_cfm: number;
        get_m_lowerLimit(): number;
        set_m_lowerLimit(m_lowerLimit: number): void;
        m_lowerLimit: number;
        get_m_upperLimit(): number;
        set_m_upperLimit(m_upperLimit: number): void;
        m_upperLimit: number;
        get_m_rhsPenetration(): number;
        set_m_rhsPenetration(m_rhsPenetration: number): void;
        m_rhsPenetration: number;
        get_m_overrideNumSolverIterations(): number;
        set_m_overrideNumSolverIterations(m_overrideNumSolverIterations: number): void;
        m_overrideNumSolverIterations: number;
        get_m_frictionIndex(): number;
        set_m_frictionIndex(m_frictionIndex: number): void;
        m_frictionIndex: number;
        get_m_solverBodyIdA(): number;
        set_m_solverBodyIdA(m_solverBodyIdA: number): void;
        m_solverBodyIdA: number;
        get_m_multiBodyA(): btMultiBody;
        set_m_multiBodyA(m_multiBodyA: btMultiBody): void;
        m_multiBodyA: btMultiBody;
        get_m_linkA(): number;
        set_m_linkA(m_linkA: number): void;
        m_linkA: number;
        get_m_solverBodyIdB(): number;
        set_m_solverBodyIdB(m_solverBodyIdB: number): void;
        m_solverBodyIdB: number;
        get_m_multiBodyB(): btMultiBody;
        set_m_multiBodyB(m_multiBodyB: btMultiBody): void;
        m_multiBodyB: btMultiBody;
        get_m_linkB(): number;
        set_m_linkB(m_linkB: number): void;
        m_linkB: number;
    }
    class btMultiBodyConstraintArray {
        constructor();
        size(): number;
        at(n: number): btMultiBodySolverConstraint;
        clear(): void;
        pop_back(): void;
        resize(newsize: number, fillData: btMultiBodySolverConstraint): void;
        expandNonInitializing(): btMultiBodySolverConstraint;
        expand(fillValue: btMultiBodySolverConstraint): btMultiBodySolverConstraint;
        push_back(Val: btMultiBodySolverConstraint): void;
        capacity(): number;
        reserve(Count: number): void;
    }
    class btMLCPSolverInterface {
    }
    class btDantzigSolver extends btMLCPSolverInterface {
        constructor();
    }
    class btSolveProjectedGaussSeidel extends btMLCPSolverInterface {
        constructor();
    }
    class btLemkeSolver extends btMLCPSolverInterface {
        constructor();
    }
    class btMLCPSolver extends btSequentialImpulseConstraintSolver {
        constructor(solver: btMLCPSolverInterface);
        setMLCPSolver(solver: btMLCPSolverInterface): void;
        getNumFallbacks(): number;
        setNumFallbacks(num: number): void;
        getSolverType(): btConstraintSolverType;
    }
    class btSoftBodyWorldInfo {
        constructor();
        get_air_density(): number;
        set_air_density(air_density: number): void;
        air_density: number;
        get_water_density(): number;
        set_water_density(water_density: number): void;
        water_density: number;
        get_water_offset(): number;
        set_water_offset(water_offset: number): void;
        water_offset: number;
        get_m_maxDisplacement(): number;
        set_m_maxDisplacement(m_maxDisplacement: number): void;
        m_maxDisplacement: number;
        get_water_normal(): btVector3;
        set_water_normal(water_normal: btVector3): void;
        water_normal: btVector3;
        get_m_broadphase(): btBroadphaseInterface;
        set_m_broadphase(m_broadphase: btBroadphaseInterface): void;
        m_broadphase: btBroadphaseInterface;
        get_m_dispatcher(): btDispatcher;
        set_m_dispatcher(m_dispatcher: btDispatcher): void;
        m_dispatcher: btDispatcher;
        get_m_gravity(): btVector3;
        set_m_gravity(m_gravity: btVector3): void;
        m_gravity: btVector3;
    }
    class Face {
        get_m_n(): ReadonlyArray<Node>;
        set_m_n(m_n: ReadonlyArray<Node>): void;
        m_n: ReadonlyArray<Node>;
        get_m_normal(): btVector3;
        set_m_normal(m_normal: btVector3): void;
        m_normal: btVector3;
        get_m_ra(): number;
        set_m_ra(m_ra: number): void;
        m_ra: number;
    }
    class tFaceArray {
        size(): number;
        at(n: number): Face;
    }
    class Node {
        get_m_x(): btVector3;
        set_m_x(m_x: btVector3): void;
        m_x: btVector3;
        get_m_q(): btVector3;
        set_m_q(m_q: btVector3): void;
        m_q: btVector3;
        get_m_v(): btVector3;
        set_m_v(m_v: btVector3): void;
        m_v: btVector3;
        get_m_f(): btVector3;
        set_m_f(m_f: btVector3): void;
        m_f: btVector3;
        get_m_n(): btVector3;
        set_m_n(m_n: btVector3): void;
        m_n: btVector3;
        get_m_im(): number;
        set_m_im(m_im: number): void;
        m_im: number;
        get_m_area(): number;
        set_m_area(m_area: number): void;
        m_area: number;
    }
    class tNodeArray {
        size(): number;
        at(n: number): Node;
    }
    class Material {
        get_m_kLST(): number;
        set_m_kLST(m_kLST: number): void;
        m_kLST: number;
        get_m_kAST(): number;
        set_m_kAST(m_kAST: number): void;
        m_kAST: number;
        get_m_kVST(): number;
        set_m_kVST(m_kVST: number): void;
        m_kVST: number;
        get_m_flags(): number;
        set_m_flags(m_flags: number): void;
        m_flags: number;
    }
    class tMaterialArray {
        size(): number;
        at(n: number): Material;
    }
    class Anchor {
        get_m_node(): Node;
        set_m_node(m_node: Node): void;
        m_node: Node;
        get_m_local(): btVector3;
        set_m_local(m_local: btVector3): void;
        m_local: btVector3;
        get_m_body(): btRigidBody;
        set_m_body(m_body: btRigidBody): void;
        m_body: btRigidBody;
        get_m_influence(): number;
        set_m_influence(m_influence: number): void;
        m_influence: number;
        get_m_c0(): btMatrix3x3;
        set_m_c0(m_c0: btMatrix3x3): void;
        m_c0: btMatrix3x3;
        get_m_c1(): btVector3;
        set_m_c1(m_c1: btVector3): void;
        m_c1: btVector3;
        get_m_c2(): number;
        set_m_c2(m_c2: number): void;
        m_c2: number;
    }
    class tAnchorArray {
        size(): number;
        at(n: number): Anchor;
        clear(): void;
        push_back(val: Anchor): void;
        pop_back(): void;
    }
    class Config {
        get_kVCF(): number;
        set_kVCF(kVCF: number): void;
        kVCF: number;
        get_kDP(): number;
        set_kDP(kDP: number): void;
        kDP: number;
        get_kDG(): number;
        set_kDG(kDG: number): void;
        kDG: number;
        get_kLF(): number;
        set_kLF(kLF: number): void;
        kLF: number;
        get_kPR(): number;
        set_kPR(kPR: number): void;
        kPR: number;
        get_kVC(): number;
        set_kVC(kVC: number): void;
        kVC: number;
        get_kDF(): number;
        set_kDF(kDF: number): void;
        kDF: number;
        get_kMT(): number;
        set_kMT(kMT: number): void;
        kMT: number;
        get_kCHR(): number;
        set_kCHR(kCHR: number): void;
        kCHR: number;
        get_kKHR(): number;
        set_kKHR(kKHR: number): void;
        kKHR: number;
        get_kSHR(): number;
        set_kSHR(kSHR: number): void;
        kSHR: number;
        get_kAHR(): number;
        set_kAHR(kAHR: number): void;
        kAHR: number;
        get_kSRHR_CL(): number;
        set_kSRHR_CL(kSRHR_CL: number): void;
        kSRHR_CL: number;
        get_kSKHR_CL(): number;
        set_kSKHR_CL(kSKHR_CL: number): void;
        kSKHR_CL: number;
        get_kSSHR_CL(): number;
        set_kSSHR_CL(kSSHR_CL: number): void;
        kSSHR_CL: number;
        get_kSR_SPLT_CL(): number;
        set_kSR_SPLT_CL(kSR_SPLT_CL: number): void;
        kSR_SPLT_CL: number;
        get_kSK_SPLT_CL(): number;
        set_kSK_SPLT_CL(kSK_SPLT_CL: number): void;
        kSK_SPLT_CL: number;
        get_kSS_SPLT_CL(): number;
        set_kSS_SPLT_CL(kSS_SPLT_CL: number): void;
        kSS_SPLT_CL: number;
        get_maxvolume(): number;
        set_maxvolume(maxvolume: number): void;
        maxvolume: number;
        get_timescale(): number;
        set_timescale(timescale: number): void;
        timescale: number;
        get_viterations(): number;
        set_viterations(viterations: number): void;
        viterations: number;
        get_piterations(): number;
        set_piterations(piterations: number): void;
        piterations: number;
        get_diterations(): number;
        set_diterations(diterations: number): void;
        diterations: number;
        get_citerations(): number;
        set_citerations(citerations: number): void;
        citerations: number;
        get_collisions(): number;
        set_collisions(collisions: number): void;
        collisions: number;
    }
    class btSoftBody extends btCollisionObject {
        constructor(worldInfo: btSoftBodyWorldInfo, node_count: number, x: btVector3, m: ReadonlyArray<number>);
        get_m_cfg(): Config;
        set_m_cfg(m_cfg: Config): void;
        m_cfg: Config;
        get_m_nodes(): tNodeArray;
        set_m_nodes(m_nodes: tNodeArray): void;
        m_nodes: tNodeArray;
        get_m_faces(): tFaceArray;
        set_m_faces(m_faces: tFaceArray): void;
        m_faces: tFaceArray;
        get_m_materials(): tMaterialArray;
        set_m_materials(m_materials: tMaterialArray): void;
        m_materials: tMaterialArray;
        get_m_anchors(): tAnchorArray;
        set_m_anchors(m_anchors: tAnchorArray): void;
        m_anchors: tAnchorArray;
        checkLink(node0: number, node1: number): boolean;
        checkFace(node0: number, node1: number, node2: number): boolean;
        appendMaterial(): Material;
        appendNode(x: btVector3, m: number): void;
        appendLink(node0: number, node1: number, mat: Material, bcheckexist: boolean): void;
        appendFace(node0: number, node1: number, node2: number, mat: Material): void;
        appendTetra(node0: number, node1: number, node2: number, node3: number, mat: Material): void;
        appendAnchor(node: number, body: btRigidBody, disableCollisionBetweenLinkedBodies: boolean, influence: number): void;
        addForce(force: btVector3): void;
        addForce(force: btVector3, node: number): void;
        addAeroForceToNode(windVelocity: btVector3, nodeIndex: number): void;
        getTotalMass(): number;
        setTotalMass(mass: number, fromfaces: boolean): void;
        setMass(node: number, mass: number): void;
        transform(trs: btTransform): void;
        translate(trs: btVector3): void;
        rotate(rot: btQuaternion): void;
        scale(scl: btVector3): void;
        generateClusters(k: number, maxiterations?: number): number;
        generateBendingConstraints(distance: number, mat: Material): number;
        upcast(colObj: btCollisionObject): btSoftBody;
        getRestLengthScale(): number;
        setRestLengthScale(restLength: number): void;
    }
    class btSoftBodyRigidBodyCollisionConfiguration extends btDefaultCollisionConfiguration {
        constructor(info?: btDefaultCollisionConstructionInfo);
    }
    class btSoftBodySolver {
    }
    class btDefaultSoftBodySolver extends btSoftBodySolver {
        constructor();
    }
    class btSoftBodyArray {
        size(): number;
        at(n: number): btSoftBody;
    }
    class btSoftRigidDynamicsWorld extends btDiscreteDynamicsWorld {
        constructor(dispatcher: btDispatcher, pairCache: btBroadphaseInterface, constraintSolver: btConstraintSolver, collisionConfiguration: btCollisionConfiguration, softBodySolver: btSoftBodySolver);
        addSoftBody(body: btSoftBody, collisionFilterGroup: number, collisionFilterMask: number): void;
        removeSoftBody(body: btSoftBody): void;
        removeCollisionObject(collisionObject: btCollisionObject): void;
        getWorldInfo(): btSoftBodyWorldInfo;
        getSoftBodyArray(): btSoftBodyArray;
    }
    class btSoftBodyHelpers {
        constructor();
        CreateRope(worldInfo: btSoftBodyWorldInfo, from: btVector3, to: btVector3, res: number, fixeds: number): btSoftBody;
        CreatePatch(worldInfo: btSoftBodyWorldInfo, corner00: btVector3, corner10: btVector3, corner01: btVector3, corner11: btVector3, resx: number, resy: number, fixeds: number, gendiags: boolean): btSoftBody;
        CreatePatchUV(worldInfo: btSoftBodyWorldInfo, corner00: btVector3, corner10: btVector3, corner01: btVector3, corner11: btVector3, resx: number, resy: number, fixeds: number, gendiags: boolean, tex_coords: ReadonlyArray<number>): btSoftBody;
        CreateEllipsoid(worldInfo: btSoftBodyWorldInfo, center: btVector3, radius: btVector3, res: number): btSoftBody;
        CreateFromTriMesh(worldInfo: btSoftBodyWorldInfo, vertices: ReadonlyArray<number>, triangles: ReadonlyArray<number>, ntriangles: number, randomizeConstraints: boolean): btSoftBody;
        CreateFromConvexHull(worldInfo: btSoftBodyWorldInfo, vertices: btVector3, nvertices: number, randomizeConstraints: boolean): btSoftBody;
    }
}