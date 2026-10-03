import { describe, expect, it } from 'vitest';
import { INITIAL_CAR3_PARAMETERS as p } from '../src/domain/car3-parameters';
import { calculateCar3, custoAnualSobreFipeMensal, custoCapital, custoVariavelKm,
  depreciacaoMensal, licenciamentoMensal, valorBaseCar3 } from '../src/domain/car3-pricing';
import { add, divide, multiply, rational } from '../src/domain/rational';
const fipe = 10000000n; // R$ 100.000
describe('fórmulas oficiais já informadas', () => {
  it('base CAR3: FIPE × (1 − 6%)', () => expect(valorBaseCar3(fipe, p.descontoFipeBps)).toEqual(rational(9400000n)));
  it('depreciação: base × (1 − 75%) / 24', () => {
    expect(depreciacaoMensal(rational(9400000n), p.residualBps, 24)).toEqual(rational(293750n, 3n));
  });
  it('capital próprio = base; oportunidade de 0,60% ao mês', () => {
    expect(custoCapital(rational(9400000n), p.oportunidadeMesBps)).toEqual(rational(56400n));
  });
  it.each([['250', 62500n], ['300', 75000n], ['100', 25000n], ['500', 125000n]])(
    'taxa anual %s bps sobre FIPE rateada em 12 meses', (bps, numerator) => {
      expect(custoAnualSobreFipeMensal(fipe, bps)).toEqual(rational(numerator, 3n));
    });
  it('licenciamento R$ 300/ano = R$ 25/mês', () => expect(licenciamentoMensal(p.licenciamentoAnoCents)).toEqual(rational(2500n)));
  it('custo variável: 12 + 7 + 6 + 8 = 33 centavos/km', () => expect(custoVariavelKm(p)).toBe(33n));
  it('recusa componentes divergentes', () => expect(() => custoVariavelKm({ ...p, pneusCentsKm: '7' })).toThrow());
  it('preserva frações e valida denominadores', () => {
    expect(add(rational(1n, 3n), rational(2n, 3n))).toEqual(rational(1n));
    expect(multiply(rational(2n, 3n), rational(3n, 4n))).toEqual(rational(1n, 2n));
    expect(divide(rational(1n, 3n), rational(2n, 3n))).toEqual(rational(1n, 2n));
    expect(rational(-2n, -4n)).toEqual(rational(1n, 2n));
    expect(() => rational(1n, 0n)).toThrow();
    expect(() => divide(rational(1n), rational(0n))).toThrow();
  });
  it('valida domínio das fórmulas', () => {
    expect(() => valorBaseCar3(-1n, '600')).toThrow();
    expect(() => valorBaseCar3(1n, '10001')).toThrow();
    expect(() => valorBaseCar3(1n, '1.1')).toThrow();
    expect(() => depreciacaoMensal(rational(1n), '7500', 0)).toThrow();
  });
});
describe('preço mensal conforme políticas confirmadas', () => {
  const input = { fipeCents: fipe, ipvaCategory: 'carro' as const, franquia: 1000 };
  it('recusa alteração silenciosa da política', () => expect(() => calculateCar3(input, { ...p, margemInadimplencia: 'divisor' })).toThrow('diverge'));
  it('custo mensal conserva todas as frações intermediárias', () => {
    const result = calculateCar3(input, p);
    expect(result.custoMensal).toEqual(rational(836450n, 3n));
    expect(result.breakdown.telemetria).toEqual(rational(9000n));
    expect(result.breakdown.administracao).toEqual(rational(10000n));
    expect(result.breakdown.sinistro).toEqual(rational(7500n));
  });
  it('acréscimo de 13% e próximo múltiplo superior de R$ 50', () => {
    const result = calculateCar3(input, p);
    expect(result.precoSemArredondamento).toEqual(rational(94518850n, 300n));
    expect(result.totalCents).toBe(320000n);
  });
  it.each([1000, 2000, 3000, 'livre'] as const)('franquia %s', franquia => {
    const result = calculateCar3({ ...input, franquia }, p);
    expect(result.breakdown.variavel).toEqual(rational(33n * BigInt(franquia === 'livre' ? 4000 : franquia)));
  });
  it.each(['carro', 'diesel', 'moto'] as const)('categoria IPVA %s', ipvaCategory => {
    const expected = { carro: 62500n, diesel: 75000n, moto: 25000n }[ipvaCategory];
    expect(calculateCar3({ ...input, ipvaCategory }, p).breakdown.ipva).toEqual(rational(expected, 3n));
  });
  it('arredondamento mantém valor que já é múltiplo exato', () => {
    const zero = { ...p, descontoFipeBps: '0', margemBps: '0', inadimplenciaBps: '0', residualBps: '10000',
      oportunidadeMesBps: '0', ipvaCarroAnoBps: '0', seguroAnoBps: '0', licenciamentoAnoCents: '0',
      manutencaoPreventivaCentsKm: '0', manutencaoCorretivaCentsKm: '0', pneusCentsKm: '0', desgasteCentsKm: '0',
      custoVariavelTotalCentsKm: '0', telemetriaMesCents: '5000', administracaoMesCents: '0', reservaSinistroMesCents: '0' };
    expect(calculateCar3(input, zero).totalCents).toBe(5000n);
    expect(calculateCar3(input, { ...zero, telemetriaMesCents: '5001' }).totalCents).toBe(10000n);
    expect(calculateCar3(input, { ...zero, telemetriaMesCents: '0' }).totalCents).toBe(0n);
  });
  it('recusa franquia não prevista, taxa inválida e múltiplo zero', () => {
    expect(() => calculateCar3({ ...input, franquia: 1500 }, p)).toThrow();
    expect(() => calculateCar3(input, { ...p, margemBps: '10001' })).toThrow();
    expect(() => calculateCar3(input, { ...p, arredondamentoMultiploCents: '0' })).toThrow();
  });
});
