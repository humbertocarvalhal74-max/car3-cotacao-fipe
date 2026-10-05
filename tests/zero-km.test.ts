import { expect, it, vi } from 'vitest';
import { calculateCar3, valorBaseCar3 } from '../src/domain/car3-pricing';
import { INITIAL_CAR3_PARAMETERS as values } from '../src/domain/car3-parameters';
import { rational } from '../src/domain/rational';
import { quoteCar3 } from '../src/domain/quote-car3';
import { quotationMemory } from '../src/application/quotation-memory';
import { issueQuotation } from '../src/application/issue-quotation';
const input = { fipeCents:10000000n,ipvaCategory:'carro' as const,franquia:1000 };
it('zero km usa FIPE integral, usado mantém desconto', () => {
  expect(valorBaseCar3(input.fipeCents,'600',true)).toEqual(rational(10000000n));
  expect(valorBaseCar3(input.fipeCents,'600',false)).toEqual(rational(9400000n));
  const used = calculateCar3(input,values), fresh = calculateCar3({...input,zeroKm:true},values);
  expect(used.totalCents).toBe(320000n); expect(fresh.totalCents).toBe(330000n);
  expect(fresh.breakdown.ipva).toEqual(used.breakdown.ipva);
  expect(fresh.breakdown.seguro).toEqual(used.breakdown.seguro);
  expect(fresh.breakdown.depreciacao).toEqual(rational(10000000n,96n));
  expect(fresh.breakdown.capital).toEqual(rational(60000n));
});
it('snapshot v2 registra condição e memória v1 mantém regra histórica', () => {
  const q = quoteCar3({...input,zeroKm:true},{version:'p1',approved:true,values});
  expect(q.snapshot.input.context.zeroKm).toBe(true);
  const snapshot={engine_version:q.snapshot.engineVersion,rule_version:q.snapshot.ruleVersion,parameter_version:'p1',parameters_json:values,input_json:q.snapshot.input};
  expect(quotationMemory(snapshot,'330000').rows[1]).toEqual(['Base CAR3 zero km — 100% da FIPE','R$ 100.000,00']);
  expect(quotationMemory({...snapshot,rule_version:'car3-pricing-v1'},'320000').rows[1][1]).toBe('R$ 94.000,00');
  expect(() => quotationMemory({...snapshot,input_json:{fipeCents:'10000000',context:{ipvaCategory:'carro',franquia:1000}}},'330000')).toThrow();
});
it.each([['car','32000-1',true],['car','32000-5',true],['car','2026-5',false],['motorcycle','32000-1',false],['truck','32000-3',false]])('determina zero km pela FIPE validada %s %s',async (vehicleType,modelYear,expected) => {
  const lookup={vehicleType:vehicleType as 'car'|'motorcycle'|'truck',modelYear:String(modelYear),fipeCode:'014090-2',referenceMonth:'2026-10'};
  const persist=vi.fn().mockResolvedValue('q');
  const result=await issueQuotation({repository:{loadParameters:async()=>({id:'p',version:'p1',approved:true,values}),persist},fipe:{lookup:async()=>({lookup,valueCents:10000000n,provider:'test',fetchedAt:'2026-10-04T12:00:00Z'})}}, {ownerId:'u',clienteId:'c',parameterId:'p',lookup,ipvaCategory:'carro',franquia:1000});
  expect(result.result.snapshot.input.context.zeroKm).toBe(expected);
});
