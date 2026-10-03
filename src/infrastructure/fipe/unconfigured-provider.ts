import type { FipeLookup, FipeProvider, FipeValue } from '../../domain/fipe-provider';
export class UnconfiguredFipeProvider implements FipeProvider {
  async lookup(_request: FipeLookup): Promise<FipeValue> {
    throw new Error('Fornecedor FIPE ainda não selecionado.');
  }
}
