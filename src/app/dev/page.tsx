import { notFound } from 'next/navigation';
import { createSessionClient } from '@/infrastructure/supabase/session';
import { assertFixtureEnabled } from '@/application/http-validation';
export const dynamic = 'force-dynamic';
export default async function DevPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  try { assertFixtureEnabled(process.env.CAR3_ENABLE_DEV_FIXTURE, process.env.SUPABASE_URL); } catch { notFound(); }
  const db = await createSessionClient(true);
  const { data: { user } } = await db.auth.getUser();
  const { status } = await searchParams;
  const messages: Record<string,string> = { login: 'Login realizado.', logout: 'Sessão encerrada.',
    profile: 'Perfil salvo.', cliente: 'Cliente criado.', cotacao: 'Cotação de teste emitida.' };
  if (!user) return <main className="max-w-xl space-y-4 p-8">
    <h1 className="text-xl font-semibold">CAR3 — validação técnica</h1>
    <p>Ambiente de desenvolvimento. Use uma conta já criada no Supabase Auth.</p>
    {status && messages[status] && <p role="status">{messages[status]}</p>}
    <form action="/api/auth/login" method="post" className="space-y-3">
      <label className="block">Email <input className="border p-2" name="email" type="email" autoComplete="username" required /></label>
      <label className="block">Senha <input className="border p-2" name="password" type="password" autoComplete="current-password" required /></label>
      <button className="border px-4 py-2">Entrar</button>
    </form>
  </main>;
  const [profiles, clients, parameters, quotes] = await Promise.all([
    db.from('profiles').select('id,nome').eq('id',user.id).maybeSingle(),
    db.from('clientes').select('id,nome').order('created_at',{ascending:false}).limit(100),
    db.from('parametros_car3').select('id,version').eq('version','car3-initial-2026-10-03-v1').eq('approved',true).single(),
    db.rpc('car3_list_quotes'),
  ]);
  if (profiles.error || clients.error || parameters.error || quotes.error) return <main className="p-8">Não foi possível carregar os dados de validação.</main>;
  const rows = quotes.data as { id: string; cliente_id: string; total_cents: string; created_at: string }[];
  return <main className="max-w-3xl space-y-6 p-8">
    <h1 className="text-xl font-semibold">CAR3 — validação técnica</h1>
    <p>Conta: {user.email}. A FIPE usada neste teste é fixa em R$ 100.000 e não vem de um fornecedor.</p>
    {status && messages[status] && <p role="status">{messages[status]}</p>}
    <form action="/api/profile" method="post" className="space-x-3">
      <label>Seu nome <input className="border p-2" name="nome" defaultValue={profiles.data?.nome ?? ''} maxLength={200} required /></label>
      <button className="border p-2">Salvar perfil</button>
    </form>
    {profiles.data && <form action="/api/clientes" method="post" className="space-x-3">
      <label>Cliente de teste <input className="border p-2" name="nome" maxLength={200} required /></label>
      <button className="border p-2">Criar cliente</button>
    </form>}
    {!!clients.data?.length && parameters.data && <form action="/api/dev/cotacoes" method="post" className="space-y-3">
      <input type="hidden" name="parameterId" value={parameters.data.id} />
      <label className="block">Cliente <select className="border p-2" name="clienteId">{clients.data.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
      <label className="block">IPVA <select className="border p-2" name="ipvaCategory"><option value="carro">Carro</option><option value="diesel">Diesel</option><option value="moto">Moto</option></select></label>
      <label className="block">Franquia <select className="border p-2" name="franquia"><option value="1000">1.000 km</option><option value="2000">2.000 km</option><option value="3000">3.000 km</option><option value="livre">Livre (4.000 km internos)</option></select></label>
      <p>Esta emissão grava uma cotação e um snapshot imutável no banco de desenvolvimento.</p>
      <button className="border p-2">Emitir cotação de teste</button>
    </form>}
    <div><h2 className="font-semibold">Cotações da sua conta (centavos)</h2>
      <ul>{rows.map(q => <li key={q.id}>{q.id}: {q.total_cents} centavos</li>)}</ul></div>
    <form action="/api/auth/logout" method="post"><button className="border p-2">Sair</button></form>
  </main>;
}
