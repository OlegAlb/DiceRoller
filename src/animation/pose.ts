/**
 * Детерминированная поза кубика: мини-ригидбоди без внешнего движка.
 *
 * pose(t, seed, outcome, rest) — чистая функция без импортов из RN/three.js:
 * - кубик «бросается» с высоты, падает под гравитацией и отскакивает от стола
 *   с коэффициентом восстановления (высоты/длительности отскоков затухают геометрически);
 * - в полёте угловая скорость постоянна, на каждом касании ось вращения «пинается»
 *   (энергия теряется, направление меняется) — как у настоящего кубика;
 * - последний (самый короткий) отскок — это «контроллер»: доворот к нужной грани,
 *   замаскированный ударом о стол, поэтому отдельной фазы доворота не видно;
 * - нижняя точка кубика прижата к столу через supportHeight(q) — не проваливается;
 * - тот же seed → та же траектория; «пропуск» = t = 1.
 */

import type { DieOutcome } from '../engine/roll';
import { mulberry32 } from '../engine/random';
import {
  Quaternion,
  Vec3,
  quatAxisAngle,
  quatFromTo,
  quatMultiply,
  quatNormalize,
  quatRotateVector,
  quatSlerp,
} from './quat';

export interface DiePose {
  rotation: Quaternion;
  position: Vec3;
  scale: number;
}

/** Локальные нормали граней кубика. Противоположные грани в сумме дают 7. */
export const FACE_NORMALS: Record<number, Vec3> = {
  1: [0, 1, 0],
  2: [1, 0, 0],
  3: [0, 0, 1],
  4: [0, 0, -1],
  5: [-1, 0, 0],
  6: [0, -1, 0],
};

const UP: Vec3 = [0, 1, 0];

/** Условная гравитация — нужна только чтобы получить физичные тайминги отскоков. */
const GRAVITY = 30;

export function normalForFace(value: number): Vec3 {
  const normal = FACE_NORMALS[value];
  if (!normal) {
    throw new RangeError(`normalForFace(): unsupported face value ${value}`);
  }
  return normal;
}

/** Ориентация меша, при которой грань `value` смотрит вверх. */
export function rotationForFace(value: number): Quaternion {
  return quatFromTo(normalForFace(value), UP);
}

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/** Случайная единичная ось, равномерно по сфере (детерминирована по rng). */
function randomUnitAxis(rng: { next(): number }): Vec3 {
  for (;;) {
    const x = rng.next() * 2 - 1;
    const y = rng.next() * 2 - 1;
    const z = rng.next() * 2 - 1;
    const len = Math.hypot(x, y, z);
    if (len >= 1e-3 && len <= 1) {
      return [x / len, y / len, z / len];
    }
  }
}

/**
 * Расстояние от центра кубика до его самой нижней точки при повороте q.
 * Для единичного куба (полусторона 0.5): 0.5 (гранью вниз) … sqrt(3)/2 ≈ 0.866 (углом вниз).
 */
function supportHeight(q: Quaternion): number {
  const h = 0.5;
  let minY = Infinity;
  for (const sx of [-h, h]) {
    for (const sy of [-h, h]) {
      for (const sz of [-h, h]) {
        const y = quatRotateVector(q, [sx, sy, sz])[1];
        if (y < minY) minY = y;
      }
    }
  }
  return -minY;
}

/**
 * @param t      нормализованное время [0, 1]
 * @param seed   seed траектории
 * @param outcome выпавшее значение (целевая грань)
 * @param rest   точка приземления [x, y, z]; используются x и z (y = 0 — стол)
 */
export function pose(
  t: number,
  seed: number,
  outcome: DieOutcome,
  rest: Vec3 = [0, 0, 0],
): DiePose {
  const tc = clamp01(t);
  const rng = mulberry32(seed);
  const target = rotationForFace(outcome.value);

  // --- параметры из seed (порядок фиксирован для детерминизма) ---
  const restitution = 0.5 + rng.next() * 0.2; // 0.5..0.7
  const launchHeight = 0.8 + rng.next() * 0.6; // 0.8..1.4 (высота «руки» над столом)
  const bounceCount = 3 + rng.nextInt(3); // число касаний стола: 3..5
  const spinSpeed0 = (3 + rng.next() * 3) * Math.PI * 2; // 3..6 оборотов за единицу времени
  const launchX = (rng.next() * 2 - 1) * 0.6; // точка броска
  const launchZ = (rng.next() * 2 - 1) * 0.5;

  // Угловая скорость постоянна между касаниями; на каждом касании ось меняется
  // и скорость слегка затухает.
  const axes: Vec3[] = [];
  const speeds: number[] = [];
  for (let k = 0; k < bounceCount; k++) {
    axes.push(randomUnitAxis(rng));
    speeds.push(spinSpeed0 * Math.pow(0.85, k));
  }

  // --- времена касаний (физическое время -> нормированное [0,1]) ---
  const tFall = Math.sqrt((2 * launchHeight) / GRAVITY);
  const vImpact = Math.sqrt(2 * GRAVITY * launchHeight);
  const raw: number[] = [tFall];
  let acc = tFall;
  for (let k = 1; k < bounceCount; k++) {
    acc += (2 * Math.pow(restitution, k) * vImpact) / GRAVITY;
    raw.push(acc);
  }
  const impacts = raw.map((v) => v / acc); // impacts[последний] === 1

  // --- вертикаль: падение + параболические отскоки ---
  let y: number;
  if (tc <= impacts[0]) {
    const u = tc / impacts[0];
    y = launchHeight * (1 - u * u); // свободное падение из launchHeight
  } else {
    let k = 1;
    while (k < bounceCount - 1 && tc > impacts[k]) k++;
    const start = impacts[k - 1];
    const dur = impacts[k] - start;
    const u = (tc - start) / dur;
    const peak = launchHeight * Math.pow(restitution, 2 * k); // высота отскока k
    y = peak * 4 * u * (1 - u); // симметричная парабола
  }

  // --- вращение: честный кувырок + контроллер на последнем отскоке ---
  let q: Quaternion;
  if (tc <= impacts[0]) {
    q = quatAxisAngle(axes[0], speeds[0] * tc);
  } else {
    let qAcc = quatAxisAngle(axes[0], speeds[0] * impacts[0]);
    let prevT = impacts[0];
    for (let k = 1; k < bounceCount; k++) {
      const dur = impacts[k] - prevT;
      if (k < bounceCount - 1) {
        // честный участок: вращение вокруг оси axes[k]
        if (tc >= impacts[k]) {
          qAcc = quatMultiply(quatAxisAngle(axes[k], speeds[k] * dur), qAcc);
          prevT = impacts[k];
        } else {
          qAcc = quatMultiply(quatAxisAngle(axes[k], speeds[k] * (tc - prevT)), qAcc);
          break;
        }
      } else {
        // последний отскок: контроллер — доворот к target, замаскированный ударом
        const u = clamp01((tc - prevT) / dur);
        qAcc = quatSlerp(qAcc, target, easeOutQuad(u));
        break;
      }
    }
    q = qAcc;
  }
  q = quatNormalize(q);

  // --- позиция: бросок из точки над столом к месту приземления ---
  const x = launchX + (rest[0] - launchX) * easeOutQuad(tc);
  const z = launchZ + (rest[2] - launchZ) * easeOutQuad(tc);
  const yFinal = Math.max(y, supportHeight(q)); // низ не уходит под стол

  return {
    rotation: q,
    position: [x, yFinal, z],
    scale: 1,
  };
}
