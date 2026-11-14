import { sampleClip } from '../clip';
import { buildLibrary, recordClip } from '../recorder';
import { playClip } from '../player';
import { normalForFace } from '../pose';
import { quatRotateVector } from '../quat';

function faceUp(rotation: { x: number; y: number; z: number; w: number }, face: number): boolean {
  const v = quatRotateVector(rotation, normalForFace(face));
  return Math.hypot(v[0], v[1] - 1, v[2]) < 1e-6;
}

describe('clip pipeline', () => {
  test('recordClip produces a clip ending with the target face up', () => {
    for (let face = 1; face <= 6; face++) {
      const clip = recordClip(face, 123, 30);
      const end = sampleClip(clip, 1);
      expect(faceUp(end.rotation, face)).toBe(true);
    }
  });

  test('recordClip keyframes are ordered 0..1', () => {
    const clip = recordClip(3, 7, 30);
    expect(clip.keyframes[0].t).toBe(0);
    expect(clip.keyframes[clip.keyframes.length - 1].t).toBe(1);
    for (let i = 1; i < clip.keyframes.length; i++) {
      expect(clip.keyframes[i].t).toBeGreaterThan(clip.keyframes[i - 1].t);
    }
  });

  test('sampleClip interpolates and stays finite', () => {
    const clip = recordClip(4, 11, 20);
    for (let i = 0; i <= 50; i++) {
      const s = sampleClip(clip, i / 50);
      for (const n of [s.rotation.x, s.rotation.y, s.rotation.z, s.rotation.w, s.position[0], s.position[1], s.position[2]]) {
        expect(Number.isFinite(n)).toBe(true);
      }
    }
  });

  test('playClip preserves the target face under yaw rotation', () => {
    const clip = recordClip(2, 5, 30);
    for (const yaw of [0, 0.7, Math.PI, 4.2]) {
      const p = playClip(clip, { rest: [1, 0, -1], yaw }, 1);
      expect(faceUp(p.rotation, 2)).toBe(true);
    }
  });

  test('playClip lands at the rest position', () => {
    const clip = recordClip(6, 9, 30);
    const p = playClip(clip, { rest: [0.8, 0, -0.3], yaw: 1.0 }, 1);
    expect(p.position[0]).toBeCloseTo(0.8, 5);
    expect(p.position[2]).toBeCloseTo(-0.3, 5);
  });

  test('playClip is deterministic', () => {
    const clip = recordClip(3, 13, 30);
    const a = playClip(clip, { rest: [0, 0, 0], yaw: 0.5, timeScale: 1.1 }, 0.42);
    const b = playClip(clip, { rest: [0, 0, 0], yaw: 0.5, timeScale: 1.1 }, 0.42);
    expect(a).toEqual(b);
  });

  test('buildLibrary has variants for all six faces', () => {
    const lib = buildLibrary(3, 99);
    expect(lib.variants).toHaveLength(6);
    for (const variants of lib.variants) {
      expect(variants).toHaveLength(3);
    }
  });
});
