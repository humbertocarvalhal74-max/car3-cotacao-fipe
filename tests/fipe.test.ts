import { expect, it } from 'vitest';
import { UnconfiguredFipeProvider } from '../src/infrastructure/fipe/unconfigured-provider';
it('não faz chamadas a um fornecedor não aprovado', async () => {
  await expect(new UnconfiguredFipeProvider().lookup({ vehicleType: 'car',
    fipeCode: 'test', modelYear: '2020', referenceMonth: '2026-10' })).rejects.toThrow('não selecionado');
});
