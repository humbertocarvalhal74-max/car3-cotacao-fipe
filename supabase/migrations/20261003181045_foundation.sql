-- Esquema inicial conservador. Autorização comercial ainda não especificada.
create schema if not exists car3_private;
revoke all on schema car3_private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  nome text not null check (length(trim(nome)) > 0),
  created_at timestamptz not null default now()
);
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  nome text not null check (length(trim(nome)) > 0),
  email text,
  telefone text,
  created_at timestamptz not null default now()
);
create index clientes_created_by_idx on public.clientes(created_by);

create table public.fipe_cache (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (length(trim(provider)) > 0),
  vehicle_type text not null check (vehicle_type in ('car','motorcycle','truck')),
  fipe_code text not null check (length(trim(fipe_code)) > 0),
  model_year text not null check (length(trim(model_year)) > 0),
  reference_month date not null check (extract(day from reference_month) = 1),
  value_cents bigint not null check (value_cents >= 0),
  fetched_at timestamptz not null default now(),
  unique(provider, vehicle_type, fipe_code, model_year, reference_month)
);
-- TTL aguardando especificação. Nenhuma expiração comercial inventada.
create index fipe_cache_fetched_at_idx on public.fipe_cache(fetched_at);

create table public.parametros_car3 (
  id uuid primary key default gen_random_uuid(),
  version text not null unique check (length(trim(version)) > 0),
  approved boolean not null default false,
  values_json jsonb not null check (jsonb_typeof(values_json) = 'object'),
  created_at timestamptz not null default now()
);
comment on column public.parametros_car3.values_json is
  'Valores monetários/decimais devem ser strings com unidades explícitas. Formato comercial pendente.';

create table public.cotacoes (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  total_cents bigint not null check (total_cents >= 0),
  created_at timestamptz not null default now()
);
create index cotacoes_created_by_idx on public.cotacoes(created_by);
create index cotacoes_cliente_id_idx on public.cotacoes(cliente_id);
create index cotacoes_created_at_idx on public.cotacoes(created_at);

create table public.cotacao_snapshot (
  cotacao_id uuid primary key references public.cotacoes(id)
    on delete restrict deferrable initially deferred,
  parametro_id uuid not null references public.parametros_car3(id) on delete restrict,
  parameter_version text not null,
  parameters_json jsonb not null check (jsonb_typeof(parameters_json) = 'object'),
  engine_version text not null check (length(trim(engine_version)) > 0),
  rule_version text not null check (length(trim(rule_version)) > 0),
  input_json jsonb not null check (jsonb_typeof(input_json) = 'object'),
  fipe_json jsonb not null check (jsonb_typeof(fipe_json) = 'object'),
  total_cents bigint not null check (total_cents >= 0),
  created_at timestamptz not null default now(),
  unique(cotacao_id, total_cents)
);
create index cotacao_snapshot_parametro_id_idx on public.cotacao_snapshot(parametro_id);
-- Circular e deferred: nenhum commit aceita cotação sem snapshot ou total divergente.
alter table public.cotacoes add constraint cotacoes_required_snapshot_fk
  foreign key (id, total_cents) references public.cotacao_snapshot(cotacao_id, total_cents)
  deferrable initially deferred;

create function car3_private.reject_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Registro CAR3 imutável: %', TG_TABLE_NAME;
end;
$$;
create trigger snapshot_immutable before update or delete on public.cotacao_snapshot
for each row execute function car3_private.reject_mutation();
create trigger cotacoes_immutable before update or delete on public.cotacoes
for each row execute function car3_private.reject_mutation();
create trigger parametros_immutable before update or delete on public.parametros_car3
for each row execute function car3_private.reject_mutation();
-- TRUNCATE não executa triggers de linha: proteger também a operação inteira.
create trigger snapshot_no_truncate before truncate on public.cotacao_snapshot
for each statement execute function car3_private.reject_mutation();
create trigger cotacoes_no_truncate before truncate on public.cotacoes
for each statement execute function car3_private.reject_mutation();
create trigger parametros_no_truncate before truncate on public.parametros_car3
for each statement execute function car3_private.reject_mutation();

create function car3_private.capture_parameters() returns trigger
language plpgsql set search_path = '' as $$
declare p public.parametros_car3%rowtype;
begin
  select * into p from public.parametros_car3 where id = NEW.parametro_id;
  if not found or not p.approved then
    raise exception 'Parâmetros inexistentes ou não aprovados';
  end if;
  if NEW.parameter_version <> p.version or NEW.parameters_json <> p.values_json then
    raise exception 'Snapshot diverge da versão dos parâmetros';
  end if;
  return NEW;
end;
$$;
create trigger snapshot_parameters before insert on public.cotacao_snapshot
for each row execute function car3_private.capture_parameters();

alter table public.profiles enable row level security;
alter table public.clientes enable row level security;
alter table public.fipe_cache enable row level security;
alter table public.parametros_car3 enable row level security;
alter table public.cotacoes enable row level security;
alter table public.cotacao_snapshot enable row level security;
-- Fail closed até aprovar o modelo de acesso. Sem policies permissivas provisórias.
revoke all on public.profiles, public.clientes, public.fipe_cache,
  public.parametros_car3, public.cotacoes, public.cotacao_snapshot from anon, authenticated;
revoke all on all functions in schema car3_private from public, anon, authenticated;
