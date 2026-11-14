import { normalForFace, pose, rotationForFace } from '../pose';
import { quatRotateVector, Vec3 } from '../quat';

function isUp(v: Vec3, eps = 1e-6): boolean {
  return Math.hypot(v[0], v[1] - 1, v[2]) < eps;
}

describe('pose()', () => {
  test('at t=1 the target face points up for every value', () => {
    for (let v = 1; v <= 6; v++) {
      const p = pose(1, 12345, { index: 0, value: v });
      const upDir = quatRotateVector(p.rotation, normalForFace(v));
      expect(isUp(upDir)).toBe(true);
    }
  });

  test('is deterministic for the same seed', () => {
    const a = pose(0.42, 99, { index: 0, value: 4 });
    const b = pose(0.42, 99, { index: 0, value: 4 });
    expect(a).toEqual(b);
  });

  test('clamps t outside [0, 1]', () => {
    const outcome = { index: 0, value: 3 };
    expect(pose(-1, 5, outcome)).toEqual(pose(0, 5, outcome));
    expect(pose(2, 5, outcome)).toEqual(pose(1, 5, outcome));
  });

  test('starts above the table (launch height)', () => {
    const p = pose(0, 42, { index: 0, value: 3 });
    expect(p.position[1]).toBeGreaterThan(0.5);
  });

  test('never sinks below the resting height (face-down on the table)', () => {
    const outcome = { index: 0, value: 2 };
    for (let i = 0; i <= 200; i++) {
      const p = pose(i / 200, 7, outcome);
      expect(p.position[1]).toBeGreaterThanOrEqual(0.5 - 1e-9);
    }
  });

  test('ends resting on the table (face down, y = 0.5)', () => {
    const p = pose(1, 8, { index: 0, value: 5 });
    expect(p.position[1]).toBeCloseTo(0.5, 6);
  });

  test('lands at the rest position at t=1', () => {
    const p = pose(1, 8, { index: 0, value: 5 }, [0.9, 0, -0.4]);
    expect(p.position[0]).toBeCloseTo(0.9, 6);
    expect(p.position[1]).toBeCloseTo(0.5, 6);
    expect(p.position[2]).toBeCloseTo(-0.4, 6);
  });

  test('travels monotonically from the throw origin to the rest position', () => {
    const outcome = { index: 0, value: 4 };
    const rest: Vec3 = [1.2, 0, 0.3];
    const xs = [0, 0.25, 0.5, 0.75, 1].map((t) => pose(t, 17, outcome, rest).position[0]);
    const signs = new Set(xs.slice(1).map((x, i) => Math.sign(x - xs[i])));
    expect(signs.size).toBe(1);
    expect(xs[xs.length - 1]).toBeCloseTo(rest[0], 6);
  });

  test('all components are finite across the whole range', () => {
    const outcome = { index: 0, value: 5 };
    for (let i = 0; i <= 200; i++) {
      const p = pose(i / 200, 31, outcome, [0.5, 0, -0.2]);
      const nums = [
        p.rotation.x, p.rotation.y, p.rotation.z, p.rotation.w,
        p.position[0], p.position[1], p.position[2],
        p.scale,
      ];
      for (const n of nums) {
        expect(Number.isFinite(n)).toBe(true);
      }
    }
  });

  test('different seeds give different trajectories', () => {
    const outcome = { index: 0, value: 3 };
    expect(pose(0.5, 1, outcome)).not.toEqual(pose(0.5, 2, outcome));
  });

  test('rotationForFace rejects invalid values', () => {
    expect(() => rotationForFace(0)).toThrow(RangeError);
    expect(() => rotationForFace(7)).toThrow(RangeError);
  });

  test('final orientation is independent of the seed', () => {
    const a = pose(1, 1, { index: 0, value: 6 });
    const b = pose(1, 999, { index: 0, value: 6 });
    const refA = quatRotateVector(a.rotation, [1, 0, 0]);
    const refB = quatRotateVector(b.rotation, [1, 0, 0]);
    expect(Math.hypot(refA[0] - refB[0], refA[1] - refB[1], refA[2] - refB[2])).toBeLessThan(1e-6);
  });
});
