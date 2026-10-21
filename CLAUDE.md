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
Docker porta **5436** — ou Postgres 16 nativo em `~/.pgdata`) · Tailwind 4 só utilitários · Vitest 4 (projects `unit`/`integration`) ·
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
- Login dev: `admin@local.dev` / `admin123` (`npm run db:seed`); artista de teste
  `joana@artista.test` / `senha-forte-1` (cadastro pelo `/signup`).
- `npm run gate` = `lint` + `typecheck` + `test` + `schema:diff`. Testes: `npm test` (unit +
  integration; integração usa `DATABASE_URL_TEST`, truncado entre testes; 55 arquivos / 290 testes
  em 2026-10-21). `npm run smoke` = Playwright das 5 jornadas (`e2e/journeys.smoke.ts`) contra
  `next start -p 3019` com as flags ligadas — escreve no banco local; `SMOKE_BASE_URL` +
  `SMOKE_READONLY=1` para um deploy; `PLAYWRIGHT_CHROMIUM_PATH` em sandbox sem `playwright install`.
- Produção (`next start`) exige `DOCUMENT_HASH_PEPPER`, `DOCUMENT_CIPHER_KEYS`,
  `CERTIFICATE_SIGNING_SEED` e `CRON_SECRET` (fail-closed); pagamento simulado em produção só com
  `STRIPE_MOCK_ALLOWED=1`.
- Deploy: push na `main` = produção na Vercel; `build = migrate:deploy:ci && tsc --noEmit && next build`
  (migrations só com `VERCEL_ENV=production`, `DIRECT_URL` para o lock); crons em `vercel.json`
  (`certificate-anchor` 03:20, `offers-expire` a cada hora) com `CRON_SECRET` + `JobLease`.

## Git
Remote: `https://github.com/moacyveiga-ai/houseart` (desde 2026-10-21; `Housemap/houseart` fica para quando a org liberar — migrar é religar o projeto Vercel). Fluxo: branch curta → `npm run gate`
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

## Estado atual (o mais recente manda)
- **2026-10-21 — Fase 6: HouseArt NO AR.** Produção em
  **https://houseart-housemapp.vercel.app** (deploy `dpl_5XkPYVj8N3jLtYZ37hMB9qZ3MH7a`, commit
  `f48ad20`, build 47 s, migrations no-op). Repositório **`moacyveiga-ai/houseart`** (a org Housemap
  segue com 403; a conta pessoal criou apesar do erro da primeira tentativa) conectado ao projeto
  Vercel `houseart` (`prj_LquuKlmalxrqh1f1sQ7j2QyvKEoI`, time `housemapp`, Node 22, nextjs, funções
  em `gru1`, SSO desligado): push na `main` = produção. Supabase `houseart` (ref
  `zqxkwaivqqlkocbmdvch`, us-east-2, Postgres 17.11) com o schema das 6 migrations aplicado pelo
  conector (50 tabelas, 155 índices, 74 FKs, 7 triggers `ha_tenant_*`, planos e catálogo semeados,
  `_prisma_migrations` com os checksums), papel `houseart_app` e o admin `moacyveiga@gmail.com`
  (senha enviada no chat, trocar no primeiro login). **Pooler é `aws-0-us-east-2`** (o `aws-1`
  responde "tenant/user not found" e derrubou o 1.º build); o host direto só tem IPv6, inútil na
  Vercel. Envs: banco pelo pooler (6543 app, 5432 migrations), segredos gerados, flags do MVP
  ligadas, `STRIPE_ENV=mock` + `STRIPE_MOCK_ALLOWED=1`, provedores `mock`. **Faltam os Blob
  stores** (`houseart-public`/`houseart-private`, 403 pelo conector): sem
  `BLOB_READ_WRITE_TOKEN`/`BLOB_PRIVATE_READ_WRITE_TOKEN` o upload de mídia e de PDF falha em
  produção. Conector Supabase: `apply_migration` e blocos com `$$` dão timeout — `$fn$` e
  `EXECUTE PROCEDURE` passam. Smoke Playwright das 5 jornadas verde contra o build local.
- **2026-10-21 — Fase 5** (`832fd7b`): planos (`lib/plans`), pedidos (`lib/orders`, catálogo
  seedado), porta do Stripe (`lib/stripe/door.ts`, mock/live), Cobrança (`lib/billing`, plano +
  barras de uso contadas da base + faturas: plano, pedidos, comissão retida no split), laudo de
  opinião de valor (`lib/appraisal`: pedido pela carteira → fila → dossiê com comparáveis →
  emissão assinada JWS + PDF no cofre + código `HA-L-…` verificável em `/verify`), estimativa de
  referência no passo 5 do cadastro. As 17 telas do design mapeadas (`SCREEN_MAP` sem pendência).
- **2026-10-21 — Fase 4** (`c6140f8`): Deal em 6 fases a partir do aceite (`lib/deals`), split
  (`lib/commission/split-core.ts`: 12 % primário, 8 % + 4 % secundário), transferência fora da
  plataforma (`lib/ownership`: convite, KYC mock, duas assinaturas, taxa R$ 199, toque),
  direito de sequência 5 % da valorização (`lib/resale-royalty`), carteira do colecionador.
- **2026-10-21 — Fase 3** (`63a2868`): marketplace, mandato com piso que nunca sai do backend,
  proposta pública com OTP, negociador automático (contraproposta a 92 %, nunca o piso), CRM
  Kanban, aviso/e-mail por `notify()`.
- **2026-10-21 — Fase 2** (`a90be9c`): etiquetas NFC (lotes, kits, SUN NTAG 424 com CMAC),
  certificado-escritura assinado (Ed25519 JWS) e emitido (PDF, versão por hash encadeado),
  verificação pública, fila de revisão da equipe, âncora diária (merkle root).
- **2026-10-21 — Fase 1** (`eccc22c`): auth por e-mail/senha e código, tenant por trigger,
  perfis, cadastro de obra em 6 passos com mídia (cofre privado + derivada pública) e duplicidade
  por pHash, dashboard.
- **2026-10-20 — Fase 0** (`197f6d4`, `09b28fc`): esqueleto, DS `--ha-*`, catracas de arquitetura
  com baselines vazias, gate verde.

## Pendências (ordem de valor)
1. Blob stores na Vercel (`houseart-public` e `houseart-private`, 403 pelo conector): criar no
   dashboard e ligar `BLOB_READ_WRITE_TOKEN` / `BLOB_PRIVATE_READ_WRITE_TOKEN` — até lá fotos de
   obra e PDFs de certificado/laudo não sobem em produção.
2. Trocar a senha do papel `houseart_app` e do admin (as duas foram geradas nesta sessão); domínio
   próprio + `APP_URL` (hoje os links de e-mail saem com a URL da Vercel); mover o repo para
   `Housemap/houseart` quando a org liberar.
3. Login por "Entrar com e-mail" (código) exige SMTP (`SMTP_*`) — sem ele só e-mail/senha funciona
   em produção.
4. Stripe real (`STRIPE_ENV=live`, PaymentIntent/Connect/webhook) — hoje tudo é mock; assinatura
   de plano via Stripe subscription; nota fiscal.
5. Provedores reais: KYC (Didit), NTAG 424 (master key em HSM, `MARKER_VENDOR=ntag424`),
   carimbo do tempo ICP-Brasil, âncora (OpenTimestamps), frete/seguro, Art Loss Register.
6. Telas fora do pacote (§J.1): site público `/e`, página pública completa da obra, web da
   galeria/colecionador, app do artista (NFC real), design system completo.
7. Contrato de consignação (`DEFAULT_GALLERY_BPS` é placeholder), "Vender" pela carteira
   (colecionador como vendedor no secundário), viewing rooms (barra "0 de N"), assinatura por OTP
   do certificado, re-verificação/expiração do KYC, Supabase Auth (`AUTH_PROVIDER=supabase`).
8. Nomes em pt-BR herdados nos exports de `lib/timezone.ts`, `lib/dates.ts`, `lib/format.ts` e
   `lib/after.ts` (portados; renomear junto com feature nenhuma).
