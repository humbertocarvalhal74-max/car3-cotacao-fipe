/** Valores oficiais informados pelo usuário. Taxas em basis points: 100 bps = 1%. */
export const INITIAL_CAR3_PARAMETERS = {
  descontoFipeBps: '600', margemBps: '1200', inadimplenciaBps: '100',
  manutencaoPreventivaCentsKm: '12', manutencaoCorretivaCentsKm: '7',
  pneusCentsKm: '6', desgasteCentsKm: '8', custoVariavelTotalCentsKm: '33',
  franquiasKm: [1000, 2000, 3000], kmLivreInterno: 4000,
  excedenteEconomicoCentsKm: '45', excedenteIntermediarioCentsKm: '55', excedenteSuvPicapeCentsKm: '65',
  permanenciaFrotaMeses: 24, residualBps: '7500', oportunidadeMesBps: '60',
  ipvaCarroAnoBps: '250', ipvaDieselAnoBps: '300', ipvaMotoAnoBps: '100',
  licenciamentoAnoCents: '30000', seguroAnoBps: '500', telemetriaMesCents: '9000',
  administracaoMesCents: '10000', reservaSinistroMesCents: '7500',
  arredondamentoMultiploCents: '5000', baseIpvaSeguro: 'fipe',
  margemInadimplencia: 'acrescimo', arredondamento: 'cima', custoVariavel: 'franquia',
};
export type Car3Parameters = typeof INITIAL_CAR3_PARAMETERS;
