import { expect, it } from 'vitest';
import { INITIAL_CAR3_PARAMETERS as values } from '../src/domain/car3-parameters';
import { quoteCar3, decodeCar3Parameters } from '../src/domain/quote-car3';
const parameters = { version: 'car3-initial-2026-10-03-v1', approved: true, values };
it('emite resultado oficial com snapshot completo de parâmetros e regras', () => {
  const result = quoteCar3({ fipeCents: 10000000n, ipvaCategory: 'carro', franquia: 1000 }, parameters);
  expect(result.totalCents).toBe(320000n);
  expect(result.snapshot.parameters.values).toEqual(values);
  expect(result.snapshot.ruleVersion).toBe('car3-pricing-v2');
  expect(result.snapshot.input.context).toEqual({ ipvaCategory: 'carro', franquia: 1000, zeroKm: false });
  expect(Object.isFrozen(result.snapshot.parameters.values.franquiasKm)).toBe(true);
});
it('recusa parâmetros incompletos e sem aprovação', () => {
  expect(() => decodeCar3Parameters({})).toThrow();
  expect(() => decodeCar3Parameters({ ...values, franquiasKm: [0] })).toThrow();
  expect(() => quoteCar3({ fipeCents: 1n, ipvaCategory: 'carro', franquia: 1000 }, { ...parameters, approved: false })).toThrow();
});
