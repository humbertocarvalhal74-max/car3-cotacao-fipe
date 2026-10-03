# CAR3 Cotação FIPE — fundação

Next.js App Router, TypeScript estrito, Tailwind CSS e Supabase/PostgreSQL. Esta etapa contém apenas uma página técnica, sem a interface final.

## Executar localmente

Requisitos: Node.js 22+ (validado com 24.19), pnpm 11.19.0. Na pasta deste arquivo:

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
pnpm dev
```

Abra http://localhost:3000. O build e a página técnica funcionam sem credenciais. Para integrar um projeto Supabase, preencha **somente em `.env.local` no servidor**:

- `SUPABASE_URL`: URL do projeto.
- `SUPABASE_PUBLISHABLE_KEY`: chave publishable usada pelo cliente de identidade/RLS.
- `SUPABASE_SECRET_KEY`: chave secreta para o repositório de emissão no backend. Não é necessária para exibir a página técnica.

Nunca prefixar chaves, tokens ou credenciais com `NEXT_PUBLIC_`. Todos os módulos de infraestrutura Supabase importam `server-only`; nenhum cliente Supabase é criado no browser. `.env.local` é ignorado pelo Git. Não há credenciais reais neste projeto.

```powershell
pnpm test
pnpm typecheck
pnpm build
pnpm start
```

## Banco local

O Supabase CLI está fixado nas dependências. Requer Docker para levantar a stack completa:

```powershell
pnpm exec supabase start
pnpm exec supabase db reset --local
```

O segundo comando **apaga e recria somente o banco local**, aplicando migrations e seed. Não executar contra produção. `supabase/config.toml` foi gerado pelo CLI. Em Windows, se o executável ainda não estiver vinculado após a primeira instalação, execute `pnpm install` novamente ou `& ./node_modules/supabase/bin/supabase.exe start`.

O esquema usa `auth.users`, roles `anon`, `authenticated`, `service_role` e `auth.uid()` do Supabase. Para PostgreSQL independente será necessário integrar identidade/roles equivalentes; não basta aplicar os arquivos sobre um banco vazio sem Auth.

Não foi criado nem modificado um projeto Supabase remoto. Para futuras migrations use `pnpm exec supabase migration new nome`. Não altere migrations já aplicadas. Tipos de banco devem ser gerados pelo CLI quando houver uma stack local/real disponível.

## Arquitetura

```text
src/app/                       página técnica, layout, Tailwind e manifest
src/domain/                    dinheiro, racionais, parâmetros e fórmulas puras
src/application/               emissão via interfaces FipeProvider e QuotationRepository
src/infrastructure/fipe/       provider não configurado (falha explícita)
src/infrastructure/supabase/   clientes, autenticação e repositório RPC no servidor
supabase/migrations/           tabelas, integridade, imutabilidade e RLS
supabase/seed.sql              parâmetros oficiais iniciais, idempotentes
tests/                         fórmulas, snapshots, provider, aplicação e PostgreSQL
```

O motor não importa React, Next.js, Supabase nem fornecedor FIPE. `FipeProvider` retorna valor em centavos e metadados de consulta (código, ano, mês, fornecedor, instante). O adapter real, as regras de expiração do cache e a seleção de fornecedor ficam para a próxima etapa. Nenhuma chamada a fornecedor ocorre agora.

`issueAuthenticatedQuotation` é o ponto de entrada preparado para um futuro handler: verifica o token com Supabase Auth, identifica o usuário, consulta os parâmetros, chama o provider e persiste o resultado. Não existe endpoint HTTP de emissão nem fluxo visual de login nesta etapa. A seleção da categoria IPVA é explícita; não inferimos diesel pelo nome do veículo.

## Regras confirmadas em 03/10/2026

Todas as taxas usam basis points (`100 bps = 1%`) e valores monetários usam centavos. O seed contém as taxas, custos, franquias e tarifas informadas na conversa, inclusive excedentes de R$ 0,45/0,55/0,65 por km.

```text
base CAR3 = FIPE × (1 − 6%)
depreciação mensal = base CAR3 × (1 − 75%) ÷ 24
capital próprio investido = base CAR3
custo de capital mensal = capital próprio × 0,60%
IPVA mensal = FIPE × taxa anual da categoria ÷ 12
seguro mensal = FIPE × 5% ÷ 12
licenciamento mensal = R$ 300 ÷ 12
custo variável/km = 0,12 + 0,07 + 0,06 + 0,08 = R$ 0,33
custo variável mensal = R$ 0,33 × franquia
franquias = 1.000 / 2.000 / 3.000 km; livre usa 4.000 km internos
custo mensal = depreciação + capital + IPVA + seguro + licenciamento
              + variável + telemetria (90) + administração (100) + sinistro (75)
preço sem arredondamento = custo mensal × (1 + 12% + 1%)
preço final = próximo múltiplo de R$ 50 para cima (múltiplo exato permanece)
```

IPVA anual: carro 2,5%, diesel 3,0%, moto 1,0%. Valores anuais são rateados por 12 para o custo mensal. Não há arredondamento intermediário; as frações de centavo são preservadas até o arredondamento comercial final.

Exemplo de regressão: FIPE R$ 100.000, carro, franquia 1.000 km → base R$ 94.000, custo mensal R$ 2.788,1666…, preço antes do arredondamento R$ 3.150,6283… e **preço final R$ 3.200/mês**.

```typescript
import { quoteCar3 } from './src/domain/quote-car3';
import { INITIAL_CAR3_PARAMETERS } from './src/domain/car3-parameters';

const quote = quoteCar3(
  { fipeCents: 10000000n, ipvaCategory: 'carro', franquia: 1000 },
  { version: 'car3-initial-2026-10-03-v1', approved: true, values: INITIAL_CAR3_PARAMETERS },
);
// quote.totalCents === 320000n; quote.snapshot contém parâmetros e versões.
```

`bigint` e frações racionais evitam ponto flutuante. No transporte JSON e SQL, dinheiro e taxas são strings. Não converter `bigint` para `Number`. O PostgreSQL usa `bigint` em centavos, com checks não negativos. O cache identifica mês de referência como data no primeiro dia do mês, sem impor convenções comerciais a anos/códigos FIPE.

## Snapshot, persistência e acesso

Cada cotação exige exatamente um snapshot. Foreign keys diferidas exigem ambos no mesmo commit e garantem que o total da cotação coincide com o snapshot. Triggers rejeitam `UPDATE`, `DELETE` e `TRUNCATE` em snapshots, cotações emitidas e versões de parâmetros. Alterações futuras de parâmetros criam uma **nova versão**, preservando as anteriores. Administradores do banco ainda podem alterar/desabilitar proteções; imutabilidade não substitui controle administrativo e backups.

O snapshot guarda parâmetros completos, versão de regras/motor, entrada, total e metadados FIPE. A RPC `car3_persist_quote` copia parâmetros do banco e compara com os efetivamente usados pelo cálculo. Ela roda como `SECURITY INVOKER`, em uma transação, e é executável apenas por `service_role`. O repositório privilegiado fica no servidor; o usuário é identificado por token verificado, e uma FK composta impede vincular cotação ao cliente de outro usuário.

RLS está habilitada nas seis tabelas. Usuários acessam somente seu perfil, clientes, cotações e snapshots. Parâmetros aprovados são legíveis por autenticados. Cache e escritas em cotações/snapshots ficam exclusivos do backend. Não há permissões para `anon`. A RPC não recalcula o preço em SQL: a integridade comercial depende do motor confiável no servidor, por isso o browser não recebe permissão para executá-la.

## PWA e próximos contratos

`manifest.ts` prepara o manifest nativo do Next.js. Ícones, service worker, instalação e política offline ainda não foram implementados. Antes do offline, definir cache e proteção de dados pessoais; não armazenar tokens ou respostas autenticadas indiscriminadamente.

Ainda não especificados: cobrança de excedentes (eventos, proporcionalidade e categoria), validade de cotação, TTL do cache, alterações/cancelamentos e regras de proposta financiada. As tarifas de excedente estão preservadas no seed; não implementamos uma fórmula de cobrança adicional. Cada nova regra deve ser confirmada antes de implementada.

## Validação

Vitest testa as fórmulas, taxas por categoria, franquias, frações de centavo, limites de entradas, arredondamento para cima, imutabilidade do snapshot e integração com providers/repositórios de teste.

Os testes SQL executam as migrations e o seed no PostgreSQL via PGlite/WASM, emulando somente as identidades e roles Supabase necessárias. Testam integridade referencial, snapshot obrigatório, totais consistentes, triggers, RLS, RPC e idempotência do seed. Isso não testa o serviço Auth/REST real nem substitui a validação com `supabase start`: Docker e credenciais remotas não estavam disponíveis durante esta implementação.

Referências: [PWA no Next.js](https://nextjs.org/docs/app/guides/progressive-web-apps), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [chaves Supabase](https://supabase.com/docs/guides/api/api-keys).
