import {
  Quaternion,
  quatAxisAngle,
  quatFromTo,
  quatIdentity,
  quatMultiply,
  quatNormalize,
  quatRotateVector,
  quatSlerp,
  Vec3,
} from '../quat';

function closeVec(a: Vec3, b: Vec3, eps = 1e-6): boolean {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < eps;
}

describe('quaternions', () => {
  test('identity * q == q', () => {
    const q = quatAxisAngle([0, 0, 1], 1.23);
    expect(quatMultiply(quatIdentity(), q)).toEqual(q);
  });

  test('axisAngle is unit length', () => {
    const q = quatAxisAngle([1, 2, 3], 0.7);
    expect(Math.hypot(q.x, q.y, q.z, q.w)).toBeCloseTo(1, 10);
  });

  test('rotating +X by 90deg around +Z gives +Y', () => {
    const q = quatAxisAngle([0, 0, 1], Math.PI / 2);
    expect(closeVec(quatRotateVector(q, [1, 0, 0]), [0, 1, 0])).toBe(true);
  });

  test('quatFromTo maps from to to for every cardinal face normal', () => {
    const cases: Array<[Vec3, Vec3]> = [
      [[1, 0, 0], [0, 1, 0]],
      [[0, 1, 0], [0, 1, 0]],
      [[0, 0, 1], [0, 1, 0]],
      [[0, 0, -1], [0, 1, 0]],
      [[-1, 0, 0], [0, 1, 0]],
      [[0, -1, 0], [0, 1, 0]],
    ];
    for (const [from, to] of cases) {
      expect(closeVec(quatRotateVector(quatFromTo(from, to), from), to)).toBe(true);
    }
  });

  test('slerp endpoints are rotation-equivalent', () => {
    const a = quatAxisAngle([0, 0, 1], 0.3);
    const b = quatAxisAngle([1, 0, 0], 1.9);
    const at0 = quatSlerp(a, b, 0);
    const at1 = quatSlerp(a, b, 1);
    expect(closeVec(quatRotateVector(at0, [1, 0, 0]), quatRotateVector(a, [1, 0, 0]))).toBe(true);
    expect(closeVec(quatRotateVector(at1, [1, 0, 0]), quatRotateVector(b, [1, 0, 0]))).toBe(true);
  });

  test('normalize returns a unit quaternion', () => {
    const q: Quaternion = { x: 3, y: 4, z: 0, w: 0 };
    const n = quatNormalize(q);
    expect(Math.hypot(n.x, n.y, n.z, n.w)).toBeCloseTo(1, 10);
  });
});
