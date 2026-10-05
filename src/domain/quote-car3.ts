import { calculateCar3, type Car3Input } from './car3-pricing';
import { INITIAL_CAR3_PARAMETERS, type Car3Parameters } from './car3-parameters';
import { quote, type Json } from './pricing';

export const CAR3_RULE_VERSION = 'car3-pricing-v2';
export interface Car3ParameterVersion {
  version: string; approved: boolean; values: Car3Parameters;
}
/** Validação do JSON vindo do banco; não aplicar defaults sobre valores ausentes. */
export function decodeCar3Parameters(value: unknown): Car3Parameters {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Parâmetros inválidos.');
  const record = value as Record<string, unknown>;
  for (const [key, example] of Object.entries(INITIAL_CAR3_PARAMETERS)) {
    const item = record[key];
    if (Array.isArray(example)) {
      if (!Array.isArray(item) || !item.length || !item.every(n => Number.isSafeInteger(n) && n > 0)) throw new Error(`Parâmetro inválido: ${key}`);
    } else if (typeof item !== typeof example) throw new Error(`Parâmetro ausente ou inválido: ${key}`);
  }
  return structuredClone(value) as Car3Parameters;
}
/** Entrada pura e sem dependência de FIPE provider, banco, React ou Next.js. */
export function quoteCar3(input: Car3Input, parameters: Car3ParameterVersion) {
  const values = decodeCar3Parameters(parameters.values);
  return quote({ fipeCents: input.fipeCents, context: {
    ipvaCategory: input.ipvaCategory, franquia: input.franquia, zeroKm: input.zeroKm ?? false,
  } }, { ...parameters, values: values as unknown as Record<string, Json> }, {
    version: CAR3_RULE_VERSION,
    calculate: (i, p) => calculateCar3({ fipeCents: i.fipeCents,
      ipvaCategory: i.context.ipvaCategory as Car3Input['ipvaCategory'],
      franquia: i.context.franquia as Car3Input['franquia'],
      zeroKm: i.context.zeroKm as boolean,
    }, decodeCar3Parameters(p.values)).totalCents,
  });
}
