/**
 * Проигрывание клипа с процедурными вариациями:
 * - rest — куда приземляется кубик (клип записан в начале координат);
 * - yaw — поворот всего клипа вокруг вертикальной оси (меняет направление подлёта,
 *   но НЕ меняет итоговую грань: поворот вокруг Y сохраняет «верх»);
 * - timeScale — скорость (>= 1, чтобы клип гарантированно успел закончиться к t=1).
 */

import type { Clip } from './clip';
import { sampleClip } from './clip';
import { Vec3, quatAxisAngle, quatMultiply, quatRotateVector } from './quat';
import type { DiePose } from './pose';

export interface PlayOptions {
  rest: Vec3;
  yaw: number;
  timeScale?: number;
}

export function playClip(clip: Clip, opts: PlayOptions, t: number): DiePose {
  const timeScale = opts.timeScale ?? 1;
  const s = sampleClip(clip, t * timeScale);

  const yawQ = quatAxisAngle([0, 1, 0], opts.yaw);
  const pos = quatRotateVector(yawQ, s.position);
  const rotation = quatMultiply(yawQ, s.rotation);

  return {
    rotation,
    position: [pos[0] + opts.rest[0], pos[1], pos[2] + opts.rest[2]],
    scale: 1,
  };
}
