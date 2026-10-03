-- Acesso individual confirmado. Cotações são emitidas por backend confiável,
-- sem permitir que o browser persista um preço arbitrário.
grant select, insert on public.profiles to authenticated;
grant update(nome) on public.profiles to authenticated;
create policy profiles_select_own on public.profiles for select to authenticated
using (id = (select auth.uid()));
create policy profiles_insert_own on public.profiles for insert to authenticated
with check (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

grant select, insert, update, delete on public.clientes to authenticated;
create policy clientes_select_own on public.clientes for select to authenticated
using (created_by = (select auth.uid()));
create policy clientes_insert_own on public.clientes for insert to authenticated
with check (created_by = (select auth.uid()));
create policy clientes_update_own on public.clientes for update to authenticated
using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
create policy clientes_delete_own on public.clientes for delete to authenticated
using (created_by = (select auth.uid()));

grant select on public.cotacoes, public.cotacao_snapshot, public.parametros_car3 to authenticated;
create policy cotacoes_select_own on public.cotacoes for select to authenticated
using (created_by = (select auth.uid()));
create policy snapshot_select_own on public.cotacao_snapshot for select to authenticated
using (exists (select 1 from public.cotacoes c where c.id = cotacao_id
  and c.created_by = (select auth.uid())));
create policy parametros_select_approved on public.parametros_car3 for select to authenticated
using (approved);

-- Impedir que o backend associe cotação de um usuário ao cliente de outro.
alter table public.clientes add constraint clientes_id_owner_unique unique(id, created_by);
alter table public.cotacoes add constraint cotacoes_cliente_owner_fk
foreign key (cliente_id, created_by) references public.clientes(id, created_by) on delete restrict;

-- RPC exclusivamente administrativa e SECURITY INVOKER. Snapshot copiado pelo banco.
create function public.car3_persist_quote(
  p_owner uuid, p_cliente uuid, p_parameter uuid,
  p_engine_version text, p_rule_version text,
  p_input jsonb, p_fipe jsonb, p_total_cents bigint,
  p_expected_parameters jsonb, p_parameter_version text
) returns uuid language plpgsql set search_path = '' as $$
declare quote_id uuid := gen_random_uuid(); p public.parametros_car3%rowtype;
begin
  select * into p from public.parametros_car3 where id = p_parameter;
  if not found or not p.approved then raise exception 'Parâmetros não aprovados'; end if;
  if p_expected_parameters is null or p_parameter_version is null
     or p_expected_parameters <> p.values_json or p_parameter_version <> p.version then
    raise exception 'Parâmetros de cálculo divergem do snapshot';
  end if;
  insert into public.cotacoes(id,created_by,cliente_id,total_cents)
    values(quote_id,p_owner,p_cliente,p_total_cents);
  insert into public.cotacao_snapshot(cotacao_id,parametro_id,parameter_version,parameters_json,
    engine_version,rule_version,input_json,fipe_json,total_cents)
    values(quote_id,p.id,p.version,p.values_json,p_engine_version,p_rule_version,p_input,p_fipe,p_total_cents);
  return quote_id;
end;
$$;
revoke all on function public.car3_persist_quote(uuid,uuid,uuid,text,text,jsonb,jsonb,bigint,jsonb,text)
from public, anon, authenticated;
grant execute on function public.car3_persist_quote(uuid,uuid,uuid,text,text,jsonb,jsonb,bigint,jsonb,text) to service_role;
grant usage on schema car3_private to service_role;
grant execute on all functions in schema car3_private to service_role;
grant select, insert on public.cotacoes, public.cotacao_snapshot to service_role;
grant select on public.parametros_car3, public.clientes, public.profiles to service_role;
