import { scatterRestPositions } from '../scatterRest';

describe('scatterRestPositions', () => {
  test('returns the requested number of positions', () => {
    expect(scatterRestPositions(1, 3)).toHaveLength(3);
  });

  test('is deterministic for the same seed', () => {
    expect(scatterRestPositions(42, 3)).toEqual(scatterRestPositions(42, 3));
  });

  test('keeps positions within the radius', () => {
    for (const [x, z] of scatterRestPositions(7, 6, 2.0, 1.4)) {
      expect(Math.hypot(x, z)).toBeLessThanOrEqual(2.0 + 1e-9);
    }
  });

  test('keeps a minimum pairwise distance', () => {
    const pts = scatterRestPositions(11, 5, 2.0, 1.4);
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
        expect(d).toBeGreaterThanOrEqual(1.4 - 1e-9);
      }
    }
  });
});
