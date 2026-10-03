import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { decodeCar3Parameters } from '../../domain/quote-car3';
import type { ParameterRecord, QuotationRepository } from '../../application/issue-quotation';

/** Cliente privilegiado exclusivamente no servidor, sem exposição por endpoint nesta etapa. */
export function createQuotationRepository(): QuotationRepository {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Configure SUPABASE_URL e SUPABASE_SECRET_KEY somente no servidor.');
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    async loadParameters(id): Promise<ParameterRecord> {
      const { data, error } = await db.from('parametros_car3')
        .select('id,version,approved,values_json').eq('id', id).single();
      if (error || !data) throw new Error('Não foi possível carregar parâmetros CAR3.');
      return { id: data.id, version: data.version, approved: data.approved,
        values: decodeCar3Parameters(data.values_json) };
    },
    async persist(record) {
      const { snapshot } = record.result;
      const { data, error } = await db.rpc('car3_persist_quote', {
        p_owner: record.ownerId, p_cliente: record.clienteId, p_parameter: record.parameterId,
        p_engine_version: snapshot.engineVersion, p_rule_version: snapshot.ruleVersion,
        p_input: snapshot.input, p_fipe: record.fipe, p_total_cents: snapshot.totalCents,
        p_expected_parameters: snapshot.parameters.values, p_parameter_version: snapshot.parameters.version,
      });
      if (error || typeof data !== 'string') throw new Error('Não foi possível persistir cotação CAR3.');
      return data;
    },
  };
}
