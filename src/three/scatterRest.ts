/**
 * Раскладка мест приземления кубиков с гарантированным зазором между ними.
 * Детерминирована по seed; используется, чтобы кубики не пересекались
 * без необходимости моделировать столкновения.
 */

import { mulberry32 } from '../engine/random';

/**
 * Возвращает `count` пар [x, z] внутри диска радиуса `radius`,
 * с попарным расстоянием не меньше `minDistance` (rejection sampling).
 */
export function scatterRestPositions(
  seed: number,
  count: number,
  radius = 1.1,
  minDistance = 1.2,
): Array<[number, number]> {
  const rng = mulberry32(seed);
  const points: Array<[number, number]> = [];

  for (let attempt = 0; attempt < 2000 && points.length < count; attempt++) {
    const angle = rng.next() * Math.PI * 2;
    const r = Math.sqrt(rng.next()) * radius;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;

    const farEnough = points.every(([px, pz]) => Math.hypot(px - x, pz - z) >= minDistance);
    if (farEnough) {
      points.push([x, z]);
    }
  }

  // Страховка на случай, если rejection не смог разместить (для малых count практически невозможно).
  for (let i = points.length; i < count; i++) {
    points.push([(i - count / 2) * 1.5, 0]);
  }

  return points;
}
