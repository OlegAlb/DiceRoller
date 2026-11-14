import { getLibrary } from '../../animation/library';
import { placementsOverlap } from '../overlap';

describe('placementsOverlap', () => {
  const lib = getLibrary();

  test('detects overlap when dice share a rest position', () => {
    const clip = lib.tiers[1][0][0]; // medium, face 1, variant 0
    const overlap = placementsOverlap([
      { clip, rest: [0, 0, 0], yaw: 0, timeScale: 1 },
      { clip, rest: [0, 0, 0], yaw: 0, timeScale: 1 },
    ]);
    expect(overlap).toBe(true);
  });

  test('reports no overlap for far-apart rests', () => {
    const clip = lib.tiers[1][0][0];
    const overlap = placementsOverlap([
      { clip, rest: [4, 0, 0], yaw: 0, timeScale: 1 },
      { clip, rest: [-4, 0, 0], yaw: 0, timeScale: 1 },
    ]);
    expect(overlap).toBe(false);
  });
});
