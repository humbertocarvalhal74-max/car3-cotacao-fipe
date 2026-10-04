import 'server-only';
import type { FipeLookup, FipeProvider } from '../../domain/fipe-provider';

const months = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
export function referenceMonth(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Referência FIPE inválida.');
  const match = /^(\p{L}+)(?: de |\/)(\d{4})$/u.exec(value.trim().toLowerCase());
  const month = match ? months.indexOf(match[1]) + 1 : 0;
  if (!match || !month) throw new Error('Referência FIPE inválida.');
  return `${match[2]}-${String(month).padStart(2,'0')}`;
}
export function parseFipePrice(value: unknown): bigint {
  if (typeof value !== 'string' || !/^R\$\s*(?:\d{1,3}(?:\.\d{3})*|\d+),\d{2}$/.test(value)) throw new Error('Preço FIPE inválido.');
  const amount = BigInt(value.replace(/^R\$\s*/, '').replace(/[.,]/g,''));
  if (amount <= 0n) throw new Error('Preço FIPE inválido.');
  return amount;
}
export function validateLookup(input: FipeLookup) {
  if (!['car','motorcycle','truck'].includes(input.vehicleType) || !/^\d{6}-\d$/.test(input.fipeCode) ||
      !/^(?:\d{4}|32000)-[1-6]$/.test(input.modelYear) || !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(input.referenceMonth)) {
    throw new Error('Consulta FIPE inválida; informe ano e combustível.');
  }
}
/** Sem cache ou fallback: cada emissão consulta explicitamente o mês solicitado. */
export class ParallelumFipeProvider implements FipeProvider {
  constructor(private readonly transport: typeof fetch = fetch) {}
  async lookup(request: FipeLookup, signal?: AbortSignal) {
    validateLookup(request);
    const timeout = AbortSignal.timeout(15000);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const get = async (path: string): Promise<unknown> => {
      const response = await this.transport(`https://fipe.parallelum.com.br/api/v2/${path}`, {
        signal: combined, cache: 'no-store', headers: { Accept: 'application/json' }, redirect: 'error',
      });
      if (!response.ok) throw new Error(`Consulta FIPE indisponível (${response.status}).`);
      return response.json();
    };
    const references = await get('references');
    if (!Array.isArray(references)) throw new Error('Referências FIPE inválidas.');
    const selected = references.find(r => r && referenceMonth(r.month) === request.referenceMonth);
    if (!selected || !/^\d+$/.test(String(selected.code))) throw new Error('Mês FIPE indisponível.');
    const types = { car: ['cars',1], motorcycle: ['motorcycles',2], truck: ['trucks',3] } as const;
    const [path,type] = types[request.vehicleType];
    const value = await get(`${path}/${request.fipeCode}/years/${request.modelYear}?reference=${selected.code}`);
    if (!value || typeof value !== 'object') throw new Error('Resposta FIPE inválida.');
    const data = value as Record<string,unknown>;
    const fuels = ['','Gasolina','Álcool','Diesel','Elétrico','Flex','Híbrido'];
    const [year,fuel] = request.modelYear.split('-');
    if (data.codeFipe !== request.fipeCode || data.vehicleType !== type || data.modelYear !== Number(year) ||
        data.fuel !== fuels[Number(fuel)] || referenceMonth(data.referenceMonth) !== request.referenceMonth) {
      throw new Error('Resposta FIPE diverge da consulta.');
    }
    return { lookup: { ...request }, valueCents: parseFipePrice(data.price), provider: 'parallelum-v2', fetchedAt: new Date().toISOString() };
  }
}
