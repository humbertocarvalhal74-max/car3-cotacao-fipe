import { expect, it, vi } from 'vitest';
import { ParallelumFipeProvider, parseFipePrice, referenceMonth } from '../src/infrastructure/fipe/parallelum-provider';
const lookup = { vehicleType:'car' as const, fipeCode:'014090-2', modelYear:'2020-5', referenceMonth:'2026-10' };
const price = { vehicleType:1, codeFipe:'014090-2', modelYear:2020, fuel:'Flex', referenceMonth:'outubro de 2026', price:'R$ 118.358,00' };
function transport(data: unknown = price) {
  return vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json([{code:'338',month:'outubro/2026'}])).mockResolvedValueOnce(Response.json(data));
}
it('converte moeda sem ponto flutuante, incluindo valores além de Number seguro', () => {
  expect(parseFipePrice('R$ 118.358,00')).toBe(11835800n);
  expect(parseFipePrice('R$ 90.071.992.547.409,93')).toBe(9007199254740993n);
  for (const value of ['R$ 1.23,00','R$ 0,00','123.45',null]) expect(() => parseFipePrice(value)).toThrow();
});
it('fixa referência mensal, valida identidade e não usa cache', async () => {
  const fetcher = transport();
  const result = await new ParallelumFipeProvider(fetcher).lookup(lookup);
  expect(result).toMatchObject({lookup,valueCents:11835800n,provider:'parallelum-v2'});
  expect(fetcher.mock.calls[1][0]).toBe('https://fipe.parallelum.com.br/api/v2/cars/014090-2/years/2020-5?reference=338');
  expect(fetcher.mock.calls[1][1]).toMatchObject({cache:'no-store',redirect:'error'});
  expect(referenceMonth('outubro/2026')).toBe('2026-10');
});
it.each([{codeFipe:'999999-9'},{modelYear:2021},{fuel:'Diesel'},{vehicleType:2},{referenceMonth:'setembro de 2026'},{price:'R$ inválido'}])('recusa resposta divergente %j', async mismatch => {
  await expect(new ParallelumFipeProvider(transport({...price,...mismatch})).lookup(lookup)).rejects.toThrow();
});
it('não consulta ano sem combustível nem caminhos arbitrários', async () => {
  const fetcher = transport();
  await expect(new ParallelumFipeProvider(fetcher).lookup({...lookup,modelYear:'2020'})).rejects.toThrow();
  await expect(new ParallelumFipeProvider(fetcher).lookup({...lookup,fipeCode:'../test'})).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
it('não substitui referência ausente por mês atual', async () => {
  const fetcher = transport();
  await expect(new ParallelumFipeProvider(fetcher).lookup({...lookup,referenceMonth:'2026-09'})).rejects.toThrow('indisponível');
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it.each([404,429,500])('falha fechada em HTTP %i', async status => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('',{status}));
  await expect(new ParallelumFipeProvider(fetcher).lookup(lookup)).rejects.toThrow();
});
it('propaga cancelamento sem retornar valor fictício', async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_,options) => { options?.signal?.throwIfAborted(); throw new Error('offline'); });
  const controller = new AbortController(); controller.abort();
  await expect(new ParallelumFipeProvider(fetcher).lookup(lookup,controller.signal)).rejects.toThrow();
});
