import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { INITIAL_CAR3_PARAMETERS } from '../src/domain/car3-parameters';
const db = new PGlite();
const user = '00000000-0000-4000-8000-000000000001';
const client = '00000000-0000-4000-8000-000000000002';
const parameter = '00000000-0000-4000-8000-000000000003';
const quotation = '00000000-0000-4000-8000-000000000004';
beforeAll(async () => {
  // Emula somente o contrato auth/roles. PostgreSQL real via WASM, sem serviço Auth.
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to authenticated;
    grant execute on function auth.uid() to authenticated;`);
  for (const name of readdirSync('supabase/migrations').filter(n => n.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(`supabase/migrations/${name}`, 'utf8'));
  }
  await db.exec(readFileSync('supabase/seed.sql', 'utf8'));
  await db.exec(`insert into auth.users values ('${user}');
    insert into profiles(id,nome) values ('${user}','Test');
    insert into clientes(id,created_by,nome) values ('${client}','${user}','Client');
    insert into parametros_car3(id,version,approved,values_json)
    values ('${parameter}','test-only',true,'{"test":"fixture"}');`);
}, 30000);
afterAll(async () => { await db.close(); });
const insertSnapshot = (id: string, total = 100) => `insert into cotacao_snapshot
  (cotacao_id,parametro_id,parameter_version,parameters_json,engine_version,rule_version,input_json,fipe_json,total_cents)
  values ('${id}','${parameter}','test-only','{"test":"fixture"}','test','test','{}','{}',${total});`;
it('cotação e snapshot são obrigatórios no mesmo commit', async () => {
  await expect(db.transaction(async tx => {
    await tx.exec(`insert into cotacoes(id,created_by,cliente_id,total_cents)
      values ('${quotation}','${user}','${client}',100);`);
  })).rejects.toThrow();
  await db.transaction(async tx => {
    await tx.exec(`insert into cotacoes(id,created_by,cliente_id,total_cents)
      values ('${quotation}','${user}','${client}',100);`);
    await tx.exec(insertSnapshot(quotation));
  });
  expect((await db.query('select * from cotacoes')).rows).toHaveLength(1);
});
it('recusa total divergente e snapshot órfão', async () => {
  const id = '00000000-0000-4000-8000-000000000005';
  await expect(db.transaction(async tx => {
    await tx.exec(`insert into cotacoes(id,created_by,cliente_id,total_cents)
      values ('${id}','${user}','${client}',100);`);
    await tx.exec(insertSnapshot(id, 200));
  })).rejects.toThrow();
  await expect(db.exec(insertSnapshot(id))).rejects.toThrow();
});
it('protege imutabilidade contra update/delete/truncate', async () => {
  for (const table of ['cotacao_snapshot', 'cotacoes', 'parametros_car3']) {
    await expect(db.exec(`delete from ${table}`)).rejects.toThrow('imutável');
    await expect(db.exec(`update ${table} set created_at = now()`)).rejects.toThrow('imutável');
    await expect(db.exec(`truncate ${table} cascade`)).rejects.toThrow('imutável');
  }
});
it('recusa parâmetros não aprovados ou snapshot adulterado', async () => {
  const id = '00000000-0000-4000-8000-000000000006';
  await expect(db.exec(insertSnapshot(id).replace('"fixture"', '"tampered"'))).rejects.toThrow('diverge');
  await db.exec(`insert into parametros_car3(id,version,approved,values_json)
    values ('00000000-0000-4000-8000-000000000007','pending-test',false,'{}');`);
  await expect(db.exec(insertSnapshot(id).replace(parameter,
    '00000000-0000-4000-8000-000000000007'))).rejects.toThrow('não aprovados');
});
it('seed é idempotente', async () => {
  await db.exec(readFileSync('supabase/seed.sql', 'utf8'));
  const result = await db.query<{ version: string }>('select version from parametros_car3');
  expect(new Set(result.rows.map(r => r.version)).size).toBe(result.rows.length);
});
it('seed SQL corresponde exatamente aos parâmetros oficiais TypeScript', async () => {
  const result = await db.query<{ values_json: unknown }>(
    "select values_json from parametros_car3 where version = 'car3-initial-2026-10-03-v1'");
  expect(result.rows[0].values_json).toEqual(INITIAL_CAR3_PARAMETERS);
});
it('RLS isola os dados por usuário e impede alteração de proprietário', async () => {
  const other = '00000000-0000-4000-8000-000000000010';
  await db.exec(`insert into auth.users values ('${other}');
    insert into profiles(id,nome) values ('${other}','Other');
    insert into clientes(created_by,nome) values ('${other}','Other client');`);
  await db.transaction(async tx => {
    await tx.exec(`set local role authenticated; set local request.jwt.claim.sub = '${user}';`);
    expect((await tx.query('select * from clientes')).rows).toHaveLength(1);
    expect((await tx.query('select * from cotacoes')).rows).toHaveLength(1);
    expect((await tx.query('select * from cotacao_snapshot')).rows).toHaveLength(1);
  });
  await expect(db.transaction(async tx => {
    await tx.exec(`set local role authenticated; set local request.jwt.claim.sub = '${user}';
      update clientes set created_by = '${other}' where id = '${client}';`);
  })).rejects.toThrow();
  await db.transaction(async tx => {
    await tx.exec(`set local role authenticated; set local request.jwt.claim.sub = '${other}';`);
    expect((await tx.query('select * from cotacoes')).rows).toHaveLength(0);
    expect((await tx.query('select * from cotacao_snapshot')).rows).toHaveLength(0);
  });
});
it('RPC faz persistência atômica e copia parâmetros; browser não tem permissão', async () => {
  await expect(db.transaction(async tx => {
    await tx.exec(`set local role authenticated; set local request.jwt.claim.sub = '${user}';
      select car3_persist_quote('${user}','${client}','${parameter}','test','test','{}','{}',100,'{"test":"fixture"}','test-only');`);
  })).rejects.toThrow('permission denied');
  await db.transaction(async tx => {
    await tx.exec('set local role service_role');
    const result = await tx.query<{ id: string }>(`select car3_persist_quote(
      '${user}','${client}','${parameter}','test','test','{}','{}',100,'{"test":"fixture"}','test-only') as id`);
    expect(result.rows[0].id).toMatch(/^[a-f0-9-]{36}$/);
  });
});
it('RPC recusa parâmetros adulterados e cliente de outro usuário sem deixar cotação', async () => {
  const count = (await db.query('select id from cotacoes')).rows.length;
  await expect(db.exec(`select car3_persist_quote('${user}','${client}','${parameter}',
    'test','test','{}','{}',100,'{}','test-only')`)).rejects.toThrow('divergem');
  await expect(db.exec(`select car3_persist_quote('00000000-0000-4000-8000-000000000010',
    '${client}','${parameter}','test','test','{}','{}',100,'{"test":"fixture"}','test-only')`)).rejects.toThrow();
  expect((await db.query('select id from cotacoes')).rows).toHaveLength(count);
});
it('constraints recusam FK inválida e dinheiro negativo', async () => {
  await expect(db.exec(`insert into clientes(created_by,nome)
    values ('00000000-0000-4000-8000-000000000099','invalid')`)).rejects.toThrow();
  await expect(db.exec(`insert into fipe_cache(provider,vehicle_type,fipe_code,model_year,reference_month,value_cents)
    values ('test','car','test','2020','2026-10-01',-1)`)).rejects.toThrow();
});
it('leitura mantém centavos exatos acima do limite seguro de Number e respeita RLS', async () => {
  const id = '00000000-0000-4000-8000-000000000020';
  const huge = '9007199254740993';
  await db.transaction(async tx => {
    await tx.exec(`insert into cotacoes(id,created_by,cliente_id,total_cents)
      values ('${id}','${user}','${client}',${huge});`);
    await tx.exec(insertSnapshot(id).replace(',100);',`,${huge});`));
  });
  await db.transaction(async tx => {
    await tx.exec(`set local role authenticated; set local request.jwt.claim.sub = '${user}';`);
    const result = await tx.query<{id:string;total_cents:string}>('select * from car3_list_quotes()');
    expect(result.rows.find(r => r.id === id)?.total_cents).toBe(huge);
  });
  await db.transaction(async tx => {
    await tx.exec("set local role authenticated; set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000010';");
    expect((await tx.query('select * from car3_list_quotes()')).rows).toHaveLength(0);
  });
});
