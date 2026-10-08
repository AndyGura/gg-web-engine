import { Pnt3, Point3, Point4, Qtrn } from '@gg-web-engine/core';

type Mat3 = number[][];

function frameMatrix(frame: Point4): Mat3 {
  const cols = [Pnt3.rot(Pnt3.X, frame), Pnt3.rot(Pnt3.Y, frame), Pnt3.rot(Pnt3.Z, frame)];
  return [0, 1, 2].map(r => cols.map(c => [c.x, c.y, c.z][r]));
}

/** Eigen-decomposition of a symmetric 3x3 matrix (cyclic Jacobi): eigenvalues, eigenvectors as columns. */
function symmetricEigen(a: Mat3): { values: number[]; vectors: Mat3 } {
  const m = a.map(row => [...row]);
  const v: Mat3 = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  for (let sweep = 0; sweep < 50; sweep++) {
    const off = m[0][1] ** 2 + m[0][2] ** 2 + m[1][2] ** 2;
    if (off < 1e-24) {
      break;
    }
    for (const [p, q] of [
      [0, 1],
      [0, 2],
      [1, 2],
    ]) {
      if (Math.abs(m[p][q]) < 1e-30) {
        continue;
      }
      const theta = (m[q][q] - m[p][p]) / (2 * m[p][q]);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1);
      const s = t * c;
      for (let k = 0; k < 3; k++) {
        const mkp = m[k][p];
        const mkq = m[k][q];
        m[k][p] = c * mkp - s * mkq;
        m[k][q] = s * mkp + c * mkq;
      }
      for (let k = 0; k < 3; k++) {
        const mpk = m[p][k];
        const mqk = m[q][k];
        m[p][k] = c * mpk - s * mqk;
        m[q][k] = s * mpk + c * mqk;
      }
      for (let k = 0; k < 3; k++) {
        const vkp = v[k][p];
        const vkq = v[k][q];
        v[k][p] = c * vkp - s * vkq;
        v[k][q] = s * vkp + c * vkq;
      }
    }
  }
  return { values: [m[0][0], m[1][1], m[2][2]], vectors: v };
}

/**
 * The principal inertia and its frame of a body about its own origin, given the body's mass
 * properties about its centre of mass (`com`, in body space): the parallel-axis theorem applied to
 * the inertia tensor, then diagonalized again.
 */
export function inertiaAboutOrigin(
  mass: number,
  com: Point3,
  principal: Point3,
  frame: Point4,
): { principal: Point3; frame: Point4 } {
  const r = frameMatrix(frame);
  const p = [principal.x, principal.y, principal.z];
  const c = [com.x, com.y, com.z];
  const c2 = c[0] * c[0] + c[1] * c[1] + c[2] * c[2];
  const tensor: Mat3 = [0, 1, 2].map(i =>
    [0, 1, 2].map(
      j =>
        r[i][0] * p[0] * r[j][0] +
        r[i][1] * p[1] * r[j][1] +
        r[i][2] * p[2] * r[j][2] +
        mass * ((i === j ? c2 : 0) - c[i] * c[j]),
    ),
  );
  const { values, vectors } = symmetricEigen(tensor);
  const det =
    vectors[0][0] * (vectors[1][1] * vectors[2][2] - vectors[1][2] * vectors[2][1]) -
    vectors[0][1] * (vectors[1][0] * vectors[2][2] - vectors[1][2] * vectors[2][0]) +
    vectors[0][2] * (vectors[1][0] * vectors[2][1] - vectors[1][1] * vectors[2][0]);
  if (det < 0) {
    for (let k = 0; k < 3; k++) {
      vectors[k][2] = -vectors[k][2];
    }
  }
  return {
    principal: { x: values[0], y: values[1], z: values[2] },
    frame: Qtrn.fromMatrix3(vectors),
  };
}
