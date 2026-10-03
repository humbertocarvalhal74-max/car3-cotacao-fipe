import 'server-only';
import type { FipeProvider } from '../../domain/fipe-provider';
import { issueQuotation } from '../../application/issue-quotation';
import { createSupabaseClient } from './client';
import { createQuotationRepository } from './quotation-repository';
type Request = Omit<Parameters<typeof issueQuotation>[1], 'ownerId'>;
/** Ponto de entrada do futuro handler: usuário identificado por token verificado. */
export async function issueAuthenticatedQuotation(accessToken: string, request: Request, fipe: FipeProvider) {
  if (!accessToken.trim()) throw new Error('Autenticação obrigatória.');
  const { data, error } = await createSupabaseClient(accessToken).auth.getUser(accessToken);
  if (error || !data.user) throw new Error('Autenticação inválida.');
  return issueQuotation({ fipe, repository: createQuotationRepository() }, {
    ...request, ownerId: data.user.id,
  });
}
