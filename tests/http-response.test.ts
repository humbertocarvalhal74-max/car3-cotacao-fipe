import { expect, it, vi } from 'vitest';
import { failure, readBody, success } from '../src/infrastructure/http/response';
it('limita corpos enviados sem Content-Length e recusa JSON inválido', async () => {
  await expect(readBody(new Request('http://localhost', { method:'POST',
    headers:{'content-type':'application/json'}, body:'x'.repeat(8193) }))).rejects.toMatchObject({status:413});
  await expect(readBody(new Request('http://localhost', { method:'POST',
    headers:{'content-type':'application/json'}, body:'{' }))).rejects.toMatchObject({status:400});
});
it('não vaza erro interno, token ou stack trace', async () => {
  const response = failure(new Error('secret-token-and-stack'));
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain('secret-token');
  expect(response.headers.get('cache-control')).toContain('no-store');
});
it('formulário redireciona somente para origem configurada', () => {
  vi.stubEnv('APP_ORIGIN','http://localhost:3000');
  const response = success(new Request('http://evil.test', { headers:{'content-type':'application/x-www-form-urlencoded'} }), {}, 'login');
  expect(response.headers.get('location')).toBe('http://localhost:3000/dev?status=login');
  vi.unstubAllEnvs();
});
