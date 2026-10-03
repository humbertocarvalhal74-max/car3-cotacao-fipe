/** Racionais de inteiros: nenhuma perda de frações de centavo intermediárias. */
export interface Rational { readonly numerator: bigint; readonly denominator: bigint }
export function rational(numerator: bigint, denominator = 1n): Rational {
  if (denominator === 0n) throw new Error('Divisão por zero.');
  if (denominator < 0n) { numerator = -numerator; denominator = -denominator; }
  let a = numerator < 0n ? -numerator : numerator;
  let b = denominator;
  while (b !== 0n) [a, b] = [b, a % b];
  return Object.freeze({ numerator: numerator / a, denominator: denominator / a });
}
export function add(a: Rational, b: Rational): Rational {
  return rational(a.numerator * b.denominator + b.numerator * a.denominator, a.denominator * b.denominator);
}
export function multiply(a: Rational, b: Rational): Rational {
  return rational(a.numerator * b.numerator, a.denominator * b.denominator);
}
export function divide(a: Rational, b: Rational): Rational {
  return rational(a.numerator * b.denominator, a.denominator * b.numerator);
}
