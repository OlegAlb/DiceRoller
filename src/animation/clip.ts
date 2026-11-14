/**
 * Клип — записанная траектория кубика (позиция + ориентация по времени).
 * Хранит только трансформ, без меша/текстур — поэтому один клип играет
 * на любом скине кубика.
 */

import { Quaternion, Vec3, quatSlerp } from './quat';

export interface Keyframe {
  /** нормализованное время [0, 1] */
  t: number;
  position: Vec3;
  rotation: Quaternion;
}

export interface Clip {
  /** грань, которая окажется сверху в конце клипа (1..6) */
  face: number;
  keyframes: Keyframe[];
}

export interface ClipSample {
  position: Vec3;
  rotation: Quaternion;
}

/** Сэмплирует клип в момент t (линейная интерполяция позиции + slerp ориентации). */
export function sampleClip(clip: Clip, t: number): ClipSample {
  const kf = clip.keyframes;
  if (kf.length === 0) {
    throw new Error('sampleClip(): empty clip');
  }
  const tc = t < 0 ? 0 : t > 1 ? 1 : t;

  if (tc <= kf[0].t) {
    return { position: kf[0].position, rotation: kf[0].rotation };
  }
  if (tc >= kf[kf.length - 1].t) {
    const last = kf[kf.length - 1];
    return { position: last.position, rotation: last.rotation };
  }

  let i = 1;
  while (i < kf.length && kf[i].t < tc) i++;
  const a = kf[i - 1];
  const b = kf[i];
  const u = (tc - a.t) / (b.t - a.t);

  return {
    position: [
      a.position[0] + (b.position[0] - a.position[0]) * u,
      a.position[1] + (b.position[1] - a.position[1]) * u,
      a.position[2] + (b.position[2] - a.position[2]) * u,
    ],
    rotation: quatSlerp(a.rotation, b.rotation, u),
  };
}
