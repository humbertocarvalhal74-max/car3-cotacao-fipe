import 'server-only';
import type { FipeProvider } from '../../domain/fipe-provider';
import { issueQuotation } from '../../application/issue-quotation';
import { createSupabaseClient } from './client';
import { createQuotationRepository } from './quotation-repository';
import { HttpError } from '../../application/http-validation';
type Request = Omit<Parameters<typeof issueQuotation>[1], 'ownerId'>;
/** Ponto de entrada do futuro handler: usuário identificado por token verificado. */
export async function issueAuthenticatedQuotation(accessToken: string, request: Request, fipe: FipeProvider) {
  if (!accessToken.trim()) throw new HttpError(401, 'Autenticação obrigatória.');
  const { data, error } = await createSupabaseClient(accessToken).auth.getUser(accessToken);
  if (error || !data.user) throw new HttpError(401, 'Autenticação inválida.');
  const { data: client, error: clientError } = await createSupabaseClient(accessToken)
    .from('clientes').select('id').eq('id', request.clienteId).maybeSingle();
  if (clientError) throw new HttpError(503, 'Não foi possível verificar o cliente.');
  if (!client) throw new HttpError(404, 'Cliente não encontrado.');
  return issueQuotation({ fipe, repository: createQuotationRepository() }, {
    ...request, ownerId: data.user.id,
  });
}
