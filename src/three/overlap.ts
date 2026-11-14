/**
 * Проверка пересечения траекторий кубиков. Поскольку клипы однокубиковые
 * (взаимных столкновений в них нет), мы гарантируем непересечение тем, что
 * сэмплируем готовые траектории и отвергаем расстановку, если кубики
 * сближаются слишком сильно.
 */

import type { Clip } from '../animation/clip';
import { playClip } from '../animation/player';
import type { Vec3 } from '../animation/quat';

export interface DiePlacement {
  clip: Clip;
  rest: Vec3;
  yaw: number;
  timeScale: number;
}

/** True, если хотя бы в один момент времени два кубика сближаются ближе minDist. */
export function placementsOverlap(
  placements: DiePlacement[],
  samples = 60,
  minDist = 1.1,
): boolean {
  for (let s = 0; s <= samples; s++) {
    const t = s / samples;
    const positions = placements.map((p) =>
      playClip(p.clip, { rest: p.rest, yaw: p.yaw, timeScale: p.timeScale }, t).position,
    );
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const dx = positions[i][0] - positions[j][0];
        const dy = positions[i][1] - positions[j][1];
        const dz = positions[i][2] - positions[j][2];
        if (dx * dx + dy * dy + dz * dz < minDist * minDist) {
          return true;
        }
      }
    }
  }
  return false;
}
