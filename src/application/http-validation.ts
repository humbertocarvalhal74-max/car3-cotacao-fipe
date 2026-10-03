export class HttpError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
export function assertSameOrigin(origin: string | null, expected: string | undefined) {
  if (!expected) throw new HttpError(503, 'APP_ORIGIN não configurada.');
  if (!origin || origin !== new URL(expected).origin) throw new HttpError(403, 'Origem não autorizada.');
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Objeto obrigatório.');
  return value as Record<string, unknown>;
}
export function text(value: unknown, field: string, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new HttpError(400, `Campo inválido: ${field}.`);
  return value.trim();
}
export function uuid(value: unknown, field: string): string {
  const id = text(value, field, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new HttpError(400, `UUID inválido: ${field}.`);
  return id;
}
export function credentials(value: unknown) {
  const body = object(value);
  const email = text(body.email, 'email', 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Email inválido.');
  // Não normalizar a senha nem impor regra nova a contas existentes.
  if (typeof body.password !== 'string' || !body.password.length || body.password.length > 1024) throw new HttpError(400, 'Senha inválida.');
  return { email, password: body.password };
}
export function fixtureRequest(value: unknown) {
  const body = object(value);
  const franquia = body.franquia === 'livre' ? 'livre' : typeof body.franquia === 'number' ? body.franquia :
    typeof body.franquia === 'string' && /^\d+$/.test(body.franquia) ? Number(body.franquia) : NaN;
  if (franquia !== 'livre' && ![1000,2000,3000].includes(franquia)) throw new HttpError(400, 'Franquia inválida.');
  if (!['carro','diesel','moto'].includes(String(body.ipvaCategory))) throw new HttpError(400, 'Categoria IPVA inválida.');
  if ('fipeCents' in body || 'totalCents' in body || 'ownerId' in body) throw new HttpError(400, 'Preço e proprietário são definidos pelo servidor.');
  return { clienteId: uuid(body.clienteId, 'clienteId'), parameterId: uuid(body.parameterId, 'parameterId'),
    franquia: franquia as number | 'livre', ipvaCategory: body.ipvaCategory as 'carro' | 'diesel' | 'moto' };
}
export function assertFixtureEnabled(enabled: string | undefined, projectUrl: string | undefined) {
  if (enabled !== 'true' || projectUrl !== 'https://ebamdurxekaoahigslgu.supabase.co') {
    throw new HttpError(404, 'Emissão de teste indisponível.');
  }
}
