import { assertFixtureEnabled, fixtureRequest } from '@/application/http-validation';
import { requireSession } from '@/infrastructure/supabase/session';
import { issueAuthenticatedQuotation } from '@/infrastructure/supabase/issue-authenticated-quotation';
import { DevFixtureFipeProvider } from '@/infrastructure/fipe/dev-fixture-provider';
import { checkOrigin, failure, readBody, success } from '@/infrastructure/http/response';
export async function POST(request: Request) {
  try {
    assertFixtureEnabled(process.env.CAR3_ENABLE_DEV_FIXTURE, process.env.SUPABASE_URL);
    checkOrigin(request);
    const { accessToken } = await requireSession();
    const input = fixtureRequest(await readBody(request));
    const quotation = await issueAuthenticatedQuotation(accessToken, { ...input, lookup: {
      vehicleType: 'car', fipeCode: 'CAR3-TEST-100K', modelYear: '2020', referenceMonth: '2026-10',
    } }, new DevFixtureFipeProvider());
    return success(request, { id: quotation.id, totalCents: quotation.result.totalCents.toString() }, 'cotacao', 201);
  } catch (error) { return failure(error); }
}
