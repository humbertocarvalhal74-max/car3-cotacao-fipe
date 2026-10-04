import { requireSession } from '@/infrastructure/supabase/session';
import { failure, json } from '@/infrastructure/http/response';
import { checkOrigin, readBody, success } from '@/infrastructure/http/response';
import { fixtureRequest, object, text, HttpError } from '@/application/http-validation';
import { ParallelumFipeProvider, validateLookup } from '@/infrastructure/fipe/parallelum-provider';
import { issueAuthenticatedQuotation } from '@/infrastructure/supabase/issue-authenticated-quotation';
import type { FipeLookup } from '@/domain/fipe-provider';
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { accessToken } = await requireSession();
    const body = object(await readBody(request));
    const input = fixtureRequest(body);
    const lookup: FipeLookup = { vehicleType: text(body.vehicleType, 'vehicleType') as FipeLookup['vehicleType'],
      fipeCode: text(body.fipeCode,'fipeCode',8), modelYear: text(body.modelYear,'modelYear',7),
      referenceMonth: text(body.referenceMonth,'referenceMonth',7) };
    try { validateLookup(lookup); } catch { throw new HttpError(400,'Consulta FIPE inválida. Informe código, ano-combustível e mês.'); }
    const quotation = await issueAuthenticatedQuotation(accessToken, { ...input, lookup, signal: request.signal }, new ParallelumFipeProvider());
    return success(request, { id: quotation.id, totalCents: quotation.result.totalCents.toString() }, 'cotacaoReal', 201);
  } catch (error) { return failure(error); }
}
export async function GET() {
  try {
    const { db } = await requireSession();
    // PostgREST retorna bigint como JSON number; converter no SQL antes do transporte.
    const { data, error } = await db.rpc('car3_list_quotes');
    if (error) throw error;
    return json({ cotacoes: data });
  } catch (error) { return failure(error); }
}
