/**
 * Минимальная математика кватернионов для слоя анимации.
 * Чистый TS, без зависимостей от RN и three.js — чтобы pose() тестировалась в node.
 */

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export type Vec3 = [number, number, number];

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]);
  return len === 0 ? [0, 0, 0] : [v[0] / len, v[1] / len, v[2] / len];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/** Вектор, перпендикулярный v (для случая противоположных направлений). */
function perpendicular(v: Vec3): Vec3 {
  const a: Vec3 = Math.abs(v[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  return normalize(cross(v, a));
}

export function quatIdentity(): Quaternion {
  return { x: 0, y: 0, z: 0, w: 1 };
}

/** Кватернион поворота вокруг оси `axis` на угол `angle` (радианы). */
export function quatAxisAngle(axis: Vec3, angle: number): Quaternion {
  const len = Math.hypot(axis[0], axis[1], axis[2]);
  if (len === 0) {
    return quatIdentity();
  }
  const h = angle / 2;
  const s = Math.sin(h) / len;
  return {
    x: axis[0] * s,
    y: axis[1] * s,
    z: axis[2] * s,
    w: Math.cos(h),
  };
}

export function quatMultiply(a: Quaternion, b: Quaternion): Quaternion {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

export function quatNormalize(q: Quaternion): Quaternion {
  const len = Math.hypot(q.x, q.y, q.z, q.w);
  if (len === 0) {
    return quatIdentity();
  }
  return { x: q.x / len, y: q.y / len, z: q.z / len, w: q.w / len };
}

/** Сопряжённый кватернион. Для единичного кватерниона равен обратному. */
export function quatConjugate(q: Quaternion): Quaternion {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}

export function quatDot(a: Quaternion, b: Quaternion): number {
  return a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
}

/** Сферическая интерполяция по кратчайшей дуге. t приводится к [0, 1]. */
export function quatSlerp(a: Quaternion, b: Quaternion, t: number): Quaternion {
  const tc = clamp(t, 0, 1);
  let dot = quatDot(a, b);
  let bx = b.x;
  let by = b.y;
  let bz = b.z;
  let bw = b.w;
  if (dot < 0) {
    dot = -dot;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }
  if (dot > 0.9995) {
    const r = {
      x: a.x + (bx - a.x) * tc,
      y: a.y + (by - a.y) * tc,
      z: a.z + (bz - a.z) * tc,
      w: a.w + (bw - a.w) * tc,
    };
    return quatNormalize(r);
  }
  const theta0 = Math.acos(dot);
  const theta = theta0 * tc;
  const sinTheta0 = Math.sin(theta0);
  const s0 = Math.sin(theta0 - theta) / sinTheta0;
  const s1 = Math.sin(theta) / sinTheta0;
  return {
    x: a.x * s0 + bx * s1,
    y: a.y * s0 + by * s1,
    z: a.z * s0 + bz * s1,
    w: a.w * s0 + bw * s1,
  };
}

/** Поворот вектора v кватернионом q (v' = q * v * q^-1). */
export function quatRotateVector(q: Quaternion, v: Vec3): Vec3 {
  const qv: Quaternion = { x: v[0], y: v[1], z: v[2], w: 0 };
  const qc: Quaternion = { x: -q.x, y: -q.y, z: -q.z, w: q.w };
  const r = quatMultiply(quatMultiply(q, qv), qc);
  return [r.x, r.y, r.z];
}

/** Поворот, переводящий направление `from` в `to` (оба предполагаются ненулевыми). */
export function quatFromTo(from: Vec3, to: Vec3): Quaternion {
  const dot = clamp(from[0] * to[0] + from[1] * to[1] + from[2] * to[2], -1, 1);
  if (dot > 0.999999) {
    return quatIdentity();
  }
  if (dot < -0.999999) {
    return quatAxisAngle(perpendicular(to), Math.PI);
  }
  return quatAxisAngle(normalize(cross(from, to)), Math.acos(dot));
}
