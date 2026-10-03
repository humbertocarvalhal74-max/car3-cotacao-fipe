import type { FipeLookup, FipeProvider } from '../domain/fipe-provider';
import { quoteCar3, type Car3ParameterVersion } from '../domain/quote-car3';
import type { Car3Input } from '../domain/car3-pricing';
import type { Json } from '../domain/pricing';
export interface ParameterRecord extends Car3ParameterVersion { id: string }
export interface QuotationRepository {
  loadParameters(id: string): Promise<ParameterRecord>;
  persist(record: {
    ownerId: string; clienteId: string; parameterId: string;
    result: ReturnType<typeof quoteCar3>; fipe: Record<string, Json>;
  }): Promise<string>;
}
/** ownerId deve vir de autenticação verificada no servidor, nunca do corpo HTTP. */
export async function issueQuotation(deps: { fipe: FipeProvider; repository: QuotationRepository }, request: {
  ownerId: string; clienteId: string; parameterId: string; lookup: FipeLookup;
  ipvaCategory: Car3Input['ipvaCategory']; franquia: Car3Input['franquia']; signal?: AbortSignal;
}) {
  const parameters = await deps.repository.loadParameters(request.parameterId);
  const lookup = structuredClone(request.lookup);
  const fipe = await deps.fipe.lookup(lookup, request.signal);
  for (const key of ['vehicleType', 'fipeCode', 'modelYear', 'referenceMonth'] as const) {
    if (fipe.lookup[key] !== request.lookup[key]) throw new Error('Resposta FIPE diverge da consulta.');
  }
  if (!fipe.provider.trim() || !Number.isFinite(Date.parse(fipe.fetchedAt))) throw new Error('Metadados FIPE inválidos.');
  const result = quoteCar3({ fipeCents: fipe.valueCents,
    ipvaCategory: request.ipvaCategory, franquia: request.franquia }, parameters);
  const id = await deps.repository.persist({ ownerId: request.ownerId, clienteId: request.clienteId,
    parameterId: parameters.id, result,
    fipe: { lookup: { ...fipe.lookup }, provider: fipe.provider,
      fetchedAt: fipe.fetchedAt, valueCents: fipe.valueCents.toString() },
  });
  return { id, result };
}
