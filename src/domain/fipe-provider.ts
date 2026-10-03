import type { Cents } from './money';
export interface FipeLookup {
  vehicleType: 'car' | 'motorcycle' | 'truck';
  fipeCode: string;
  modelYear: string; // string: suporta identificadores de zero km sem inventar convenção
  referenceMonth: string; // YYYY-MM
}
export interface FipeValue {
  lookup: FipeLookup;
  valueCents: Cents;
  provider: string;
  fetchedAt: string;
}
export interface FipeProvider {
  lookup(request: FipeLookup, signal?: AbortSignal): Promise<FipeValue>;
}
