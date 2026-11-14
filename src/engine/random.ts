/**
 * Детерминированные PRNG. Один и тот же seed всегда даёт один и тот же поток,
 * поэтому результаты воспроизводимы и тестируемы. Никаких импортов из RN.
 */

import { assertPositiveInt } from './assert';

export type RngAlgorithmId = 'mulberry32' | 'xorshift128' | 'sfc32';

/** Единый интерфейс источника случайности для всех стратегий и алгоритмов. */
export interface RandomSource {
  /** Псевдослучайное число в диапазоне [0, 1). */
  next(): number;
  /** Целое число в диапазоне [0, n). */
  nextInt(n: number): number;
}

export type RngFactory = (seed: number) => RandomSource;

function makeNextInt(next: () => number) {
  return (n: number): number => {
    assertPositiveInt(n, 'n');
    return Math.floor(next() * n);
  };
}

/** splitmix32 — расширяет 32-битный seed в поток 32-битных слов (для инициализации). */
function splitmix32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    return (z ^ (z >>> 15)) >>> 0;
  };
}

/** mulberry32 — компактный и быстрый 32-битный PRNG. */
export function mulberry32(seed: number): RandomSource {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, nextInt: makeNextInt(next) };
}

/** xorshift128 — 128-битное состояние, детерминированная инициализация из seed. */
export function xorshift128(seed: number): RandomSource {
  const sm = splitmix32(seed);
  let s0 = sm();
  let s1 = sm();
  let s2 = sm();
  let s3 = sm();
  const next = (): number => {
    let t = s3;
    const x = s0;
    s3 = s2;
    s2 = s1;
    s1 = s0;
    t ^= (t << 11) & 0xffffffff;
    t ^= t >>> 8;
    t ^= x ^ (x >>> 19);
    s0 = t >>> 0;
    return s0 / 4294967296;
  };
  return { next, nextInt: makeNextInt(next) };
}

/** sfc32 — Small Fast Counting, хорошо прошедший статистические тесты. */
export function sfc32(seed: number): RandomSource {
  const sm = splitmix32(seed);
  let a = sm();
  let b = sm();
  let c = sm();
  let d = sm();
  const next = (): number => {
    a = (b ^ (b >>> 9)) >>> 0;
    b = (c + (c << 3)) >>> 0;
    c = ((c << 21) | (c >>> 11)) >>> 0;
    d = (d + 1) >>> 0;
    const t = (a + b + d) >>> 0;
    c = (c + t) >>> 0;
    return t / 4294967296;
  };
  return { next, nextInt: makeNextInt(next) };
}

/** Реестр алгоритмов: сюда добавляются новые, а стратегии используют их через общий интерфейс. */
export const RNG_FACTORIES: Record<RngAlgorithmId, RngFactory> = {
  mulberry32,
  xorshift128,
  sfc32,
};
