/**
 * Внутренние проверки аргументов. Чистый TS, без зависимостей.
 */

export function assertPositiveInt(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer, got ${value}`);
  }
}
