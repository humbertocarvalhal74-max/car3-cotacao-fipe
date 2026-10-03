import 'server-only';
import { assertFixtureEnabled } from '../../application/http-validation';
import type { FipeLookup, FipeProvider, FipeValue } from '../../domain/fipe-provider';
/** Fixture de homologação fixa. Não aceita preço informado pelo browser. */
export class DevFixtureFipeProvider implements FipeProvider {
  async lookup(request: FipeLookup): Promise<FipeValue> {
    assertFixtureEnabled(process.env.CAR3_ENABLE_DEV_FIXTURE, process.env.SUPABASE_URL);
    if (request.fipeCode !== 'CAR3-TEST-100K' || request.vehicleType !== 'car' || request.modelYear !== '2020'
      || request.referenceMonth !== '2026-10') throw new Error('Consulta fora da fixture.');
    return { lookup: { ...request }, valueCents: 10000000n,
      provider: 'car3-dev-fixture-not-official-fipe', fetchedAt: new Date().toISOString() };
  }
}
