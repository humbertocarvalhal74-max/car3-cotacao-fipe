import { expect, it, vi } from 'vitest';
import { issueQuotation, type QuotationRepository } from '../src/application/issue-quotation';
import { INITIAL_CAR3_PARAMETERS as values } from '../src/domain/car3-parameters';
import type { FipeProvider } from '../src/domain/fipe-provider';
const lookup = { vehicleType: 'car' as const, fipeCode: 'test', modelYear: '2020', referenceMonth: '2026-10' };
const request = { ownerId: 'verified-user', clienteId: 'client', parameterId: 'parameter',
  lookup, ipvaCategory: 'carro' as const, franquia: 1000 };
function fixture() {
  const persist = vi.fn<QuotationRepository['persist']>().mockResolvedValue('quote');
  const repository: QuotationRepository = {
    loadParameters: async () => ({ id: 'parameter', version: 'official-test', approved: true, values }), persist,
  };
  const fipe: FipeProvider = { lookup: async () => ({ lookup: { ...lookup },
    valueCents: 10000000n, provider: 'test-provider', fetchedAt: '2026-10-03T12:00:00Z' }) };
  return { repository, fipe, persist };
}
it('integra provider intercambiável, cálculo exato e persistência de snapshot', async () => {
  const deps = fixture();
  const result = await issueQuotation(deps, request);
  expect(result.id).toBe('quote');
  expect(result.result.totalCents).toBe(320000n);
  expect(deps.persist.mock.calls[0][0].fipe).toMatchObject({ valueCents: '10000000', provider: 'test-provider' });
  expect(deps.persist.mock.calls[0][0].result.snapshot.parameters.values).toEqual(values);
});
it('não persiste resposta FIPE divergente nem falha de fornecedor', async () => {
  const deps = fixture();
  deps.fipe.lookup = async () => ({ lookup: { ...lookup, fipeCode: 'other' }, valueCents: 1n,
    provider: 'test', fetchedAt: '2026-10-03T12:00:00Z' });
  await expect(issueQuotation(deps, request)).rejects.toThrow('diverge');
  expect(deps.persist).not.toHaveBeenCalled();
  deps.fipe.lookup = async () => { throw new Error('Fornecedor indisponível'); };
  await expect(issueQuotation(deps, request)).rejects.toThrow('indisponível');
  expect(deps.persist).not.toHaveBeenCalled();
});
