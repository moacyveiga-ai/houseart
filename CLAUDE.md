# CLAUDE.md — HouseArt

> **O que é:** plataforma de arte. Artistas cadastram obras; um marcador físico (tag NFC
> NTAG 424 DNA) gera a identidade única por obra e artista; a plataforma emite o
> **certificado-escritura** digital, transferível ao comprador na venda; marketplace de obras
> autenticadas (primário e secundário) e serviço de avaliação com laudo. Clientes: artista,
> galeria, consultor (art advisor), colecionador, avaliador, instituições.
>
> **De onde vem:** repositório NOVO, construído do zero a partir de `HOUSEART_BUILD.md`, portando
> módulos selecionados da **Housebroker** (`Housemap/housebroker`), que é a referência de
> arquitetura e stack — NÃO é fork: nada volta para lá, nada é sincronizado de lá.
> Brief de negócio: `docs/HOUSEART-ESTUDO.md`.
>
> **Fonte de verdade de UI: `./houseart-design`** (saída do Claude Design — telas, fluxos,
> estados, textos, tokens e componentes). Não resuma nem reinterprete: referencie por caminho.
> Onde o design e a Housebroker divergirem, o design vence.

## Vocabulário (obrigatório em código, UI e docs)
artista · galeria · consultor · colecionador · obra (`Artwork`) · marcador físico
(`PhysicalMarker`) · certificado (`Certificate`, versão por hash) · titularidade (`OwnershipTransfer`)
· proveniência · laudo (`Appraisal`) · proposta/proponente/contraproposta (nunca "lance"/"leilão")
· pedido (`Order`) · negócio (`Deal`). **Nenhum termo imobiliário** (imóvel, corretor, imobiliária,
matrícula, cartório, CRECI) existe neste repo fora de `HOUSEART_BUILD.md` §C/§D.

## Stack (fixa — ver HOUSEART_BUILD.md §A)
Next 16.2.6 (App Router, `middleware.ts` Edge) · React 19.2.4 · TypeScript 5 strict · Prisma 7.8
(`@prisma/adapter-pg`, cliente gerado em `app/generated/prisma`) · Postgres 17 (Supabase; dev no
Docker porta **5436**) · Tailwind 4 só utilitários · Vitest 4 (projects `unit`/`integration`) ·
Playwright 1.62 (`e2e/*.smoke.ts`) · Node **22.x** (`.nvmrc`) · Vercel (`main` = produção) ·
Stripe + Connect (único trilho de pagamento) · Vercel Blob (público + cofre privado) ·
`@anthropic-ai/sdk` · web-push · pdf-lib · nodemailer.

## Regras inegociáveis
1. **Um schema Prisma**, migrations em `prisma/migrations/` aditivas e reexecutáveis
   (`IF NOT EXISTS`, `DO $$ … pg_constraint`). **NUNCA `db push`** (índices parciais e CHECKs
   existem só na migration). Migration aplicada em produção nunca é renomeada.
2. ids `Int @id @default(autoincrement())`; **String + allowlist** em `lib/<module>/domain.ts`
   (sem enum); sem `Json`/`String[]` (`*Json String`); **dinheiro `BigInt` em centavos
   (`*Cents`)**, percentuais `Int` bps; `Bytes` só para PDF congelado.
3. PII: `*Enc` (AES-256-GCM, `lib/crypto/cipher.ts`), `*Hash` (HMAC com `DOCUMENT_HASH_PEPPER`),
   `*Mask`. Tokens só como sha256. CPF/CNPJ nunca em log, lista, DTO público nem `AuditLog`.
4. **Tudo em inglês** (identificadores, models, colunas, arquivos, flags, envs, rotas, eventos);
   UI, docs, commits e ADRs em pt-BR.
5. Modular monolith: `app/<module>/` (UI) + `app/api/<module>/` + `lib/<module>/` (regra);
   `*-core.ts` puro (sem prisma/next/server-only) · `*-server.ts` com I/O · ilha client em
   `components/<module>/`. Nada de regra em `route.ts`. `app/` não importa `@/lib/prisma`.
6. Multi-tenant: `Tenant` (PF = artista/consultor autônomo, PJ = galeria), `tenantId` escalar
   derivado por trigger `ha_tenant_*` nas listas quentes, extension do Prisma (`lib/scope/`) que
   lança `ScopeNotApplied` em dev/test para consulta sem dono. `FLAG_TENANT_SCOPE` nasce ligada.
7. Auth modo dual `AUTH_PROVIDER=legado|supabase`; cookie `houseart_session`; sessão em DB com
   `h1:`+sha256; RBAC em `lib/authz/` (catálogo TS de permissões, papéis built-in por perfil;
   `FLAG_RBAC_SHADOW` → `FLAG_RBAC`). Perfis: admin, manager, operator, finance, member,
   gallery_admin, appraiser, collector, institution.
8. Flags só por `lib/flags.ts` (`flagOn`, liga com `'1'`); toda env no `.env.example`; URL
   pública só por `lib/public-url.ts` (`APP_URL`); IP só por `lib/http/ip.ts`; efeito depois da
   resposta por `lib/after.ts`; `registrarAudit`→`audit.*` em toda escrita relevante.
9. Catracas em `lib/architecture/` (layers, import-cycles, prisma-in-routes, route-tests,
   menu-guards, nav-targets, estados-de-tela, private-uploads, public-origin, ip-headers, flags,
   env) e de tokens (`ha-tokens`, `tailwind-paleta`, `brand`): **baselines nascem vazias e ficam
   vazias**. `npm run gate` = lint + typecheck + test + schema:diff.
10. Domínio: o **piso** (`Mandate.reservePriceCents`), `riskAdjustedCents` e `closeProbability`
    NUNCA saem do backend; sem leilão (sem lances/ranking/contador públicos); o **hash de
    documento nunca sai do servidor**; o certificado é imutável por versão (hash encadeado) — nova
    versão, nunca edição; transferência de titularidade só com as quatro condições (KYC do
    comprador, cessão assinada, liquidação, tap do marcador); direito de sequência calculado pela
    plataforma, nunca digitado; obra só é listada com o selo "Obra Autenticada" verde.
11. Fuso da casa `America/Bahia` fixo (`instrumentation.ts`); dia por `lib/timezone.ts`.
12. Design system: tokens `--ha-*` (Fraunces + Inter + Material Symbols Rounded) e classes `.ha-*`
    em `app/ds/`, cor só por token, paleta Tailwind proibida. Valores vêm de `./houseart-design`
    (`HOUSEART_BUILD.md` §G). Raio existe (`--ha-radius-sm/md/lg`) — não herdar o raio 0 da Housebroker.
13. Revisão adversarial antes de cada fase ir para a `main`: zero achado CONFIRMED.

## Ambiente
- Node 22 via nvm: `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use`.
- `cp .env.example .env` → `npm run db:up` (Postgres 17 em 5436, cria `houseart` e
  `houseart_test`) → `npm run db:migrate` → `npx prisma generate` → `npm run db:seed` (admin).
  Sem Docker: `npm run db:up:native`.
- `npm run dev` → **http://localhost:3008** (`PORT=3019` para o launch do Claude Code; 3007 é a
  Housebroker, 3000 a Housemap — não colidir).
- Login dev: `admin@local.dev` / `admin123`.
- Testes: `npm test` (unit + integration; integração usa `DATABASE_URL_TEST`, truncado entre
  testes); `npm run smoke` (Playwright contra 3019).
- Deploy: push na `main` = produção na Vercel; `build = migrate:deploy:ci && tsc --noEmit && next build`;
  crons em `vercel.json` com `CRON_SECRET` + `JobLease`.

## Git
Remote: `git@github.com:Housemap/houseart.git` (a confirmar). Fluxo: branch curta → `npm run gate`
verde → revisão adversarial → `git pull --rebase origin main` → `git merge --no-ff` → push.
`git pull origin main --rebase` antes de editar; nunca `--force` na `main`; commits pequenos em pt-BR.

## O que NÃO fazer
- Não trazer módulos listados em `HOUSEART_BUILD.md` §F (HouseCrédito, HouseValor AVM/ROV,
  BTG/banking, financeiro da corretora, parcerias entre corretores, rede/Housemap, CRECI,
  matrícula/geo/condomínio, Google Ads, locação, obras/empreendimentos).
- Não sincronizar com a Housebroker nem com a Housemap.
- Não usar laranja Housebroker nem azul Housecap/mint como marca: a identidade é a do design.
- Não criar tabela de domínio para enum; não gravar preço em Float/Decimal; não gravar CPF em
  claro; não expor o piso.

## Estado atual
- 2026-10-20 — Levantamento (`HOUSEART_BUILD.md`) feito sobre a Housebroker; aguardando
  `./houseart-design` para fechar schema (§B), módulos novos (§E), design system (§G) e fases (§H).
