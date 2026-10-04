import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { HttpError } from '../src/application/http-validation';
const mocks = vi.hoisted(() => ({ session: vi.fn(), issue: vi.fn() }));
vi.mock('../src/infrastructure/supabase/session', () => ({ requireSession: mocks.session }));
vi.mock('../src/infrastructure/supabase/issue-authenticated-quotation', () => ({ issueAuthenticatedQuotation: mocks.issue }));
import { POST } from '../src/app/api/cotacoes/route';
const body = { clienteId:'00000000-0000-4000-8000-000000000001', parameterId:'00000000-0000-4000-8000-000000000002', ipvaCategory:'carro', franquia:1000, vehicleType:'car', fipeCode:'014090-2', modelYear:'2020-5', referenceMonth:'2026-10' };
const request = (data: unknown = body, origin = 'http://localhost:3000') => new Request('http://localhost:3000/api/dev/cotacoes', {
  method:'POST', headers:{'content-type':'application/json',origin}, body:JSON.stringify(data),
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('APP_ORIGIN','http://localhost:3000');
  vi.stubEnv('SUPABASE_URL','https://ebamdurxekaoahigslgu.supabase.co');
  vi.stubEnv('CAR3_ENABLE_DEV_FIXTURE','true');
  mocks.session.mockResolvedValue({accessToken:'test-token'});
  mocks.issue.mockResolvedValue({id:'quote',result:{totalCents:320000n}});
});
afterEach(() => vi.unstubAllEnvs());
it('exige autenticação antes de emitir', async () => {
  mocks.session.mockRejectedValue(new HttpError(401,'Autenticação obrigatória.'));
  expect((await POST(request())).status).toBe(401);
  expect(mocks.issue).not.toHaveBeenCalled();
});
it('não emite com origem externa nem preço adulterado', async () => {
  expect((await POST(request(body,'https://evil.test'))).status).toBe(403);
  expect((await POST(request({...body,totalCents:'1'}))).status).toBe(400);
  expect(mocks.issue).not.toHaveBeenCalled();
});
it('usa token verificado e retorna centavos em string sem expor token', async () => {
  const response = await POST(request());
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({id:'quote',totalCents:'320000'});
  expect(mocks.issue.mock.calls[0][0]).toBe('test-token');
});
