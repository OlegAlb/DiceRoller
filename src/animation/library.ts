/**
 * Библиотека клипов: запечённые оффлайн-физикой траектории (clips.json).
 * Структура: tiers[сила][грань-1][вариант] — три тира силы броска.
 */

import clipsJson from './clips.json';
import type { Clip, Keyframe } from './clip';
import type { Vec3 } from './quat';

interface RawClip {
  frames: number[][];
}
interface RawFace {
  face: number;
  clips: RawClip[];
}

const data = clipsJson as unknown as { tiers: Array<{ faces: RawFace[] }> };

function toClip(face: number, frames: number[][]): Clip {
  const keyframes: Keyframe[] = frames.map((f) => ({
    t: f[0],
    position: [f[1], f[2], f[3]] as Vec3,
    rotation: { x: f[4], y: f[5], z: f[6], w: f[7] },
  }));
  return { face, keyframes };
}

export interface ClipLibrary {
  /** tiers[сила][грань - 1][вариант] */
  tiers: Clip[][][];
}

let cached: ClipLibrary | null = null;

export function getLibrary(): ClipLibrary {
  if (!cached) {
    cached = {
      tiers: data.tiers.map((t) => t.faces.map((f) => f.clips.map((c) => toClip(f.face, c.frames)))),
    };
  }
  return cached;
}
