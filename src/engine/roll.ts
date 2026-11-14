/**
 * Ядро броска: чистая функция, которая по запросу возвращает воспроизводимый результат.
 * Не зависит от React Native, поэтому тестируется в Node/Jest.
 */

import { assertPositiveInt } from './assert';
import { RNG_FACTORIES, RandomSource, RngAlgorithmId } from './random';
import { StrategyId, cryptoSeed, systemSeed } from './strategies';

export interface DieOutcome {
  /** 0-based индекс кубика. */
  index: number;
  /** Выпавшее значение, 1..sides. */
  value: number;
}

export interface RollRequest {
  /** Количество кубиков. По умолчанию 1. */
  dice?: number;
  /** Число граней. По умолчанию 6. */
  sides?: number;
  /** Откуда брать seed. По умолчанию 'seeded'. */
  strategy?: StrategyId;
  /** Какой PRNG использовать. По умолчанию 'mulberry32'. */
  algorithm?: RngAlgorithmId;
  /** Явный seed; обязателен для strategy === 'seeded'. */
  seed?: number;
}

export interface RollResult {
  /** Уникальный id для UI (React key). Не является частью воспроизводимой идентичности. */
  id: string;
  request: {
    dice: number;
    sides: number;
    strategy: StrategyId;
    algorithm: RngAlgorithmId;
  };
  /** Сохранённый seed: по нему любой бросок можно повторить. */
  seed: number;
  dice: DieOutcome[];
  total: number;
}

let rollCounter = 0;

function resolveSeed(strategy: StrategyId, seed?: number): number {
  switch (strategy) {
    case 'seeded':
      if (seed === undefined) {
        throw new Error('roll(): strategy "seeded" requires an explicit seed');
      }
      if (!Number.isInteger(seed)) {
        throw new TypeError(`roll(): seed must be an integer, got ${seed}`);
      }
      return seed >>> 0;
    case 'system':
      return systemSeed();
    case 'crypto':
      return cryptoSeed();
    default: {
      const exhaustive: never = strategy;
      throw new Error(`roll(): unknown strategy ${String(exhaustive)}`);
    }
  }
}

export function roll(req: RollRequest = {}): RollResult {
  const dice = req.dice ?? 1;
  const sides = req.sides ?? 6;
  const strategy = req.strategy ?? 'seeded';
  const algorithm = req.algorithm ?? 'mulberry32';

  assertPositiveInt(dice, 'dice');
  assertPositiveInt(sides, 'sides');

  const seed = resolveSeed(strategy, req.seed);
  const rng: RandomSource = RNG_FACTORIES[algorithm](seed);

  const outcomes: DieOutcome[] = [];
  let total = 0;
  for (let i = 0; i < dice; i++) {
    const value = rng.nextInt(sides) + 1;
    outcomes.push({ index: i, value });
    total += value;
  }

  rollCounter += 1;
  const id = `roll-${rollCounter}-${seed.toString(36)}`;

  return {
    id,
    request: { dice, sides, strategy, algorithm },
    seed,
    dice: outcomes,
    total,
  };
}
