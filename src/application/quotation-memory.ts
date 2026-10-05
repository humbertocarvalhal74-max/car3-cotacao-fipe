import { calculateCar3, type Car3Input } from '../domain/car3-pricing';
import { CAR3_RULE_VERSION, decodeCar3Parameters } from '../domain/quote-car3';
import { rational, multiply, type Rational } from '../domain/rational';

/** Exibição apenas: frações de centavo são truncadas e sinalizadas, sem alterar o cálculo. */
export function displayMoney(value: Rational): string {
  if (value.numerator < 0n || value.denominator <= 0n) throw new Error('Valor inválido.');
  const cents = value.numerator / value.denominator;
  const reais = (cents / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${value.numerator % value.denominator ? '≈ ' : ''}R$ ${reais},${(cents % 100n).toString().padStart(2,'0')}`;
}
export interface MemorySnapshot {
  rule_version: string; engine_version: string; parameter_version: string;
  parameters_json: unknown; input_json: unknown;
}
/** Reconstrói exclusivamente os parâmetros históricos; recusa versão desconhecida ou total divergente. */
export function quotationMemory(snapshot: MemorySnapshot, storedTotal: string) {
  if (!['car3-pricing-v1',CAR3_RULE_VERSION].includes(snapshot.rule_version) || snapshot.engine_version !== 'foundation-v1') throw new Error('Versão sem memória de cálculo disponível.');
  const p = decodeCar3Parameters(snapshot.parameters_json);
  const input = snapshot.input_json as { fipeCents?: unknown; context?: { ipvaCategory?: unknown; franquia?: unknown; zeroKm?: unknown } };
  if (!input || typeof input.fipeCents !== 'string' || !/^\d+$/.test(input.fipeCents) ||
      !['carro','diesel','moto'].includes(String(input.context?.ipvaCategory)) ||
      !(input.context?.franquia === 'livre' || typeof input.context?.franquia === 'number') || !/^\d+$/.test(storedTotal)) throw new Error('Snapshot inválido.');
  if (snapshot.rule_version === CAR3_RULE_VERSION && typeof input.context.zeroKm !== 'boolean') throw new Error('Condição zero km ausente.');
  const zeroKm = snapshot.rule_version === CAR3_RULE_VERSION && input.context.zeroKm === true;
  const result = calculateCar3({fipeCents:BigInt(input.fipeCents),ipvaCategory:input.context.ipvaCategory as Car3Input['ipvaCategory'],franquia:input.context.franquia,zeroKm},p);
  if (result.totalCents !== BigInt(storedTotal)) throw new Error('Memória diverge do total preservado.');
  const labels: Record<keyof typeof result.breakdown,string> = {depreciacao:'Depreciação mensal',capital:'Custo de capital',ipva:'IPVA mensal',seguro:'Seguro mensal',licenciamento:'Licenciamento mensal',variavel:'Custo variável da franquia',telemetria:'Telemetria',administracao:'Administração CAR3',sinistro:'Reserva de sinistro'};
  return { parameterVersion:snapshot.parameter_version, category:input.context.ipvaCategory,
    km:input.context.franquia === 'livre' ? `Livre (${p.kmLivreInterno} km internos)` : `${input.context.franquia} km`,
    rows:[['Valor FIPE',displayMoney(rational(BigInt(input.fipeCents)))],[zeroKm ? 'Base CAR3 zero km — 100% da FIPE' : 'Base CAR3 após desconto FIPE',displayMoney(result.base)],
      ...Object.entries(result.breakdown).map(([key,value]) => [labels[key as keyof typeof labels],displayMoney(value)]),
      ['Custo mensal total',displayMoney(result.custoMensal)],
      ['Acréscimo de margem CAR3',displayMoney(multiply(result.custoMensal,rational(BigInt(p.margemBps),10000n)))],
      ['Acréscimo de inadimplência',displayMoney(multiply(result.custoMensal,rational(BigInt(p.inadimplenciaBps),10000n)))],
      ['Preço com margem e inadimplência',displayMoney(result.precoSemArredondamento)],
      ['Mensalidade após arredondamento para cima',displayMoney(rational(result.totalCents))]] };
}
