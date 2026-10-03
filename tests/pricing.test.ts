import { expect, it } from 'vitest';
import { quote, type PricingRules } from '../src/domain/pricing';
const input = { fipeCents: 12345n, context: { nested: { value: 'original' } } };
const parameters = { version: 'test-only', approved: true, values: { fee: '0' } };
// Double de teste, não é fórmula CAR3.
const rules: PricingRules = { version: 'test-only', calculate: i => i.fipeCents };
it('bloqueia fórmula ausente', () => expect(() => quote(input, parameters)).toThrow('não configuradas'));
it('bloqueia seed pendente', () => expect(() => quote(input, { ...parameters, approved: false }, rules)).toThrow('não aprovados'));
it('snapshot independente, serializável e profundamente congelado', () => {
  const mutableInput = structuredClone(input);
  const mutableParameters = structuredClone(parameters);
  const result = quote(mutableInput, mutableParameters, rules);
  mutableParameters.values.fee = '999';
  mutableInput.context.nested.value = 'changed';
  expect(result.snapshot.parameters.values.fee).toBe('0');
  expect(result.snapshot.input.context.nested).toEqual({ value: 'original' });
  expect(Object.isFrozen(result.snapshot.parameters.values)).toBe(true);
  expect(JSON.parse(JSON.stringify(result.snapshot)).totalCents).toBe('12345');
});
it('recusa entradas e resultados monetários inválidos', () => {
  expect(() => quote({ ...input, fipeCents: -1n }, parameters, rules)).toThrow();
  expect(() => quote(input, parameters, { ...rules, calculate: () => -1n })).toThrow();
  expect(() => quote(input, { ...parameters, version: '' }, rules)).toThrow();
});
