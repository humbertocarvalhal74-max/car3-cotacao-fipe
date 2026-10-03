/** Centavos inteiros. Transporte JSON/SQL como strings, nunca Number. */
export type Cents = bigint;
export function parseMoney(value: string): Cents {
  if (!/^-?\d+(\.\d{1,2})?$/.test(value)) throw new Error('Valor decimal inválido; use ponto e até 2 casas.');
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = value.replace(/^-/, '').split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  return negative ? -cents : cents;
}
export function formatMoney(value: Cents): string {
  const absolute = value < 0n ? -value : value;
  return `${value < 0n ? '-' : ''}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, '0')}`;
}
export type Rounding = 'toward-zero' | 'half-away-from-zero' | 'half-even';
/** Política obrigatória: nenhuma política comercial de arredondamento implícita. */
export function multiplyRatio(value: Cents, numerator: bigint, denominator: bigint, rounding: Rounding): Cents {
  if (denominator <= 0n) throw new Error('Denominador deve ser positivo.');
  if (!['toward-zero', 'half-away-from-zero', 'half-even'].includes(rounding)) throw new Error('Arredondamento inválido.');
  const product = value * numerator;
  const quotient = product / denominator;
  const remainder = product % denominator;
  const magnitude = remainder < 0n ? -remainder : remainder;
  const twice = magnitude * 2n;
  const increment = rounding !== 'toward-zero' &&
    (twice > denominator || (twice === denominator &&
      (rounding === 'half-away-from-zero' || quotient % 2n !== 0n)));
  return increment ? quotient + (product < 0n ? -1n : 1n) : quotient;
}
