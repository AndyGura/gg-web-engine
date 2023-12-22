#include "btBulletDynamicsCommon.h"
#include "BulletCollision/CollisionDispatch/btGhostObject.h"
#include "BulletCollision/CollisionDispatch/btManifoldResult.h"
#include "BulletCollision/CollisionShapes/btConvexPolyhedron.h"
#include "BulletCollision/CollisionShapes/btHeightfieldTerrainShape.h"
#include "BulletCollision/CollisionShapes/btShapeHull.h"
#include "BulletDynamics/Character/btKinematicCharacterController.h"
#include "BulletDynamics/Featherstone/btMultiBody.h"
#include "BulletDynamics/Featherstone/btMultiBodyLink.h"
#include "BulletDynamics/Featherstone/btMultiBodyLinkCollider.h"
#include "BulletDynamics/Featherstone/btMultiBodyConstraint.h"
#include "BulletDynamics/Featherstone/btMultiBodyFixedConstraint.h"
#include "BulletDynamics/Featherstone/btMultiBodyJointLimitConstraint.h"
#include "BulletDynamics/Featherstone/btMultiBodyJointMotor.h"
#include "BulletDynamics/Featherstone/btMultiBodyPoint2Point.h"
#include "BulletDynamics/Featherstone/btMultiBodySliderConstraint.h"
#include "BulletDynamics/Featherstone/btMultiBodyConstraintSolver.h"
#include "BulletDynamics/Featherstone/btMultiBodyDynamicsWorld.h"
#include "BulletDynamics/Featherstone/btMultiBodySolverConstraint.h"
#include "BulletDynamics/MLCPSolvers/btMLCPSolverInterface.h"
#include "BulletDynamics/MLCPSolvers/btMLCPSolver.h"
#include "BulletDynamics/MLCPSolvers/btDantzigSolver.h"
#include "BulletDynamics/MLCPSolvers/btLemkeSolver.h"
#include "BulletDynamics/MLCPSolvers/btSolveProjectedGaussSeidel.h"
#include "BulletDynamics/MLCPSolvers/btPATHSolver.h"
#include "BulletSoftBody/btDefaultSoftBodySolver.h"
#include "BulletSoftBody/btSoftBody.h"
#include "BulletSoftBody/btSoftBodyHelpers.h"
#include "BulletSoftBody/btSoftBodyRigidBodyCollisionConfiguration.h"
#include "BulletSoftBody/btSoftRigidDynamicsWorld.h"
#include "BulletCollision/Gimpact/btGImpactCollisionAlgorithm.h"
#include "BulletCollision/Gimpact/btGImpactShape.h"

#include "LinearMath/btQuaternion.h"

//Web IDL doesn't seem to support C++ templates so this is the best we can do
//https://stackoverflow.com/questions/42517010/is-there-a-way-to-create-webidl-bindings-for-c-templated-types#comment82966925_42517010
typedef btAlignedObjectArray<btVector3> btVector3Array;
typedef btAlignedObjectArray<btQuaternion> btQuaternionArray;
typedef btAlignedObjectArray<btMatrix3x3> btMatrix3x3Array;
typedef btAlignedObjectArray<btFace> btFaceArray;
typedef btAlignedObjectArray<int> btIntArray;
typedef btAlignedObjectArray<btIndexedMesh> btIndexedMeshArray;
typedef btAlignedObjectArray<const btCollisionObject*> btConstCollisionObjectArray;
typedef btAlignedObjectArray<btScalar> btScalarArray;

typedef btAlignedObjectArray<btSolverBody> btSolverBodyArray;

class TopLevelFunctions {
public:
    static btVector3 quatRotate_(const btQuaternion& rotation, const btVector3& v){
        return quatRotate(rotation, v);
    }

    static void set_gContactAddedCallback(void* cb) {
        gContactAddedCallback = (ContactAddedCallback)cb;
    }
};

class AdapterFunctions {
public:
    static void setInternalTickCallback(btDynamicsWorld *world, void* cb, void* worldUserInfo = 0, bool isPreTick = false) {
        world->setInternalTickCallback((btInternalTickCallback)cb, worldUserInfo, isPreTick);
    }
};

class Clone {
public:
    static btVector3* Vector3(const btVector3 &v) {
        return new btVector3(v);
    }

    static btQuaternion* Quaternion(const btQuaternion &q) {
        return new btQuaternion(q);
    }
};

typedef btCollisionObject::CollisionFlags btCollisionObject_CollisionFlags;
typedef btCollisionObject::CollisionObjectTypes btCollisionObject_CollisionObjectTypes;
typedef btCollisionObject::AnisotropicFrictionFlags btCollisionObject_AnisotropicFrictionFlags;
typedef btMultibodyLink::eFeatherstoneJointType btMultibodyLink_eFeatherstoneJointType;
