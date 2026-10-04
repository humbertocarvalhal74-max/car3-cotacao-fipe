import { expect, it } from 'vitest';
import { quotationMemory, displayMoney } from '../src/application/quotation-memory';
import { INITIAL_CAR3_PARAMETERS as p } from '../src/domain/car3-parameters';
import { rational } from '../src/domain/rational';
const snapshot = { rule_version:'car3-pricing-v1',engine_version:'foundation-v1',parameter_version:'historical-v1',parameters_json:p,
  input_json:{fipeCents:'10000000',context:{ipvaCategory:'carro',franquia:1000}} };
it.each([[1000,'carro','320000'],[2000,'carro','355000'],[3000,'carro','390000'],['livre','carro','430000'],[1000,'diesel','320000'],[1000,'moto','305000']])('confere cenário %s %s contra total preservado', (franquia,ipvaCategory,total) => {
  const memory = quotationMemory({...snapshot,input_json:{fipeCents:'10000000',context:{ipvaCategory,franquia}}},String(total));
  expect(memory.rows.at(-1)?.[1]).toMatch(/^R\$/);
  expect(memory.parameterVersion).toBe('historical-v1');
});
it('recusa total adulterado e versão de regra desconhecida', () => {
  expect(() => quotationMemory(snapshot,'1')).toThrow('diverge');
  expect(() => quotationMemory({...snapshot,rule_version:'future'},'320000')).toThrow('Versão');
});
it('usa parâmetro histórico e não os valores atuais', () => {
  const memory = quotationMemory({...snapshot,parameters_json:{...p,telemetriaMesCents:'0'}},'305000');
  expect(memory.rows.find(r => r[0] === 'Telemetria')?.[1]).toBe('R$ 0,00');
});
it('sinaliza frações e preserva inteiros grandes sem Number', () => {
  expect(displayMoney(rational(1n,3n))).toBe('≈ R$ 0,00');
  expect(displayMoney(rational(9007199254740993n))).toBe('R$ 90.071.992.547.409,93');
});
