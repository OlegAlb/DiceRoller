import { sampleClip } from '../clip';
import { getLibrary } from '../library';
import { normalForFace } from '../pose';
import { quatRotateVector } from '../quat';

describe('baked clip library', () => {
  test('has 3 strength tiers, 6 faces, 3 variants each', () => {
    const lib = getLibrary();
    expect(lib.tiers).toHaveLength(3);
    for (const tier of lib.tiers) {
      expect(tier).toHaveLength(6);
      for (const variants of tier) {
        expect(variants).toHaveLength(3);
      }
    }
  });

  test('every clip ends with its own face pointing up', () => {
    const lib = getLibrary();
    lib.tiers.forEach((tier) => {
      tier.forEach((variants, faceIdx) => {
        const face = faceIdx + 1;
        for (const clip of variants) {
          expect(clip.face).toBe(face);
          const end = sampleClip(clip, 1);
          const up = quatRotateVector(end.rotation, normalForFace(face));
          expect(Math.hypot(up[0], up[1] - 1, up[2])).toBeLessThan(0.05);
        }
      });
    });
  });

  test('clips have motion (not all keyframes identical)', () => {
    const lib = getLibrary();
    const clip = lib.tiers[1][2][0]; // medium, face 3, variant 0
    const first = clip.keyframes[0];
    const last = clip.keyframes[clip.keyframes.length - 1];
    const moved =
      Math.hypot(first.position[0] - last.position[0], first.position[2] - last.position[2]) > 0.05 ||
      Math.hypot(first.position[1] - last.position[1]) > 0.05;
    expect(moved).toBe(true);
  });
});
