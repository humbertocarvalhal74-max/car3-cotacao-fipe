import { describe, expect, it } from 'vitest';
import { formatMoney, multiplyRatio, parseMoney } from '../src/domain/money';
describe('aritmética monetária exata', () => {
  it.each([['0', 0n], ['0.1', 10n], ['0.29', 29n], ['-1.01', -101n],
    ['9007199254740993.01', 900719925474099301n]])('converte %s', (input, expected) => {
    expect(parseMoney(input)).toBe(expected);
    expect(parseMoney(formatMoney(expected))).toBe(expected);
  });
  it.each(['1.001', '1,00', 'NaN', 'Infinity', '1e3', '', ' 1', '.5'])('recusa %s', input => {
    expect(() => parseMoney(input)).toThrow();
  });
  it('0.10 + 0.20 é exatamente 0.30', () => {
    expect(formatMoney(parseMoney('0.10') + parseMoney('0.20'))).toBe('0.30');
  });
  it.each([
    [5n, 'toward-zero', 2n], [-5n, 'toward-zero', -2n],
    [5n, 'half-away-from-zero', 3n], [-5n, 'half-away-from-zero', -3n],
    [5n, 'half-even', 2n], [7n, 'half-even', 4n],
    [-5n, 'half-even', -2n], [-7n, 'half-even', -4n],
  ] as const)('arredonda %s com %s', (value, rounding, expected) => {
    expect(multiplyRatio(value, 1n, 2n, rounding)).toBe(expected);
  });
  it('cobre abaixo/acima de meio, exato, negativo e zero', () => {
    expect(multiplyRatio(14n, 1n, 10n, 'half-even')).toBe(1n);
    expect(multiplyRatio(16n, 1n, 10n, 'half-even')).toBe(2n);
    expect(multiplyRatio(20n, 1n, 10n, 'half-even')).toBe(2n);
    expect(multiplyRatio(16n, -1n, 10n, 'half-even')).toBe(-2n);
    expect(multiplyRatio(0n, 1n, 10n, 'half-even')).toBe(0n);
  });
  it.each([0n, -1n])('recusa denominador %s', denominator => {
    expect(() => multiplyRatio(1n, 1n, denominator, 'half-even')).toThrow();
  });
});
