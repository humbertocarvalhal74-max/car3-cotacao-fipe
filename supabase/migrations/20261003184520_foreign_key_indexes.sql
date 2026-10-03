-- Índices de cobertura para as foreign keys compostas, apontados pelo advisor.
create index cotacoes_cliente_owner_idx on public.cotacoes(cliente_id, created_by);
create index cotacoes_snapshot_reference_idx on public.cotacoes(id, total_cents);
