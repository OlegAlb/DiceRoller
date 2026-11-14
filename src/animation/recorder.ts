/**
 * Рекордер клипов. Источник траектории — аналитический солвер pose()
 * (используется как fallback и в тестах); боевая библиотека печётся
 * оффлайн-физикой в scripts/bake.mjs.
 */

import { pose } from './pose';
import type { Clip, Keyframe } from './clip';

/** Записывает клип «кувырок, оканчивающийся гранью `face` вверх». */
export function recordClip(face: number, seed: number, frames = 60): Clip {
  const keyframes: Keyframe[] = [];
  for (let i = 0; i < frames; i++) {
    const t = frames === 1 ? 1 : i / (frames - 1);
    const p = pose(t, seed, { index: 0, value: face }, [0, 0, 0]);
    keyframes.push({ t, position: p.position, rotation: p.rotation });
  }
  return { face, keyframes };
}

export interface ClipLibrary {
  /** variants[face - 1] — список вариантов для грани face. */
  variants: Clip[][];
}

/** Собирает библиотеку: по `variantsPerFace` клипов на каждую из 6 граней. */
export function buildLibrary(variantsPerFace = 3, seedBase = 1): ClipLibrary {
  const variants: Clip[][] = [];
  for (let face = 1; face <= 6; face++) {
    const list: Clip[] = [];
    for (let v = 0; v < variantsPerFace; v++) {
      list.push(recordClip(face, seedBase + face * 101 + v * 37));
    }
    variants.push(list);
  }
  return { variants };
}
