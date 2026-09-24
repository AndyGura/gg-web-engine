// Procedurally builds a simple rigged, bone-animated "blockman" placeholder character and bakes
// it to a .glb, for gg-web-engine's player-character examples. Run with plain Node (three.js
// r186, ESM-only) against the repo's hoisted root node_modules/three - needs `npm install` to
// have been run at the repo root at least once (see gg-engine-core-development's local dev
// workflow) so that node_modules/three actually exists.
//
// Usage (from the repo root, after `npm install`):
//   node examples/assets/characters/generate-blockman.mjs examples/assets/characters/blockman.glb
//
// Regenerate/tweak this whenever the placeholder rig, its animation clips, or the clip names
// CharacterAnimationController's DEFAULT_CLIP_MAP (@gg-web-engine/core) expects need to change.
//
// IMPORTANT axis convention: gg-web-engine's 3D worlds are always Z-up (see the engine's own
// CLAUDE.md). Loaded GLB content gets no axis correction at load time (unlike the engine's own
// primitive-shape factories, which rotate three.js's natively Y-up shape generators onto Z).
// three.js/glTF are natively Y-up; there is no "up axis" flag in the glTF format itself, it's a
// pure authoring convention the exporter/importer agree on informally. So this script authors the
// whole rig directly with height along three's own Z axis (feet at z=0, head at top) rather than
// the "natural" three.js Y-up convention, and exports verbatim (no rotation) - the exact same "just
// don't do the usual up-axis conversion" approach the engine's own Blender exporter takes
// (`export_yup=False` in blender-addon/gg_web_engine_exporter/exporter.py), just reached by
// authoring content directly in that target convention instead of converting an existing Z-up
// Blender scene.

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { writeFileSync } from 'node:fs';

// --- Minimal Node polyfill for the two Web APIs GLTFExporter needs that Node doesn't provide
// (Blob is a Node global since v18; FileReader is browser-only) - just enough to satisfy
// `readAsArrayBuffer`/`readAsDataURL` against a real Node `Blob`.
class NodeFileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(buf => {
      this.result = buf;
      this.onloadend && this.onloadend();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then(buf => {
      const base64 = Buffer.from(buf).toString('base64');
      this.result = `data:${blob.type || 'application/octet-stream'};base64,${base64}`;
      this.onloadend && this.onloadend();
    });
  }
}
globalThis.FileReader = NodeFileReader;

// ---------------------------------------------------------------------------------------------
// Bone rig - world-space bind-pose positions (Z-up, meters). Matches a default player capsule
// (radius 0.4, centersDistance 1.0 -> total height 1.8): feet at z=0, top of head at z=1.8.
// +Y is "forward" (matches CharacterController3dEntity.moveDirection's own convention).
// ---------------------------------------------------------------------------------------------
const boneWorldPositions = {
  Hips: [0, 0, 0.9],
  Spine: [0, 0, 1.15],
  Head: [0, 0, 1.45],
  LeftUpperArm: [0.35, 0, 1.25],
  LeftLowerArm: [0.35, 0, 0.9],
  RightUpperArm: [-0.35, 0, 1.25],
  RightLowerArm: [-0.35, 0, 0.9],
  LeftUpperLeg: [0.15, 0, 0.9],
  LeftLowerLeg: [0.15, 0, 0.45],
  RightUpperLeg: [-0.15, 0, 0.9],
  RightLowerLeg: [-0.15, 0, 0.45],
};

const boneParents = {
  Hips: null,
  Spine: 'Hips',
  Head: 'Spine',
  LeftUpperArm: 'Spine',
  LeftLowerArm: 'LeftUpperArm',
  RightUpperArm: 'Spine',
  RightLowerArm: 'RightUpperArm',
  LeftUpperLeg: 'Hips',
  LeftLowerLeg: 'LeftUpperLeg',
  RightUpperLeg: 'Hips',
  RightLowerLeg: 'RightUpperLeg',
};

const boneNames = Object.keys(boneWorldPositions);
const bones = {};
for (const name of boneNames) {
  bones[name] = new THREE.Bone();
  bones[name].name = name;
}
for (const name of boneNames) {
  const parentName = boneParents[name];
  const worldPos = boneWorldPositions[name];
  if (parentName) {
    const parentWorldPos = boneWorldPositions[parentName];
    bones[name].position.set(
      worldPos[0] - parentWorldPos[0],
      worldPos[1] - parentWorldPos[1],
      worldPos[2] - parentWorldPos[2],
    );
    bones[parentName].add(bones[name]);
  } else {
    bones[name].position.set(worldPos[0], worldPos[1], worldPos[2]);
  }
}
const rootBone = bones.Hips;
rootBone.updateMatrixWorld(true);
const boneList = boneNames.map(name => bones[name]);
const skeleton = new THREE.Skeleton(boneList);

// ---------------------------------------------------------------------------------------------
// Body geometry - one box per bone, authored directly in world/bind-pose space (the SkinnedMesh
// itself stays at identity transform, so "world space at bind time" == "geometry local space"),
// rigidly skinned 100% to its own bone (skinWeight [1,0,0,0]).
// ---------------------------------------------------------------------------------------------
const SUIT_COLOR = [0.2, 0.42, 0.78];
const PANTS_COLOR = [0.22, 0.24, 0.3];
const SKIN_COLOR = [0.85, 0.71, 0.58];

const boxParts = [
  { bone: 'Hips', center: [0, 0, 0.85], size: [0.46, 0.27, 0.32], color: PANTS_COLOR },
  { bone: 'Spine', center: [0, 0, 1.16], size: [0.56, 0.3, 0.46], color: SUIT_COLOR },
  { bone: 'Head', center: [0, 0, 1.6], size: [0.34, 0.34, 0.4], color: SKIN_COLOR },
  { bone: 'LeftUpperArm', center: [0.35, 0, 1.075], size: [0.17, 0.17, 0.38], color: SUIT_COLOR },
  { bone: 'LeftLowerArm', center: [0.35, 0, 0.725], size: [0.15, 0.15, 0.36], color: SKIN_COLOR },
  { bone: 'RightUpperArm', center: [-0.35, 0, 1.075], size: [0.17, 0.17, 0.38], color: SUIT_COLOR },
  { bone: 'RightLowerArm', center: [-0.35, 0, 0.725], size: [0.15, 0.15, 0.36], color: SKIN_COLOR },
  { bone: 'LeftUpperLeg', center: [0.15, 0, 0.675], size: [0.21, 0.21, 0.48], color: PANTS_COLOR },
  { bone: 'LeftLowerLeg', center: [0.15, 0.02, 0.25], size: [0.19, 0.26, 0.42], color: PANTS_COLOR },
  { bone: 'RightUpperLeg', center: [-0.15, 0, 0.675], size: [0.21, 0.21, 0.48], color: PANTS_COLOR },
  { bone: 'RightLowerLeg', center: [-0.15, 0.02, 0.25], size: [0.19, 0.26, 0.42], color: PANTS_COLOR },
];

const partGeometries = boxParts.map(part => {
  const geometry = new THREE.BoxGeometry(...part.size);
  geometry.translate(...part.center);

  const vertexCount = geometry.attributes.position.count;
  const boneIndex = boneNames.indexOf(part.bone);

  const skinIndices = new Float32Array(vertexCount * 4);
  const skinWeights = new Float32Array(vertexCount * 4);
  const colors = new Float32Array(vertexCount * 3);
  for (let i = 0; i < vertexCount; i++) {
    skinIndices[i * 4] = boneIndex;
    skinWeights[i * 4] = 1;
    colors[i * 3] = part.color[0];
    colors[i * 3 + 1] = part.color[1];
    colors[i * 3 + 2] = part.color[2];
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
});

const mergedGeometry = mergeGeometries(partGeometries, false);

const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.05 });
const mesh = new THREE.SkinnedMesh(mergedGeometry, material);
mesh.name = 'Blockman';
mesh.add(rootBone);
mesh.bind(skeleton);
mesh.castShadow = true;
mesh.receiveShadow = true;

const scene = new THREE.Scene();
scene.name = 'BlockmanScene';
scene.add(mesh);

// ---------------------------------------------------------------------------------------------
// Animation clips - idle/walk/run/crouch/jump, matching CharacterAnimationController's default
// clip-name-per-state convention (@gg-web-engine/core) so the "Player" level class's
// `display.model.animations` mapping can be omitted entirely in the example.
// ---------------------------------------------------------------------------------------------
const quat = (axis, angleDeg) => new THREE.Quaternion().setFromAxisAngle(axis, THREE.MathUtils.degToRad(angleDeg));
const X = new THREE.Vector3(1, 0, 0);
const REST = new THREE.Quaternion(0, 0, 0, 1);

function quaternionTrack(boneName, times, quaternions) {
  const values = [];
  for (const q of quaternions) values.push(q.x, q.y, q.z, q.w);
  return new THREE.QuaternionKeyframeTrack(`${boneName}.quaternion`, times, values);
}

function positionTrack(boneName, times, positions) {
  const base = bones[boneName].position;
  const values = [];
  for (const [dx, dy, dz] of positions) values.push(base.x + dx, base.y + dy, base.z + dz);
  return new THREE.VectorKeyframeTrack(`${boneName}.position`, times, values);
}

/** A gentle vertical breathing bob on Hips, reused (with a matching duration) so
 * static-ish states (idle/crouch/jump) don't look perfectly frozen. */
function breathingBobTrack(duration) {
  return positionTrack(
    'Hips',
    [0, duration * 0.25, duration * 0.5, duration * 0.75, duration],
    [
      [0, 0, 0],
      [0, 0, 0.012],
      [0, 0, 0],
      [0, 0, -0.012],
      [0, 0, 0],
    ],
  );
}

// idle: standing still, subtle breathing bob only.
const idleDuration = 2.4;
const idleClip = new THREE.AnimationClip('idle', idleDuration, [breathingBobTrack(idleDuration)]);

// walk / run: symmetric gait cycle - opposite-side leg/arm swing about local X (forward/back),
// a matching knee/elbow bend on the swinging-forward half of the cycle, and a double-frequency
// hip bob (a stride bobs up on *each* footfall, i.e. twice per full left-right cycle).
function buildGaitClip(name, duration, swingDeg, bendDeg, hipBobAmount, leanDeg) {
  const t = [0, duration * 0.25, duration * 0.5, duration * 0.75, duration];

  const leftLegSwing = quaternionTrack(
    'LeftUpperLeg',
    t,
    [quat(X, swingDeg), quat(X, 0), quat(X, -swingDeg), quat(X, 0), quat(X, swingDeg)],
  );
  const rightLegSwing = quaternionTrack(
    'RightUpperLeg',
    t,
    [quat(X, -swingDeg), quat(X, 0), quat(X, swingDeg), quat(X, 0), quat(X, -swingDeg)],
  );
  // Knee bends while that leg is swinging forward (its upper-leg angle is positive).
  const leftKneeBend = quaternionTrack(
    'LeftLowerLeg',
    t,
    [quat(X, bendDeg), quat(X, bendDeg * 0.3), quat(X, 0), quat(X, bendDeg * 0.3), quat(X, bendDeg)],
  );
  const rightKneeBend = quaternionTrack(
    'RightLowerLeg',
    t,
    [quat(X, 0), quat(X, bendDeg * 0.3), quat(X, bendDeg), quat(X, bendDeg * 0.3), quat(X, 0)],
  );

  // Arms swing opposite their same-side leg (natural counter-swing gait).
  const leftArmSwing = quaternionTrack(
    'LeftUpperArm',
    t,
    [quat(X, -swingDeg * 0.7), quat(X, 0), quat(X, swingDeg * 0.7), quat(X, 0), quat(X, -swingDeg * 0.7)],
  );
  const rightArmSwing = quaternionTrack(
    'RightUpperArm',
    t,
    [quat(X, swingDeg * 0.7), quat(X, 0), quat(X, -swingDeg * 0.7), quat(X, 0), quat(X, swingDeg * 0.7)],
  );
  const leftElbowBend = quaternionTrack(
    'LeftLowerArm',
    t,
    [quat(X, bendDeg * 0.5), quat(X, bendDeg * 0.2), quat(X, 0), quat(X, bendDeg * 0.2), quat(X, bendDeg * 0.5)],
  );
  const rightElbowBend = quaternionTrack(
    'RightLowerArm',
    t,
    [quat(X, 0), quat(X, bendDeg * 0.2), quat(X, bendDeg * 0.5), quat(X, bendDeg * 0.2), quat(X, 0)],
  );

  const hipBob = positionTrack(
    'Hips',
    t,
    [
      [0, 0, 0],
      [0, 0, -hipBobAmount],
      [0, 0, 0],
      [0, 0, -hipBobAmount],
      [0, 0, 0],
    ],
  );

  const tracks = [
    leftLegSwing,
    rightLegSwing,
    leftKneeBend,
    rightKneeBend,
    leftArmSwing,
    rightArmSwing,
    leftElbowBend,
    rightElbowBend,
    hipBob,
  ];
  if (leanDeg) {
    tracks.push(quaternionTrack('Spine', [0, duration], [quat(X, -leanDeg), quat(X, -leanDeg)]));
  }
  return new THREE.AnimationClip(name, duration, tracks);
}

const walkClip = buildGaitClip('walk', 1.0, 28, 45, 0.04, 0);
const runClip = buildGaitClip('run', 0.55, 45, 65, 0.08, 12);

// crouch: static bent-knee/lowered-hips pose, plus the same breathing bob as idle so it doesn't
// look perfectly frozen.
const crouchDuration = 2.4;
const crouchHipsLowered = -0.32;
const crouchClip = new THREE.AnimationClip('crouch', crouchDuration, [
  positionTrack(
    'Hips',
    [0, crouchDuration * 0.5, crouchDuration],
    [
      [0, 0, crouchHipsLowered],
      [0, 0, crouchHipsLowered + 0.012],
      [0, 0, crouchHipsLowered],
    ],
  ),
  quaternionTrack('LeftUpperLeg', [0, crouchDuration], [quat(X, 70), quat(X, 70)]),
  quaternionTrack('RightUpperLeg', [0, crouchDuration], [quat(X, 70), quat(X, 70)]),
  quaternionTrack('LeftLowerLeg', [0, crouchDuration], [quat(X, -110), quat(X, -110)]),
  quaternionTrack('RightLowerLeg', [0, crouchDuration], [quat(X, -110), quat(X, -110)]),
  quaternionTrack('Spine', [0, crouchDuration], [quat(X, -18), quat(X, -18)]),
]);

// jump: static "hang time" pose (knees tucked up, arms raised) - loops for however long the
// character stays airborne, per CharacterAnimationController's own doc.
const jumpDuration = 1.6;
const jumpClip = new THREE.AnimationClip('jump', jumpDuration, [
  breathingBobTrack(jumpDuration),
  quaternionTrack('LeftUpperLeg', [0, jumpDuration], [quat(X, 55), quat(X, 55)]),
  quaternionTrack('RightUpperLeg', [0, jumpDuration], [quat(X, 55), quat(X, 55)]),
  quaternionTrack('LeftLowerLeg', [0, jumpDuration], [quat(X, -95), quat(X, -95)]),
  quaternionTrack('RightLowerLeg', [0, jumpDuration], [quat(X, -95), quat(X, -95)]),
  quaternionTrack('LeftUpperArm', [0, jumpDuration], [quat(X, -150), quat(X, -150)]),
  quaternionTrack('RightUpperArm', [0, jumpDuration], [quat(X, -150), quat(X, -150)]),
]);

void REST; // kept for reference/symmetry with quat(); unused directly

// ---------------------------------------------------------------------------------------------
// Export to a real binary .glb.
// ---------------------------------------------------------------------------------------------
const exporter = new GLTFExporter();
const glb = await exporter.parseAsync(scene, {
  binary: true,
  animations: [idleClip, walkClip, runClip, crouchClip, jumpClip],
  forceIndices: true,
  truncateDrawRange: false,
});

const outPath = process.argv[2];
if (!outPath) {
  throw new Error('Usage: node build-blockman.mjs <output-path.glb>');
}
writeFileSync(outPath, Buffer.from(glb));
console.log(`Wrote ${outPath} (${(glb.byteLength / 1024).toFixed(1)} KiB)`);
console.log('Bones:', boneNames.join(', '));
console.log('Clips:', [idleClip, walkClip, runClip, crouchClip, jumpClip].map(c => `${c.name} (${c.duration.toFixed(2)}s)`).join(', '));
