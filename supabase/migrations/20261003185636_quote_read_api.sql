-- bigint convertido para text ANTES do JSON/PostgREST, evitando perda de centavos.
create function public.car3_list_quotes()
returns table (id uuid, cliente_id uuid, total_cents text, created_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select c.id, c.cliente_id, c.total_cents::text, c.created_at
  from public.cotacoes c
  order by c.created_at desc, c.id
  limit 100;
$$;
revoke all on function public.car3_list_quotes() from public, anon;
grant execute on function public.car3_list_quotes() to authenticated;
