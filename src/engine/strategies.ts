/**
 * Стратегии выбора seed. Они отличаются только тем, ОТКУДА берётся seed;
 * сам поток чисел всегда детерминирован (см. random.ts), поэтому любой
 * бросок остаётся воспроизводимым по сохранённому seed.
 */

export type StrategyId = 'seeded' | 'system' | 'crypto';

type CryptoLike = {
  getRandomValues?: (array: Uint32Array) => void;
};

function getCrypto(): CryptoLike | undefined {
  return (globalThis as { crypto?: CryptoLike }).crypto;
}

/** Seed из Math.random + времени (не криптостойкий, но быстрый). */
export function systemSeed(): number {
  const rand = Math.floor(Math.random() * 0x100000000);
  return (rand ^ (Date.now() & 0xffffffff)) >>> 0;
}

/** Seed из криптографического источника, если он доступен; иначе fallback на systemSeed. */
export function cryptoSeed(): number {
  const crypto = getCrypto();
  if (crypto?.getRandomValues) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] >>> 0;
  }
  return systemSeed();
}
