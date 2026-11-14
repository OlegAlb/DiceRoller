import { RNG_FACTORIES, mulberry32 } from '../random';

const ALGORITHMS = Object.keys(RNG_FACTORIES) as Array<keyof typeof RNG_FACTORIES>;

describe('PRNG algorithms', () => {
  test.each(ALGORITHMS)('%s is deterministic for the same seed', (alg) => {
    const a = RNG_FACTORIES[alg](12345);
    const b = RNG_FACTORIES[alg](12345);
    const seqA = Array.from({ length: 8 }, () => a.next());
    const seqB = Array.from({ length: 8 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  test.each(ALGORITHMS)('%s outputs values in [0, 1)', (alg) => {
    const rng = RNG_FACTORIES[alg](0);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  test.each(ALGORITHMS)('%s nextInt stays within bounds and is an integer', (alg) => {
    const rng = RNG_FACTORIES[alg](777);
    for (let i = 0; i < 1000; i++) {
      const n = rng.nextInt(6);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(6);
    }
  });

  test('nextInt(0) throws', () => {
    const rng = mulberry32(1);
    expect(() => rng.nextInt(0)).toThrow(RangeError);
  });

  test('different seeds give different sequences', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(Array.from({ length: 4 }, () => a.next())).not.toEqual(
      Array.from({ length: 4 }, () => b.next()),
    );
  });

  test('all algorithms are registered', () => {
    expect(ALGORITHMS.slice().sort()).toEqual(['mulberry32', 'sfc32', 'xorshift128']);
  });
});
