import { roll } from '../roll';
import type { RollRequest } from '../roll';

describe('roll()', () => {
  test('is reproducible for the same seed', () => {
    const a = roll({ dice: 3, sides: 6, strategy: 'seeded', seed: 42 });
    const b = roll({ dice: 3, sides: 6, strategy: 'seeded', seed: 42 });
    expect(a.dice).toEqual(b.dice);
    expect(a.total).toBe(b.total);
    expect(a.seed).toBe(42);
  });

  test('computes the total as a sum of dice', () => {
    const r = roll({ dice: 5, sides: 6, seed: 7 });
    expect(r.total).toBe(r.dice.reduce((sum, d) => sum + d.value, 0));
    expect(r.dice).toHaveLength(5);
    expect(r.dice.map((d) => d.index)).toEqual([0, 1, 2, 3, 4]);
  });

  test('values are within 1..sides', () => {
    const r = roll({ dice: 100, sides: 6, seed: 1 });
    for (const d of r.dice) {
      expect(d.value).toBeGreaterThanOrEqual(1);
      expect(d.value).toBeLessThanOrEqual(6);
    }
  });

  test('strategy "seeded" without seed throws', () => {
    expect(() => roll({ strategy: 'seeded' })).toThrow(/requires an explicit seed/);
  });

  test('non-integer seed throws', () => {
    expect(() => roll({ seed: 1.5 })).toThrow(TypeError);
  });

  test.each([
    ['dice', 0],
    ['dice', -1],
    ['sides', 0],
    ['sides', 3.5],
  ])('invalid %s (%p) throws', (key, value) => {
    expect(() => roll({ [key]: value } as unknown as RollRequest)).toThrow(RangeError);
  });

  test('system strategy stores a seed so the roll is reproducible', () => {
    const r = roll({ dice: 2, strategy: 'system' });
    expect(Number.isInteger(r.seed)).toBe(true);
    const replay = roll({ dice: 2, strategy: 'seeded', seed: r.seed });
    expect(replay.dice).toEqual(r.dice);
  });

  test('crypto strategy stores a seed so the roll is reproducible', () => {
    const r = roll({ dice: 2, strategy: 'crypto' });
    expect(Number.isInteger(r.seed)).toBe(true);
    const replay = roll({ dice: 2, strategy: 'seeded', seed: r.seed });
    expect(replay.dice).toEqual(r.dice);
  });

  test('2d6 distribution is sane', () => {
    const counts = new Map<number, number>();
    for (let i = 0; i < 10000; i++) {
      const r = roll({ dice: 2, sides: 6, strategy: 'system' });
      expect(r.total).toBeGreaterThanOrEqual(2);
      expect(r.total).toBeLessThanOrEqual(12);
      counts.set(r.total, (counts.get(r.total) ?? 0) + 1);
    }
    for (let sum = 2; sum <= 12; sum++) {
      expect(counts.get(sum) ?? 0).toBeGreaterThan(0);
    }
  });

  test('same seed with different algorithms stays valid', () => {
    const a = roll({ dice: 20, seed: 9, algorithm: 'mulberry32' });
    const b = roll({ dice: 20, seed: 9, algorithm: 'sfc32' });
    expect(a.dice).toHaveLength(20);
    expect(b.dice).toHaveLength(20);
    for (const d of [...a.dice, ...b.dice]) {
      expect(d.value).toBeGreaterThanOrEqual(1);
      expect(d.value).toBeLessThanOrEqual(6);
    }
  });
});
