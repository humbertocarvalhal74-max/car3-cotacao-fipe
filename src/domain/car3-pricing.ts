import { type Rational, add, divide, multiply, rational } from './rational';
import type { Car3Parameters } from './car3-parameters';
import type { Cents } from './money';

const rate = (bps: string) => {
  const value = integer(bps);
  if (value > 10000n) throw new Error('Taxa deve estar entre 0 e 100%.');
  return rational(value, 10000n);
};
function integer(value: string): bigint {
  if (!/^\d+$/.test(value)) throw new Error('Parâmetro inteiro não negativo obrigatório.');
  return BigInt(value);
}
function positiveInteger(value: number): bigint {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('Inteiro positivo obrigatório.');
  return BigInt(value);
}
export function valorBaseCar3(fipeCents: Cents, descontoBps: string, zeroKm = false): Rational {
  if (fipeCents < 0n) throw new Error('FIPE negativa.');
  const discount = rate(descontoBps);
  if (typeof zeroKm !== 'boolean') throw new Error('Condição zero km inválida.');
  if (zeroKm) return rational(fipeCents);
  return multiply(rational(fipeCents), rational(discount.denominator - discount.numerator, discount.denominator));
}
export function depreciacaoMensal(base: Rational, residualBps: string, meses: number): Rational {
  const residual = rate(residualBps);
  return divide(multiply(base, rational(residual.denominator - residual.numerator, residual.denominator)),
    rational(positiveInteger(meses)));
}
export function custoCapital(capitalProprio: Rational, oportunidadeMesBps: string): Rational {
  return multiply(capitalProprio, rate(oportunidadeMesBps));
}
export function custoAnualSobreFipeMensal(fipeCents: Cents, taxaAnoBps: string): Rational {
  if (fipeCents < 0n) throw new Error('FIPE negativa.');
  return divide(multiply(rational(fipeCents), rate(taxaAnoBps)), rational(12n));
}
export function licenciamentoMensal(licenciamentoAnoCents: string): Rational {
  return rational(integer(licenciamentoAnoCents), 12n);
}
export function custoVariavelKm(p: Car3Parameters): bigint {
  const sum = integer(p.manutencaoPreventivaCentsKm) + integer(p.manutencaoCorretivaCentsKm)
    + integer(p.pneusCentsKm) + integer(p.desgasteCentsKm);
  if (sum !== integer(p.custoVariavelTotalCentsKm)) throw new Error('Componentes divergentes do custo variável total.');
  return sum;
}
export interface Car3Input { fipeCents: Cents; ipvaCategory: 'carro' | 'diesel' | 'moto'; franquia: number | 'livre'; zeroKm?: boolean }
/** Regras confirmadas pelo usuário, versionadas no snapshot. */
export function calculateCar3(input: Car3Input, p: Car3Parameters) {
  if (p.margemInadimplencia !== 'acrescimo' || p.arredondamento !== 'cima' || p.custoVariavel !== 'franquia') {
    throw new Error('Política comercial diverge das regras oficiais CAR3 v1.');
  }
  if (p.baseIpvaSeguro !== 'fipe') throw new Error('Base IPVA/seguro deve ser FIPE.');
  const km = input.franquia === 'livre' ? p.kmLivreInterno : input.franquia;
  positiveInteger(km);
  if (input.franquia !== 'livre' && !p.franquiasKm.includes(km)) throw new Error('Franquia não prevista.');
  const ipvaRate = { carro: p.ipvaCarroAnoBps, diesel: p.ipvaDieselAnoBps, moto: p.ipvaMotoAnoBps }[input.ipvaCategory];
  if (!ipvaRate) throw new Error('Categoria IPVA inválida.');
  const base = valorBaseCar3(input.fipeCents, p.descontoFipeBps, input.zeroKm);
  const breakdown = {
    depreciacao: depreciacaoMensal(base, p.residualBps, p.permanenciaFrotaMeses),
    capital: custoCapital(base, p.oportunidadeMesBps),
    ipva: custoAnualSobreFipeMensal(input.fipeCents, ipvaRate),
    seguro: custoAnualSobreFipeMensal(input.fipeCents, p.seguroAnoBps),
    licenciamento: licenciamentoMensal(p.licenciamentoAnoCents),
    variavel: rational(custoVariavelKm(p) * BigInt(km)),
    telemetria: rational(integer(p.telemetriaMesCents)),
    administracao: rational(integer(p.administracaoMesCents)),
    sinistro: rational(integer(p.reservaSinistroMesCents)),
  };
  const cost = Object.values(breakdown).reduce(add, rational(0n));
  const combined = add(rate(p.margemBps), rate(p.inadimplenciaBps));
  const monthly = multiply(cost, rational(combined.denominator + combined.numerator, combined.denominator));
  const multiple = integer(p.arredondamentoMultiploCents);
  if (multiple === 0n) throw new Error('Múltiplo deve ser positivo.');
  const units = divide(monthly, rational(multiple));
  const rounded = (units.numerator + units.denominator - 1n) / units.denominator;
  return { base, breakdown, custoMensal: cost, precoSemArredondamento: monthly, totalCents: rounded * multiple };
}
