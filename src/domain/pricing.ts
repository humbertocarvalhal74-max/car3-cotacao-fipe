import type { Cents } from './money';
export type Json = null | boolean | string | number | Json[] | { [key: string]: Json };
export interface PricingInput { fipeCents: Cents; context: Record<string, Json> }
export interface Parameters {
  version: string;
  approved: boolean;
  values: Record<string, Json>;
}
export interface PricingRules {
  version: string;
  calculate(input: Readonly<PricingInput>, parameters: Readonly<Parameters>): Cents;
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
}
/** Orquestração pura; implementar PricingRules somente com especificação oficial. */
export function quote(input: PricingInput, parameters: Parameters, rules?: PricingRules) {
  if (!rules) throw new Error('Regras oficiais CAR3 não configuradas.');
  if (!parameters.approved) throw new Error('Parâmetros CAR3 ainda não aprovados.');
  if (!parameters.version.trim() || !rules.version.trim()) throw new Error('Versão obrigatória.');
  if (typeof input.fipeCents !== 'bigint' || input.fipeCents < 0n) throw new Error('FIPE inválida.');
  const inputCopy = freeze(structuredClone(input));
  const parameterCopy = freeze(structuredClone(parameters));
  const total = rules.calculate(inputCopy, parameterCopy);
  if (typeof total !== 'bigint' || total < 0n) throw new Error('Resultado monetário inválido.');
  return freeze({ totalCents: total, snapshot: {
    engineVersion: 'foundation-v1', ruleVersion: rules.version,
    parameters: parameterCopy,
    input: { ...inputCopy, fipeCents: inputCopy.fipeCents.toString() },
    totalCents: total.toString(),
  } });
}
