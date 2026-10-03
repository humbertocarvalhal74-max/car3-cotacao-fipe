import { expect, it } from 'vitest';
import { assertFixtureEnabled, assertSameOrigin, credentials, fixtureRequest } from '../src/application/http-validation';
const body = { clienteId: '00000000-0000-4000-8000-000000000001',
  parameterId: '00000000-0000-4000-8000-000000000002', franquia: '1000', ipvaCategory: 'carro' };
it('origem exata obrigatória contra CSRF, inclusive login', () => {
  expect(() => assertSameOrigin(null, 'https://car3.test')).toThrow();
  expect(() => assertSameOrigin('https://evil.test', 'https://car3.test')).toThrow();
  expect(() => assertSameOrigin('https://car3.test', undefined)).toThrow();
  expect(() => assertSameOrigin('https://car3.test', 'https://car3.test')).not.toThrow();
});
it('preserva senha e recusa credenciais malformadas', () => {
  expect(credentials({ email: 'test@example.invalid', password: ' password ' }).password).toBe(' password ');
  expect(() => credentials({ email: 'invalid', password: 'x' })).toThrow();
  expect(() => credentials({ email: 'test@example.invalid', password: '' })).toThrow();
});
it('converte formulários e impede preço/proprietário enviados pelo cliente', () => {
  expect(fixtureRequest(body).franquia).toBe(1000);
  expect(fixtureRequest({ ...body, franquia: 'livre' }).franquia).toBe('livre');
  for (const field of ['ownerId','fipeCents','totalCents']) expect(() => fixtureRequest({ ...body, [field]: '1' })).toThrow();
  expect(() => fixtureRequest({ ...body, franquia: '1000x' })).toThrow();
  expect(() => fixtureRequest({ ...body, clienteId: 'invalid' })).toThrow();
});
it('fixture desativada por padrão e bloqueada em outro projeto', () => {
  expect(() => assertFixtureEnabled(undefined, 'https://ebamdurxekaoahigslgu.supabase.co')).toThrow();
  expect(() => assertFixtureEnabled('true', 'https://production.supabase.co')).toThrow();
  expect(() => assertFixtureEnabled('true', 'https://ebamdurxekaoahigslgu.supabase.co')).not.toThrow();
});
