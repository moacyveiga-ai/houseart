# HOUSEART_BUILD.md — instrução de construção do HouseArt

> Versão 2026-10-20. Seções A, C, D, F, I vêm do código da Housebroker (`mapa/01..07`) e do brief;
> B, E, G, H, J vêm das 17 telas de `./houseart-design/HouseArt_Web_App.html`.
> Onde o design divergir deste documento, o design vence.

Referência: `./housebroker` (não alterar). Destino: repositório NOVO `houseart`.
Vocabulário: artista · galeria · consultor (art advisor) · colecionador · obra · certificado ·
marcador físico · titularidade · laudo · pedido · venda. Nenhum termo imobiliário sobrevive
fora das colunas "origem" de C e D.

---

## A. Stack e decisões fixas herdadas da Housebroker

Tudo abaixo vem de `housebroker/package.json`, `next.config.ts`, `vercel.json`,
`vitest.config.ts`, `eslint.config.mjs`, `tsconfig.json`, `docker-compose.yml`,
`prisma.config.ts`, `lib/prisma.ts`, `lib/prisma-url.ts` e `CLAUDE.md`.

### A.1 Versões (copiar literalmente para o `package.json` novo)
| Pacote | Versão | Uso |
|---|---|---|
| next | 16.2.6 | monólito App Router (`middleware.ts` Edge, NÃO `proxy.ts`) |
| react / react-dom | 19.2.4 | |
| typescript | ^5 | `strict`, `moduleResolution: bundler`, paths `@/* → ./*` |
| prisma / @prisma/client | ^7.8.0 | generator `prisma-client`, output `app/generated/prisma` |
| @prisma/adapter-pg · pg | ^7.8.0 · ^8.23.0 | Postgres por TCP (Supabase, Docker, CI) |
| @prisma/adapter-neon · @neondatabase/serverless · ws | ^7.8.0 · ^1.1.0 · ^8.20.0 | só se o host for `neon.tech` (`lib/prisma-url.ts`); HouseArt nasce no Supabase — manter o adapter por paridade, decidir remoção em J |
| @supabase/ssr · @supabase/supabase-js | ^0.12.6 · ^2.115.0 | auth modo dual (`AUTH_PROVIDER`) |
| tailwindcss · @tailwindcss/postcss | ^4 | só para utilitários; cor sempre por token `--hm-*` → renomear para `--ha-*` (ver G) |
| zod | ^4.4.3 | |
| bcryptjs | ^3.0.3 | senha legada |
| @vercel/blob | ^2.3.3 | Blob público + cofre privado |
| pdf-lib · pdfjs-dist · qrcode | ^1.17.1 · ^5.6.205 · ^1.5.4 | certificado, laudo, escritura em PDF; `serverExternalPackages: ["pdfjs-dist"]` |
| stripe | ^22.6.2 | Stripe + Connect |
| nodemailer | ^8.0.11 | SMTP |
| @anthropic-ai/sdk | ^0.97.1 | leitura de documentos, copiloto, legendas |
| web-push | ^3.6.7 | push dos apps |
| @dnd-kit/core | 6.3.1 | Kanban |
| recharts | ^3.9.2 | gráficos (`lib/graficos/tema.tsx`) |
| heic2any | 0.0.4 | foto de celular (HEIC) |
| jszip · exceljs · fast-xml-parser · mapbox-gl · dotenv · server-only | idem HB | mapbox só se o design tiver mapa (galerias/feiras); decidir em J |
| vitest | ^4.1.10 | projects `unit` e `integration` |
| @playwright/test | 1.62.0 | smoke (`e2e/*.smoke.ts`) |
| eslint ^9 · eslint-config-next 16.2.6 · husky ^9.1.7 · lint-staged ^16.4.0 | | |
| Node | 22.x (`.nvmrc` = 22, `engines.node = "22.x"`) | exigido pelo Prisma 7 |

### A.2 Decisões fixas (regras inegociáveis herdadas)
1. **Um schema Prisma, Postgres**, migrations em `prisma/migrations/` (no HouseArt a pasta pode nascer com o nome padrão; na HB é `migrations-pg` por histórico). Migration aditiva e reexecutável (`IF NOT EXISTS`, `DO $$ … pg_constraint`). **Nunca `db push`** (índices parciais e CHECKs só existem na migration).
2. **ids `Int @id @default(autoincrement())`**; `String @id` só para chave natural (ex.: `RateLimitBucket.key`, `JobLease.name`).
3. **Sem enum, sem `Json`, sem `String[]`**: `String` + allowlist em `lib/<modulo>/domain.ts`; listas/objetos em `String` com sufixo `Json`; `Bytes` só para PDF congelado.
4. **Dinheiro em `BigInt` centavos** (`*Cents`), percentuais em `Int` bps, taxas em string decimal. Nada de Float/Decimal novos (a HB tem quatro gerações; o HouseArt nasce só com a última).
5. **PII cifrada**: `*Enc` (AES-256-GCM, `lib/certidoes/cripto.ts` → portar como `lib/crypto/`), `*Hash` (HMAC com pepper, `lib/certidoes/cpf-hash.ts` → `lib/crypto/document-hash.ts`), `*Mask` para exibição. Tokens só como sha256 (`tokenHash`, `otpHash`, `codeHash`).
6. **Código novo em inglês** (identificadores, models, colunas, arquivos, flags, envs, rotas, eventos); UI, docs, commits em pt-BR. Como o HouseArt é repositório novo, **tudo nasce em inglês** — inclusive o que é portado (portar = copiar e renomear).
7. **Modular monolith**: `app/<modulo>/` (UI) + `app/api/<modulo>/` + `lib/<modulo>/` (regra). Nada de regra em `route.ts`. Padrão de arquivo: `*-core.ts` puro (sem prisma/next/server-only), `*-server.ts` com I/O, ilha client em `components/<modulo>/`.
8. **Multi-tenant**: `Tenant` + `tenantId` escalar nas listas quentes, derivado por trigger Postgres (`hb_tenant_derivado` → renomear `ha_tenant_derived`), extension do Prisma que recusa consulta sem dono em dev/test (`lib/escopo/extension-core.ts` → `lib/scope/`).
9. **Auth modo dual** (`AUTH_PROVIDER=legado|supabase`), sessão em DB com hash `h1:`+sha256, cookie (renomear `housemap_sessao` → `houseart_session`), RBAC `lib/authz/` (catálogo de permissões em TS, papéis built-in por perfil, flags `FLAG_RBAC_SHADOW`/`FLAG_RBAC`).
10. **Flags por `lib/flags.ts`** (`flagOn(name)`; liga só com `'1'`; nenhuma `defaultOn` de dinheiro). Toda env no `.env.example` (catraca `lib/architecture/env.test.ts`).
11. **Catracas de arquitetura** (`lib/architecture/*.test.ts`): layers, import-cycles (baseline vazio no repo novo — e deve ficar vazio), prisma-in-routes (baseline vazio), route-tests, menu-guards, nav-targets, estados-de-tela, private-uploads, public-origin, ip-headers, flags, env. **No repo novo as baselines nascem vazias**; a vantagem do recomeço é não herdar os 54 módulos em ciclo da HB.
12. **Fuso da casa** `America/Bahia` fixo (`instrumentation.ts` seta `process.env.TZ`); dia de calendário por `lib/fuso.ts` (`instanteDoDia`, `fimDoDia`, `dataBR`).
13. **Efeitos depois da resposta** por `lib/depois.ts` (`depoisDaResposta` sobre `after()`); `registrarAudit` em toda escrita relevante (`AuditLog`).
14. **Rate limit persistente** (`RateLimitBucket`, `lib/rate-limit/`), IP só por `lib/http/ip.ts`, URL pública só por `lib/url-publica.ts` (`APP_URL`).
15. **Deploy**: Vercel git-connected, `main` = produção, `build = migrate:deploy:ci && tsc --noEmit && next build` (`scripts/migrate-deploy.mjs` com `DIRECT_URL` + advisory lock), `ignoreCommand` que não builda preview, crons em `vercel.json` autenticados por `CRON_SECRET` + `JobLease`. Banco Supabase (pooler 6543 em `DATABASE_URL`, session 5432 em `DIRECT_URL`).
16. **CI** (`.github/workflows/ci.yml`): Postgres 17 em serviço, `prisma validate` → `generate` → `migrate deploy` → `npm run gate` (lint + typecheck + test + schema:diff) → `build`. Husky: pre-commit lint-staged, pre-push typecheck.
17. **Design system** sobre tokens CSS e classes `.hm-*` vendorizadas (`app/ds/tokens.css`, `app/ds/cells.css`, ícones Material Symbols em `public/ds/icons`); `border-radius: 0`; paleta Tailwind proibida (catraca `tailwind-paleta`). O HouseArt troca os VALORES e o prefixo (ver G), não o mecanismo.
18. **Portas públicas** sem a casca do app por `isTokenPage`/`STANDALONE_PREFIXES`; páginas por token valem 30 dias da emissão (`lib/token-links/core.ts`); toda troca de token é CAS no token velho.
19. **Arquivos**: foto passa pelo canvas do navegador antes de subir (`preparePhoto`, ≤ 2048 px, JPEG 0,85 — **ATENÇÃO**: para obra de arte a foto de registro precisa de alta resolução; ver D.1 e J); documento pessoal só no cofre privado (`savePrivateFile`), lido por rota com escopo.
20. **HouseAgentic é repositório externo** que chama o monólito pelo Tool Gateway (`app/api/tools/[tool]`, HMAC v2 em `lib/toolgw/assinatura.ts`, `TOOLGW_SECRET`). Não é pacote npm. O HouseArt expõe o MESMO gateway com tools próprias (ver E); não copia a HouseAgentic.

---

## §3 Matriz Housebroker → HouseArt (classificação por módulo)

Mapeamento de papéis (brief §"Mapeamento Housebroker → HouseArt"): imobiliária → **galeria**;
corretor autônomo → **consultor/art advisor** (e o **artista** como vendedor primário);
proprietário/incorporador → **artista**; comprador → **colecionador**; imóvel → **obra**;
matrícula → **certificado HouseArt**; Avaliação Imobiliária → **Laudo de Opinião de Valor**;
cartório/banco/despachante → **transportadora/seguradora/molduraria/restaurador**;
HousemapMC → **instituições (museus, bancos, leiloeiros)**.

| # | Módulo Housebroker (caminho) | Categoria | Destino no HouseArt | Nota |
|---|---|---|---|---|
| 1 | `lib/auth/`, `lib/auth/supabase/`, `app/api/auth/*`, `app/login`, `app/recuperar-senha`, `app/redefinir-senha`, `app/auth/callback`, `app/oauth/consent`, `middleware.ts`, `lib/rotas-publicas.ts` | PORTAR | `lib/auth/`, idem rotas | renomear cookie e perfis (ver C) |
| 2 | `lib/authz/`, `app/backoffice/acessos/*`, `app/api/admin/acessos/*` | ADAPTAR | `lib/authz/`, `app/backoffice/access/*` | catálogo de permissões reescrito (D.2) |
| 3 | `lib/tenant/`, `lib/escopo/`, triggers `hb_tenant_*` | ADAPTAR | `lib/tenant/`, `lib/scope/` | `Corretor` → `Member` (artista/galeria/consultor); chaves de dono (D.3) |
| 4 | `lib/cadastro/` (usuarios, crud-handler, acesso), `app/configuracoes/cadastro/usuarios`, `app/api/cadastro/usuarios` | PORTAR | `lib/accounts/`, `app/settings/registry/users` | só o CRUD de usuários; cadastros de corretor/imobiliária/incorporadora/fornecedor → ver 5 e F |
| 5 | `lib/corretor/signup-*`, `app/corretor/cadastro`, `app/api/corretor/signup/*`, `lib/account-notice/`, `lib/client-account/`, `app/conta/access`, `app/api/conta/access/*` | ADAPTAR | `lib/signup/` (artista/galeria/consultor), `lib/collector-account/` (colecionador por código) | fluxo de código por e-mail idêntico; documentos do cadastro mudam (D.4) |
| 6 | `lib/creci-verification/`, cron `creci-verification`, `BrokerCreciVerification` | DESCARTAR | — | CRECI não existe em arte. O KYC do colecionador/vendedor (CPF + biometria + PEP, brief Camada 3) é módulo NOVO (E) |
| 7 | `lib/imoveis/` (server, cadastro-server, maquina-estados, photo-intake-core, proprietarios*, dominio), `components/imoveis/` (wizard), `app/imoveis/*`, `app/api/imoveis/*` | ADAPTAR | `lib/artworks/`, `components/artworks/`, `app/artworks/*`, `app/api/artworks/*` | ficha técnica da obra; máquina de estados; proprietário com CPF cifrado e participação em bps (D.1) |
| 8 | `lib/autorizacao/` (termo, token, aceite com hash, LGPD), `app/e/autorizacao/[token]`, `app/api/autorizacoes`, `app/api/publico/autorizacao` | ADAPTAR | `lib/consignment/` | termo de autorização de venda → **termo de consignação** galeria↔artista (D.5) |
| 9 | `lib/imoveis/seal-core.ts`, `seal-server.ts`, `components/seal-dd/` | ADAPTAR | `lib/artworks/seal-*.ts`, `components/seal/` | Selo "Apto à Venda" → Selo "Obra Autenticada" (marcador vinculado + certificado emitido + titular verificado) (D.6) |
| 10 | `lib/certidoes/` (motor de emissão, provedores plugáveis, consentimento LGPD, cripto, fila da mesa), `lib/dd-desk-queue/`, `lib/assisted-issuance/`, cron `certidoes` | ADAPTAR | `lib/provenance-checks/` (motor), `lib/crypto/` (cripto) | motor genérico fica; taxonomia reescrita: Art Loss Register, sanções/PLD, certidões do vendedor, IPHAN (D.7) |
| 11 | `lib/dd-steps/`, `lib/dd-report/` (dossiê, emissão com código HB-, PDF congelado com hash, `/v`), `lib/diligencia/`, `app/diligencia/*`, `app/v/*` | ADAPTAR | `lib/provenance-report/`, `app/provenance/*`, `app/verify/*` | dossiê de proveniência; `/v` vira a verificação pública do CERTIFICADO e do laudo (D.8) |
| 12 | `lib/registry-reading/` (leitura da matrícula por IA) | ADAPTAR | `lib/document-reading/` | mesmo pipeline (reserva → chamada paga → revisão → confirmação), prompt/schema novos: certificados antigos, notas de galeria, catálogos (D.9) |
| 13 | `lib/parties/marital.ts`, `qualification-server.ts` | DESCARTAR | — | outorga conjugal é exigência de imóvel. Herdeiros/espólio do artista viram parte do módulo `artists` (E) |
| 14 | `lib/ofertas/` (estado, aceite-core, negocio-vivo, mandato-motor, alcada, retratação, var), `lib/negociacao/`, `app/propostas`, `app/mandatos`, `app/api/propostas`, `app/api/publico/propostas`, `app/e/imovel/[id]/proposta`, `components/ofertas/`, `components/mandatos/` | ADAPTAR | `lib/offers/`, `app/offers`, `app/mandates`, `app/api/offers`, `app/api/public/offers` | "Fazer Oferta" + negociador com mandato + piso sigiloso: reaproveitamento muito alto; sai ITBI/FGTS/desocupação/financiamento; entra "preço fixo" (D.10) |
| 15 | `lib/esteira/` (motor de fases, gates, avanço automático, portal das partes com OTP, exceções, relatório), `lib/negocio/` (timeline, automação, copiloto, notificar, whatsapp-inbound), `lib/sales/`, `lib/compra/`, `lib/vendas/`, `app/negocios/*`, `app/vendas/*`, `app/portal/[token]`, `app/e/compra/[token]`, `components/esteira/`, `components/negocio/`, cron `esteira`, jobs `automacao-negocios`, `resumo-negocios`, `monitor-vendas` | ADAPTAR | `lib/transaction/`, `lib/deal/`, `app/deals/*`, `app/portal/[token]` | motor fica; fases e templates reescritos: oferta → escrow → embalagem/frete → seguro → entrega confirmada (tap na tag) → transferência do certificado (D.11) |
| 16 | `lib/tasks/`, `lib/tarefas/`, `app/crm/tarefas`, `app/api/tarefas/*`, `components/tasks/` | PORTAR | `lib/tasks/`, `app/crm/tasks`, `components/tasks/` | genérico; `LINKABLE_ENTITIES` muda (artwork, deal, contact) |
| 17 | `lib/contratos/` (cofre de CPF, modelos, protecao, extenso), `lib/contract-templates/`, `lib/assinaturas/` (OTP, ordem, certificado de auditoria, código de validação), `app/contratos/*`, `app/assinar/[token]`, `app/validar/*`, `app/api/contratos/*`, `app/api/assinaturas/*`, `app/api/modelos-contrato/*` | ADAPTAR | `lib/contracts/`, `lib/contract-templates/`, `lib/signatures/`, `app/contracts/*`, `app/sign/[token]`, `app/validate/*` | assinatura e cofre portam quase sem mudança; `promessa.ts`/`variaveisRegistry.ts` descartados e substituídos por **cessão de titularidade** e **termo de consignação** (D.12) |
| 18 | `lib/valuation/opinion/` (engine de fatores em bps, versões imutáveis, PDF congelado, código de verificação), `lib/valuation/document-kit/`, `lib/valuation/opinion/verification.ts`, `app/imoveis/avaliacao/*`, `components/valor/OpinionStudio` | ADAPTAR | `lib/appraisal/`, `app/appraisals/*`, `components/appraisal/` | motor "perguntas → fatores → faixa → bloqueadores" fica; base R$/m² × área sai; entra base por artista/técnica/dimensão + comparáveis (D.13) |
| 19 | `lib/valuation/{rov,simulador,normative,estimate,ingestion,model,features,geo,offer-factor,observability,backoffice,db}`, `services/valuation-model/`, `lib/valor/`, `lib/simulador/`, `app/simulador`, `app/e/valor`, `app/e/rov`, `app/e/precificacao`, `app/e/parecer`, `app/backoffice/valuation`, jobs `valuation-*`, `lib/integrations/valuation-host/` | DESCARTAR | — | AVM imobiliário, ROV, parecer NBR, simulador de financiamento SBPE: métricas imobiliárias do HouseValor |
| 20 | `lib/housecredito/` (59,7k LOC), `app/housecredito/*`, `app/api/housecredito/*`, `components/housecredito/`, `app/backoffice/housecredito/*`, `app/financiamento-imobiliario`, jobs `housecredito-*`, `credito-vencimentos`, flags `FLAG_HOUSECREDITO*`, 27 models | DESCARTAR | — | financiamento imobiliário. BNPL de arte é fase 2 do brief e nasce NOVO quando vier |
| 21 | `lib/credito/` (legado), `app/credito/*`, `app/api/credito/*`, models `Credit*`, `AnaliseCredito`, `ConfigAssertiva`, flags `CREDIT_*`, `lib/assertiva/` | DESCARTAR | — | congelado na HB; sem uso em arte |
| 22 | `lib/billing/` (Stripe: assinaturas, dunning, servicos checkout, split, razão, fiscal, connect, contas), `app/api/billing/*`, `app/perfil/recebimentos`, `app/perfil/plano`, job `billing-diario` | ADAPTAR | `lib/billing/` | trilho Stripe + Connect como ÚNICO trilho de pagamento (BTG não vai — ver 23); split multi-parte (plataforma, galeria, artista, direito de sequência, frete) e escrow (D.14) |
| 23 | `lib/btg/`, `lib/banking/`, `lib/payouts/` (lotes BTG, dupla alçada), `app/banking/*`, `app/api/banking/*`, `app/api/payouts/*`, jobs `extrato-banco`, `payouts-lote`, `cobrancas-vencidas` | DESCARTAR | — | banco BTG Empresas é integração da Housebroker; o HouseArt começa só com Stripe (brief: Stripe Connect/Asaas/Pagar.me; acima de R$ 100 mil escrow bancário — decisão em J). `lib/payouts/alcada-core.ts` (dupla alçada) e `lote-core.ts` são genéricos: PORTAR só eles para `lib/payouts/` se o design tiver tela de repasse |
| 24 | `lib/pedidos/` (catálogo de serviços, Pedido PED-, máquina ABERTO→COBRADO→PAGO), `app/banking/pedidos`, `app/banking/catalogo`, `app/api/pedidos/*`, `app/api/catalogo/*` | ADAPTAR | `lib/orders/`, `app/orders/*`, `app/api/orders/*` | catálogo reescrito (certificação, transferência off-platform, laudo, DD de proveniência, frete, seguro, exportação, destaque); provedor só Stripe (D.15) |
| 25 | `lib/planos/` (Free/Pro, franquias, mensalidade, régua de inadimplência, take por plano), `app/banking/planos`, `app/api/planos/*`, job `planos-mensalidade` | ADAPTAR | `lib/plans/` | planos Artista (grátis até 10 obras / Ateliê), Galeria / Galeria Pro, Consultor; franquias por obras cadastradas e serviços (D.16) |
| 26 | `lib/corretagem/` (corretagem nasce na promessa assinada, partes por corretor, perfil de cobrança), `lib/parcerias/` (split em cascata, termo, timeline com hash, disputa) | ADAPTAR (parcial) | `lib/commission/` | só o núcleo: `split.ts` (`calcularCascata`, `porBps`), `timeline.ts` (cadeia de hash), `perfil-core.ts` (PF/PJ, Pix mascarado) e a máquina `STATUS_CORRETAGEM`. Comissão nasce no ACEITE da oferta (não em promessa); papéis = PLATAFORMA, GALERIA, ARTISTA (direito de sequência), CONSULTOR, FRETE (D.17). Parceria entre corretores (`Partnership`, 17 models) NÃO vai |
| 27 | `lib/financeiro/` (razão da corretora, DRE, conciliação, DIMOB, aging, ABC, importação de extrato), `app/financeiro/*`, `app/api/financeiro/*` | DESCARTAR | — | ERP financeiro da imobiliária. O HouseArt usa só o razão do billing (`lib/billing/razao/`), que já faz DRE por competência |
| 28 | `lib/crm/` (contatos, oportunidades, funil, originação, score IA, ficha do cliente), `app/crm/*`, `app/api/crm/*`, `components/crm/`, `lib/contact-avatar/` | ADAPTAR | `lib/crm/` | CRM da galeria/consultor; `Contato` ganha perfil de colecionador (técnicas, artistas, faixa de preço) (D.18) |
| 29 | `lib/conversations/` (3 colunas, WhatsApp/e-mail/app, anexos, notas), `app/crm/conversas`, `app/api/crm/conversas/**`, `components/conversations/`, `lib/client-chat/` | PORTAR | `lib/conversations/`, `lib/collector-chat/` | genérico |
| 30 | `lib/agenda/` (visitas, disponibilidade, Google Agenda, .ics), `app/agenda`, `app/api/agenda/**`, `app/e/visita/[token]` | ADAPTAR | `lib/schedule/` | visita ao imóvel → visita ao ateliê/galeria/viewing room; mantém Google e .ics (D.19). **Só se o design tiver agenda** — senão DESCARTAR |
| 31 | `lib/notifications/` (catálogo por audiência, silêncio, dedupe, push VAPID, sw.js), `app/api/notifications/*`, `app/broker/notifications`, `app/conta/notifications` | ADAPTAR | `lib/notifications/` | catálogo de eventos reescrito (D.20) |
| 32 | `lib/email/` (SMTP, layout único, modelos editáveis com versão, trilha `EnvioEmail`, undeliverable), `app/backoffice/email/*`, `app/api/admin/email/*` | ADAPTAR | `lib/email/` | layout com a marca HouseArt; `CHAVES_MODELO` reescritas (D.21) |
| 33 | `lib/whatsapp/` (Cloud API da casa), `lib/whatsapp-business/`, `lib/whatsapp-evolution/`, `app/configuracoes/whatsapp-*`, webhooks | PORTAR | idem | genérico; `Corretor` → `Member` nas conexões por pessoa |
| 34 | `lib/marketing/` (campanhas, cards do Instagram, agendamento, impulsionamento Meta, Lead Ads, IA de campanha), `lib/meta-account/`, `app/marketing/*`, `app/api/marketing/*`, `app/backoffice/instagram`, jobs `publicar-agendados`, `meta-refresh-token`, `meta-ads-insights` | ADAPTAR | `lib/marketing/`, `lib/meta-account/` | estúdio de divulgação de obras: templates de card para arte, catálogo Meta para shopping (D.22). `anuncio-imovel.ts`/`campanha-imovel.ts` → `artwork-post.ts` |
| 35 | `lib/google-ads-account/`, `lib/marketing/google*.ts`, `app/configuracoes/google-ads`, job `google-ads-insights` | DESCARTAR | — | dormente na HB por decisão do Gustavo (2026-10-09); não nasce no HouseArt |
| 36 | `lib/community/` (feed, parcerias por swipe, comentários, mensagens, perfil, denúncia, backoffice, termos com hash, procura), `app/broker/community/*`, `app/api/community/*`, `app/backoffice/comunidade/*`, `components/community/`, job `community-sweep` | ADAPTAR | `lib/community/` | Comunidade HouseArt (artistas, galerias, colecionadores); post por obra/artista; convites de exposição; parcerias de representação galeria↔artista (D.23). **Só se o design tiver** |
| 37 | `lib/rede/`, `lib/network/`, `lib/partners/` (Partners API v1 Housemap), `app/rede/*`, `app/api/rede/*`, `app/api/network/*`, `app/api/partners/v1/*`, `lib/lancamentos/`, `app/lancamentos/*` | DESCARTAR | — | integração Housemap (incorporadora/lançamento/vínculo) |
| 38 | `lib/parceiros/` (HMAC S2S, webhook in/out com outbox e backoff, anti-SSRF), job `parceiros-eventos` | PORTAR | `lib/partners-webhooks/` | infraestrutura pura; base da API para galerias com sistema próprio (Artlogic, ArtBinder) e para instituições (brief módulo 12) |
| 39 | `lib/toolgw/` (gateway HMAC v2, anti-replay, trilha), `app/api/tools/[tool]` | ADAPTAR | `lib/toolgw/` | gateway porta; tools reescritas: `searchArtworks`, `verifyCertificate`, `estimateValue`, `offerStatus`, `provenanceAssistant` (D.24) |
| 40 | `lib/market-indicators/` (BCB, AwesomeAPI), `components/layout/MarketIndicatorsStrip`, jobs `market-indicators-*` | ADAPTAR | `lib/market-indicators/` | trocar IPCA/INCC por dólar, euro e índice de preços de arte (Artprice100 ou índice próprio — sem API aberta, decisão em J) (D.25) |
| 41 | `lib/storage/` (Blob público + cofre privado, tipo pelos bytes), `lib/private-files/`, `app/api/files/[kind]/[id]`, `app/api/upload`, `app/api/imoveis/upload-foto` | ADAPTAR | `lib/storage/`, `lib/private-files/`, `app/api/artworks/upload-photo` | `PRIVATE_FILE_KINDS` reescrito (artwork-doc, certificate, appraisal, contract, kyc-doc); upload de foto com alta resolução preservada no cofre + derivada pública (D.1) |
| 42 | `lib/pwa/`, `lib/broker-app/`, `lib/client-app/`, `app/broker/*`, `app/conta/*`, `app/instalar/*`, manifests, `public/sw.js`, `mobile/android`, `components/app-shell/`, `components/broker-app/`, `components/client-app/` | ADAPTAR | `lib/pwa/`, `lib/artist-app/`, `lib/collector-app/`, `app/studio/*`, `app/collector/*`, `app/install/*` | casca mobile dos dois apps; telas redesenhadas pelo design (G e E) |
| 43 | `components/layout/AppShell.tsx` (áreas, abas, `REGRAS_DE_HREF`, `AREA_BY_PREFIX`), `HousebrokerLogo`, `GlobalSearch`, `NotificacoesBell`, `UserMenu`, `AreaLoading`, `AppError`, `lib/architecture/panel-segments.ts` | ADAPTAR | `components/layout/` | áreas e abas pelo design (G) |
| 44 | `app/e/*` (portal público: home, vitrine, PDP, filtros, header/footer), `components/market/portal/*`, `lib/imoveis/publico*.ts`, `vitrine*.ts`, `lib/portal/capas-server.ts`, `app/backoffice/portal` | ADAPTAR | `app/(market)/*` ou conforme design, `lib/marketplace/`, `components/market/` | marketplace primário e secundário, viewing room, página pública da obra (D.26) |
| 45 | `lib/dashboard/` (KPIs, VGV, metas, ranking), `app/page.tsx`, `components/dashboard/` | ADAPTAR | `lib/dashboard/` | renomear: VGV → volume vendido; selo DD → obras autenticadas; ranking por galeria/consultor (D.27) |
| 46 | `lib/profile/`, `lib/integrations/` (catálogo de integrações, house-admin), `app/configuracoes/*`, `components/profile/`, `components/integrations/` | ADAPTAR | `lib/profile/`, `lib/integrations/`, `app/settings/*` | perfil sem CRECI/comissão/meta; catálogo de integrações sem Google Ads (D.28) |
| 47 | `lib/audit/`, `lib/depois.ts`, `lib/rate-limit/`, `lib/http/`, `lib/url-publica.ts`, `lib/fuso.ts`, `lib/datas.ts`, `lib/format.ts`, `lib/telefone.ts`, `lib/phone/`, `lib/names/`, `lib/busca-texto.ts`, `lib/ids.ts`, `lib/flags.ts`, `lib/job-lease/`, `lib/jobs/`, `lib/filas/backoff.ts`, `lib/observability/`, `lib/pdf/`, `lib/token-links/`, `lib/system-user/`, `lib/theme*.ts`, `lib/graficos/`, `lib/canais/`, `lib/audio/`, `instrumentation.ts`, `lib/prisma*.ts` | PORTAR | mesmos nomes (inglês onde ainda é pt-BR: `lib/after.ts`, `lib/timezone.ts`, `lib/dates.ts`, `lib/public-url.ts`, `lib/text-search.ts`) | infraestrutura |
| 48 | `lib/architecture/*` (catracas), `lib/tailwind-paleta.test.ts`, `lib/hm-tokens.test.ts`, `lib/app-shell-tokens.test.ts`, `lib/hm-text-on-bg.test.ts`, `lib/campos-mascara.test.ts`, `lib/marca*.test.ts`, `test/integration/{setup,db,fixtures,sessao}.ts`, `e2e/`, `scripts/{migrate-deploy*,db-preparar,db-native,pre-deploy-checks,seed-admin}` | PORTAR | idem | baselines vazias; `marca` → "HouseArt"; fixtures reescritas sobre o schema novo |
| 49 | `lib/empreendimentos/`, `lib/unidades/`, `lib/mktplace/`, `lib/market/` (configurador), `lib/tabela/`, `app/empreendimentos/*`, `app/tabela*/*`, `app/marketplace`, `app/mktplace`, `app/lancamentos`, `app/formas-de-pagamento`, `app/api/{empreendimentos,unidades,chamados,clientes,cnpj,importar,parcelas,selecoes,tabela,templates,vendas,mandatos}`, models de Empreendimento/Unidade/Venda/Parcela/Cliente/Chamado/Fornecedor/Incorporadora/Imobiliaria/Midia, todos os 33 models de obras/viabilidade/Sienge | DESCARTAR | — | legado da incorporadora e da construção |
| 50 | `lib/locacao/`, `lib/rental/`, `app/e/alugar`, `components/market/portal/*Locacao*` | DESCARTAR | — | locação |
| 51 | `lib/anuncio-publico/` (auto-anúncio `/e/anunciar`, triagem de lead), `components/market/portal/AnunciarPortal` | ADAPTAR | `lib/public-listing-request/` | colecionador anuncia obra para revenda sem conta? Só se o design tiver; senão DESCARTAR |
| 52 | `lib/broker-landing/`, `app/corretores` | ADAPTAR | `lib/landing/`, `app/for-artists`, `app/for-galleries` | landing de aquisição; conteúdo e calculadora pelo design |
| 53 | `lib/agente/` (roteador de intenção sem importador) | DESCARTAR | — | morto na HB |

Contagem: **PORTAR 10** (#1, 4, 16, 29, 33, 38, 47, 48 + os dois sub-itens genéricos de #23) ·
**ADAPTAR 29** · **DESCARTAR 14** · **NOVO** — ver E (lista preliminar abaixo).

**NOVO (preliminar, do brief — a lista definitiva vem das telas em E):**
`lib/artists/` (identidade verificada, herdeiros/espólio, representantes),
`lib/physical-markers/` (tag NFC NTAG 424 DNA: UID, chaves diversificadas por HSM, SUN/CMAC,
contador, status, histórico de leituras; fallback QR + selo void; obra digital por SHA-256 + pHash),
`lib/fingerprint/` (fotos calibradas + macros, feature matching),
`lib/certificates/` (certificado-escritura: versão, titular, hash do conteúdo, assinaturas JWS,
carimbo do tempo ICP-Brasil, cadeia por hash do anterior, merkle root diário ancorado,
PDF PAdES com QR, exportação verificável offline),
`lib/ownership/` (cadeia de titularidade: cessão assinada pelo vendedor + aceite com KYC +
liquidação + tap da tag → evento `transferred` → nova versão do certificado → split libera),
`lib/kyc/` (CPF + biometria + PEP, provedor externo),
`lib/resale-royalty/` (direito de sequência 5 % sobre max(0, preço − preço anterior), retido no split,
recibo ao artista/herdeiros),
`lib/duplicate-detection/` (pHash/dHash + embeddings CLIP/DINOv2 em pgvector, fila de revisão),
`lib/logistics/` (cotação/contratação de frete especializado e seguro de trânsito no checkout;
seguro de acervo; parceiros de serviço),
`lib/escrow/` (liquidação na conta da plataforma, liberação por condições),
`lib/tax-reports/` (informe de alienação ao vendedor PF, comprovante de custo ao comprador, CNART/COAF),
`lib/export-assist/` (exportação assistida), `lib/public-api/` (consulta pública de certificado,
webhooks para galerias, importação de acervos), `lib/art-price-index/` (fase 2).

---

## B. Modelo de domínio e schema completo

Derivado das 17 telas de `./houseart-design/HouseArt_Web_App.html` (`data-screen-label`: Login,
Escolha de perfil, Dashboard, Minhas obras, Cadastro de obra, Certificação, Vendas e ofertas,
Direito de sequência, Cobrança, CRM de colecionadores, Carteira de escrituras, Compras,
Transferência fora da plataforma, Marketplace, Laudo de opinião de valor, Admin · Obras e
certificados, Admin · Etiquetas) e dos dados de `app-source.tsx` (`OBRAS`, `NAV`, `PASSOS`,
`ETAPAS_TL`, `WAL`, `fila`, `lotes`, `seq`, `faturas`, `kanban`, `ofertas`, `laudos`, `comparaveis`).
Convenções de A.2. Origem: **P** portada (renome), **A** adaptada, **N** nova.

### B.1 Perfis que as telas pressupõem (`perfis` em app-source.tsx)
artista · galeria · colecionador · avaliador ("Prestador de serviço · avaliador") · consultor de arte
(usa as telas de galeria) · admin ("Equipe HouseArt"). Um usuário pode ter mais de um perfil e trocar
no menu do avatar (tela "Escolha de perfil") → `UserProfile` N (user × kind).

### B.2 Tabelas (formato: model · origem · campos · observações)

**Tenancy / auth / RBAC**
- `Tenant` P — `id Int`, `kind String` (PERSON|GALLERY), `name`, `document String? @unique` (dígitos), `slug @unique`, `status String` (ACTIVE|SUSPENDED), `createdAt/updatedAt`.
- `User` P (de `Usuario`) — `email @unique`, `cpf String? @unique`, `name`, `passwordHash?`, `profile String` (allowlist `PROFILES`: admin|manager|operator|finance|member|appraiser|collector), `active Boolean`, `memberId Int? @unique`, `tenantId Int?`, `tenantRole String?` (ADMIN|MEMBER), `authProviderId String? @unique`, `recoverySessionId?/recoverySessionUntil?`, `collectorVerifiedAt?`, `deletionRequestedAt?`. Trigger `ha_tenant_user_from_member`.
- `UserProfile` N — `userId`, `kind String` (ARTIST|GALLERY|ADVISOR|COLLECTOR|APPRAISER|STAFF), `isDefault`; `@@unique(userId, kind)`. É a tela "Escolha de perfil".
- `Session` P, `PasswordReset` P, `AccessCode` A (funde `ClientAccessCode` e `BrokerSignupCode`: `tokenHash @unique`, `purpose` SIGNUP|LOGIN|SILENT, `email`, `codeHash`, `attempts`, `resends`, `blockedUntil`, `payloadEnc?`), `ExternalIdentity` P, `AccessLink` P.
- `Role` P, `RolePermission` P, `UserRole` P (trigger `ha_user_role_tenant`), `RateLimitBucket` P, `JobLease` P, `AuditLog` P.

**Membros e artistas**
- `Member` A (de `Corretor`) — `userId? @unique`, `tenantId`, `kind String` (ARTIST|GALLERY_STAFF|ADVISOR), `displayName`, `slug @unique`, `city`, `uf`, `status String` (PENDING|ACTIVE|REFUSED|INACTIVE), `approvedAt?`, `bio?`. Quente.
- `Artist` N — `memberId? @unique` (artista com conta), `tenantId?` (galeria que representa, quando sem conta), `name`, `slug @unique`, `birthYear?`, `deathYear?`, `heirsJson String @default("[]")`, `verifiedAt?`. Toda `Artwork` aponta para um `Artist` (a tela de laudo e a carteira mostram o nome do artista sem ele ser o vendedor).
- `GalleryProfile` N — `tenantId @unique`, `legalName`, `tradeName`, `cnpjEnc/cnpjHash/cnpjMask`, `addressJson`, `websiteUrl?`.
- `MemberDocument` A (de `BrokerDocument`) — `memberId`, `kind` (ID_FRONT|ID_BACK|SELFIE|PROOF_OF_ADDRESS|COMPANY_DOC), `fileRef` (cofre), `sha256`; `@@unique(memberId, kind)`.
- `Consignment` A (de `AutorizacaoVenda`) — `artworkId`, `galleryTenantId`, `artistId`, `token @unique`, `tokenIssuedAt`, `status` (PENDING|ACCEPTED|REFUSED|REVOKED|EXPIRED), `commissionBps Int`, `exclusive Boolean`, `validityDays Int`, `acceptedAt?`, `acceptIp?`, `acceptUserAgent?`, `termsText?`, `termsHash?`, `termsVersion?`. ISM: `Consignment_artwork_accepted_key (artworkId) WHERE status='ACCEPTED'`. (Tela Dashboard da galeria: "31 em consignação".)

**Obra**
- `Artwork` A (de `Imovel`) — `tenantId`, `memberId` (quem cadastrou), `artistId`, `title`, `year Int?`, `technique`, `materials?`, `heightMm Int?`, `widthMm Int?`, `depthMm Int?`, `edition String?` ("Obra única"), `signatureLocation?`, `series?`, `category String` (PAINTING|SCULPTURE|WORK_ON_PAPER|PHOTOGRAPHY|DIGITAL|OTHER), `conditionGrade String?` (EXCELLENT|GOOD|FAIR|NEEDS_RESTORATION), `conditionBy String?`, `conditionAt?`, `status String` (`ARTWORK_STATUSES`: DRAFT|IN_CERTIFICATION|AUTHENTICATED|LISTED|IN_DEAL|SOLD|ARCHIVED|STOLEN|DISPUTED), `market String?` (PRIMARY|SECONDARY), `saleMode String?` (FIXED|FIXED_WITH_OFFERS|ON_REQUEST), `listPriceCents BigInt?`, `priceSealed Boolean`, `publicId String? @unique` (`HA-AAAA-XXXX-XXXX`, gerado ao vincular marcador), `seal String` (NONE|YELLOW|GREEN), `sealIssuedAt?`, `coverMediaId?`, `createdAt/updatedAt`. Trigger `ha_tenant_from_member_id`. Quente. Índices (tenantId,status), (memberId,status), (artistId), (status,createdAt), publicId.
  - Status ↔ chip da tela: DRAFT="Rascunho", IN_CERTIFICATION="Em certificação", AUTHENTICATED="Autenticada", LISTED="À venda", SOLD="Vendida".
- `ArtworkMedia` N — `artworkId`, `kind String` (FRONT_COLOR_CARD|BACK|MACRO_TL|MACRO_TR|MACRO_BL|MACRO_BR|DETAIL|OTHER), `masterRef` (cofre privado, original), `publicUrl?` (derivada ≤2048px), `sha256`, `pHash String?`, `width`, `height`, `quality String?` (GOOD|BLURRY|PENDING), `sortOrder`. `@@unique(artworkId, kind)` para os 6 slots fixos da tela "Mídia".
- `ArtworkConditionRegion` N — `artworkId`, `region String` (TOP_LEFT|TOP_RIGHT|CENTER|BOTTOM_LEFT|EDGES_FRAME), `note`, `state String` (INTACT|ATTENTION|DAMAGED); `@@unique(artworkId, region)`.
- `ArtworkHistoryItem` N — `artworkId`, `kind String` (EXHIBITION|PUBLICATION|AWARD|RESTORATION|LOAN), `description`, `occurredOn String` (AAAA-MM), `sortOrder`.
- `ArtworkOwner` A (de `ProprietarioImovel`) — `artworkId`, `partyName`, `documentHash/documentEnc/documentMask`, `shareBps Int`, `userId?`; `@@unique(artworkId, documentHash)`. Soma 10000.
- `ArtworkView` A (de `ListingView`) — `artworkId`, `day`, `visitorHash`; `@@unique`.
- `DuplicateCheck` N — `artworkId`, `candidateArtworkId`, `similarityBps Int`, `method String` (PHASH|EMBEDDING), `decision String?` (DIFFERENT|SAME|PENDING), `decidedByUserId?`. (Tela "Encontramos uma obra parecida"; fila admin "Duplicidade".)

**Marcador físico e certificado**
- `MarkerBatch` N — `code @unique` (`2026-10`), `quantity Int`, `destination String`, `tenantId?`, `status String` (NEW|IN_USE|EXHAUSTED), `createdAt`. (Admin · Etiquetas: lote, qtd, destino, vinculadas, status.)
- `PhysicalMarker` N — `batchId`, `uid String @unique` (7 bytes hex), `keyRef String` (referência da chave diversificada; nunca a chave), `status String` (STOCK|SHIPPED|LINKED|REMOVED|REVOKED), `artworkId? @unique`, `linkedAt?`, `linkedByUserId?`, `readCounter Int`, `lastReadAt?`. ISM nenhum.
- `MarkerRead` N — `markerId`, `counter Int`, `cmacValid Boolean`, `tamperFlag Boolean`, `ipHash`, `userId?`, `purpose String` (VERIFY|LINK|DELIVERY_CONFIRM|TRANSFER_CONFIRM); idx (markerId, createdAt). Replay: `counter` > último.
- `MarkerOrder` N — `tenantId`, `memberId`, `quantity`, `unitPriceCents BigInt` (1500), `status String` (REQUESTED|SHIPPED|DELIVERED), `orderId?` (→ Order). (Tela Certificação: "Pedir etiquetas · R$ 150".)
- `Certificate` N — `artworkId @unique`, `publicId @unique` (= Artwork.publicId), `currentVersionId?`, `status String` (DRAFT|ACTIVE|CONTESTED|REVOKED), `stage Int` (0..5 — a régua "Etiqueta pedida · recebida · vinculada · assinada · emitida" da tela), `createdAt`.
- `CertificateVersion` N — `certificateId`, `version Int`, `holderName`, `holderDocumentHash`, `holderDocumentMask`, `holderUserId?`, `contentJson String`, `contentHash String`, `prevHash String?`, `signaturesJson String` (JWS do emissor/titular), `timestampTokenRef String?` (ACT ICP-Brasil), `issuedAt`, `pdfRef?` (cofre), `pdfHash?`, `status String` (ACTIVE|SUPERSEDED); `@@unique(certificateId, version)`.
- `CertificateEvent` N — `certificateId`, `seq Int`, `kind String` (CREATED|CERTIFIED|LISTED|TRANSFERRED|LOANED|RESTORED|STOLEN|DISPUTED|INSURED), `payloadJson`, `hash`, `prevHash?`, `actorUserId?`, `occurredAt`; `@@unique(certificateId, seq)`.
- `DailyAnchor` N — `day @unique`, `merkleRoot`, `network String` (NONE|OPENTIMESTAMPS|POLYGON), `txRef?`, `eventCount`.
- `ReviewQueueItem` N — `kind String` (DUPLICATE|CONTESTATION|NEW_ISSUER|MARKER_REMOVED|EXPORT_RESTRICTION), `artworkId?`, `tenantId?`, `reason`, `status String` (OPEN|APPROVED|REJECTED), `decidedByUserId?`, `decidedAt?`, `createdAt`. (Admin · Obras e certificados.)

**Ofertas, negócio, titularidade**
- `Mandate` A (de `MandatoVenda`) — `artworkId`, `memberId`, `listPriceCents`, `reservePriceCents` (sigiloso), `autoNegotiatorOn Boolean`, `autoAcceptMinBps Int` (9200 = "aceita ofertas a partir de 92%"), `status` (ACTIVE|SUPERSEDED|CLOSED), `version`. ISM `Mandate_artwork_active_key`.
- `Offer` A (de `Proposta`) — `code @unique` (`OFR-AAAA-NNNNNN`), `artworkId`, `mandateId?`, `sellerMemberId`, `tenantId`, `buyerUserId?`, `buyerName`, `buyerEmail`, `buyerDocumentHash/Enc/Mask`, `buyerKind String` (COLLECTOR|ADVISOR_FOR_CLIENT), `buyerCity?`, `offeredCents BigInt`, `acceptedCents?`, `status` (`OFFER_STATUSES`: DRAFT|AWAITING_OTP|RECEIVED|BELOW_RESERVE|NEGOTIATING|ACCEPTED|IN_DEAL|CONVERTED|REFUSED|EXPIRED|RETRACTED|CANCELLED), `expiresAt`, `otpHash?`, `retractionTokenHash? @unique`, `retractionIssuedAt?`, `origin String`. Trigger `ha_tenant_from_member_id`. Quente.
- `OfferRound` A (de `RodadaNegociacao`) — `offerId`, `number`, `author` (BUYER|SELLER|NEGOTIATOR), `amountCents`, `message?`; `@@unique(offerId, number)`.
- `OfferEvent` A.
- `Deal` A (de `Transacao`) — `code @unique` (`DL-AAAA-NNNNNN`), `artworkId`, `offerId @unique`, `sellerMemberId`, `buyerUserId`, `tenantId`, `amountCents`, `shippingCents`, `insuranceCents`, `phase String` (`DEAL_PHASES`: OFFER_ACCEPTED|ESCROW|DOCUMENTS|SHIPPING|DELIVERY|TRANSFER|COMPLETED — as 6 etapas da tela "Vendas · Em andamento"/"Compras" + COMPLETED), `exceptionStatus?`, `escrowPaymentRef?`, `carrierName?`, `trackingCode?`, `insurerName?`, `policyRef?`, `deliveredAt?`, `deliveryMarkerReadId?`, `completedAt?`. Quente.
- `DealPhaseEvent` A (de `EventoTransacao`) — `dealId`, `phase`, `title`, `description`, `occurredAt`, `actorKind`.
- `DealSplit` N — `dealId`, `party String` (ARTIST|GALLERY|PLATFORM|ADVISOR|ARTIST_ROYALTY|SHIPPING|INSURANCE), `bps Int`, `amountCents BigInt`, `status` (HELD|RELEASED|PAID), `payoutRef?`. Soma = `amountCents`. (Tela "Repartição dos valores": Artista R$ 18.012 · Galeria R$ 15.428 · HouseArt 12% R$ 4.560.)
- `OwnershipTransfer` N — `certificateId`, `artworkId`, `dealId?` (null = fora da plataforma), `fromUserId`, `toUserId?`, `toName`, `toEmail`, `toDocumentHash/Enc/Mask`, `priceCents BigInt?`, `priceSealed Boolean`, `sealedPriceHash?`, `royaltyCents BigInt`, `feeCents BigInt` (19900 fora da plataforma), `status String` (DRAFT|INVITED|KYC_PENDING|SELLER_SIGNED|BUYER_SIGNED|FEE_PAID|AWAITING_TAP|COMPLETED|CANCELLED), `sellerSignedAt?`, `buyerSignedAt?`, `tapMarkerReadId?`, `completedAt?`, `newVersionId?`. (Tela "Transferir obra": Comprador → Valor → Assinaturas → Toque do comprador.)
- `RoyaltyPayment` N — `artworkId`, `artistId`, `transferId?`, `dealId?`, `saleCents`, `previousSaleCents`, `appreciationCents`, `royaltyCents` (5 % × max(0, Δ)), `status` (PENDING|HELD|PAID), `paidAt?`, `receiptRef?`. (Tela "Direito de sequência".)
- `KycVerification` N — `userId`, `provider`, `status` (PENDING|APPROVED|REJECTED|EXPIRED), `documentHash?`, `biometricScoreBps?`, `pepHit Boolean`, `verifiedAt?`, `expiresAt?`.
- `Shipment` N — `dealId @unique`, `carrier`, `quoteCents`, `trackingCode?`, `status` (QUOTED|BOOKED|PICKED_UP|IN_TRANSIT|DELIVERED), `pickedUpAt?`, `deliveredAt?`.
- `InsurancePolicy` N — `artworkId`, `kind` (TRANSIT|COLLECTION), `insurer`, `policyNumber`, `validFrom`, `validUntil`, `coverageCents`, `status` (ACTIVE|EXPIRED|CANCELLED). (Carteira: "Chubb · nº 77120-4 · vigente".)

**CRM**
- `Contact` A, `Opportunity` A (etapas INTERESTED|IN_CONVERSATION|OFFER|CLOSED — as 4 colunas do Kanban), `Funnel`/`FunnelStage` P, `Activity` P. `Contact.collectorProfileJson` (interesse, faixa de preço). Triggers `ha_tenant_from_owner_id`.
- `Conversation`, `Message`, `MessageAttachment`, `ChannelConfig` P (fase 6; sem tela nestas 17).
- `Task` P.

**Avaliação**
- `AppraisalRequest` N — `artworkId`, `requestedByUserId`, `requesterLabel` (colecionador, galeria, seguradora), `purpose` (SALE|INSURANCE|INVENTORY|ESTATE), `dueOn`, `assignedAppraiserId?`, `status` (QUEUED|IN_PROGRESS|ISSUED|CANCELLED), `orderId?`. (Fila de laudos.)
- `Appraisal` A (de `ValuationOpinion`) — `requestId @unique`, `artworkId`, `appraiserUserId`, `rootId`, `version`, `supersededById?`, `minCents`, `suggestedCents`, `maxCents`, `comparablesJson`, `methodology String`, `verificationCode @unique` (`HA-L-…`), `pdfRef?`, `pdfHash?`, `signedAt?`, `status` (DRAFT|ISSUED|SUPERSEDED). ISM: um DRAFT por request.
- `AppraisalComparable` N — `appraisalId`, `label`, `dimensions`, `priceCents`, `soldOn`, `source` (AUCTION|GALLERY|HOUSEART).
- `ArtworkPriceEstimate` N — `artworkId`, `lowCents`, `suggestedCents`, `highCents`, `comparablesCount`, `computedAt`. ("Estimativa de referência com base em 14 vendas comparáveis. Não é laudo.")

**Dinheiro**
- `ServiceCatalog` A (`SERVICE_CODES` D.15), `Order` A, `Plan` A (`ARTIST_FREE|ARTIST_STUDIO|GALLERY|GALLERY_PRO|ADVISOR`), `PlanFeature` A (de `FranquiaPlano`: `key` ARTWORKS|CERTIFICATIONS_MONTH|VIEWING_ROOMS|SEATS|APPRAISALS_INCLUDED|TAGS_INCLUDED, `limit Int?`), `PlanSubscription` A (de `AdesaoPlano`; ISM uma viva por tenant), `PlanUsage` A, `Invoice` A (de `FaturaAssinatura` + `Pedido` pago: `date`, `description`, `amountCents`, `status` PAID|HELD_IN_SPLIT|OPEN|CANCELLED, `fiscalDocumentRef?`) — tela "Faturas e notas fiscais".
- `BillingAccount`, `LedgerEntry`, `LedgerPeriod`, `BillingWebhookEvent`, `FiscalDocument` P. `PayoutProfile` A (de `PerfilCobrancaCorretor`).
- `Commission` A (de `Corretagem`, nasce no aceite), `CommissionPart` A.

**Infra / notificações / indicadores**
- `Notification`, `NotificationPreference`, `PushSubscription` P; `EmailTemplate`, `EmailTemplateVersion`, `EmailDelivery` P; `MarketIndicator` P (códigos `HA_INDEX`, `USD_BRL`, `EUR_BRL` — faixa do topo "Índice HouseArt 112,4 · Dólar · Euro").

### B.3 Índices e constraints só na migration (lista inicial)
`Consignment_artwork_accepted_key`, `Mandate_artwork_active_key`, `PlanSubscription_tenant_live_key`,
`Appraisal_request_draft_key`, `Role_product_key_key` + CHECK, `Offer_retraction_token_key` (parcial
WHERE NOT NULL). Triggers: `ha_tenant_from_member_id` (Artwork, Offer, Deal, Mandate),
`ha_tenant_from_owner_id` (Contact, Opportunity), `ha_tenant_user_from_member` (User),
`ha_user_role_tenant` (UserRole).

### B.4 Listas quentes e chaves de dono (`lib/scope/extension-core.ts`)
`HOT_MODELS = ['Artwork','Offer','Deal','Mandate','Contact','Opportunity','Order','Member','User','Tenant','Certificate','AppraisalRequest','OwnershipTransfer']`;
`OWNER_KEYS = ['tenantId','memberId','id','userId','ownerUserId','buyerUserId','fromUserId','offerId','dealId','artworkId','certificateId']`.

---

## C. PORTAR — origem → destino (cópia com renome)

Regra de porte: copiar o arquivo, renomear identificadores para inglês, trocar `@/lib/prisma`
pelo cliente novo, trocar nomes de model, remover toda referência a `Corretor`/`Imovel`/`Imobiliaria`
pelo equivalente (`Member`/`Artwork`/`Gallery`), rodar os testes copiados junto.

| Origem (housebroker) | Destino (houseart) | Renomeações |
|---|---|---|
| `lib/prisma.ts`, `lib/prisma-url.ts`, `lib/prisma-preguicoso.ts` | `lib/prisma.ts`, `lib/prisma-url.ts`, `lib/prisma-lazy.ts` | `criarClientePreguicoso`→`createLazyClient`; extension de escopo → `lib/scope/extension` |
| `lib/auth/index.ts`, `perfis.ts`, `sessao-local.ts`, `rota.ts`, `email.ts`, `erros-login.ts`, `safe-next.ts`, `senha-politica.ts`, `login-rate-limit.ts`, `link-acesso.ts`, `redefinicao.ts`, `sessao-supabase-*.ts` | `lib/auth/index.ts`, `profiles.ts`, `local-session.ts`, `route.ts`, `email.ts`, `login-errors.ts`, `safe-next.ts`, `password-policy.ts`, `login-rate-limit.ts`, `access-link.ts`, `password-reset.ts`, `supabase-session-*.ts` | `COOKIE_NAME='houseart_session'`; `getSessao`→`getSession`, `requirePerfil`→`requireProfile`, `requireStaff`, `requireFinance`; `UsuarioSessao`→`SessionUser` com `memberId` no lugar de `corretorId`; perfis ver D.2 |
| `lib/auth/supabase/*` (config, boot-core, client, server, admin, middleware, fluxos*, recuperacao-core, federacao*, identidades*, provisioning*, conta*, localizar, migracao-core, oauth-core) | `lib/auth/supabase/*` (`flows*.ts`, `recovery-core.ts`, `federation*.ts`, `identities*.ts`, `account*.ts`, `locate.ts`, `migration-core.ts`) | `NEXT_PUBLIC_AUTH_HOUSEMAP`→`NEXT_PUBLIC_AUTH_HOUSEGROUP` (federação com o grupo House; manter o provider `custom:housemap` se a Housemap for o IdP — decisão J) |
| `app/api/auth/{login,logout,me,perfil,senha,recuperar,redefinir,cadastro/completar,federacao/*}/route.ts`, `app/auth/callback/route.ts`, `app/entrar/[token]/route.ts` | `app/api/auth/{login,logout,me,profile,password,recover,reset,signup/complete,federation/*}`, `app/auth/callback`, `app/enter/[token]` | |
| `app/login`, `app/recuperar-senha`, `app/redefinir-senha(/[token])`, `app/cadastro/completar`, `app/oauth/consent`, `components/auth/*` | `app/login`, `app/recover-password`, `app/reset-password(/[token])`, `app/signup/complete`, `app/oauth/consent`, `components/auth/*` | texto das telas pelo design |
| `middleware.ts`, `middleware.test.ts`, `lib/rotas-publicas.ts` | `middleware.ts`, `lib/public-routes.ts` | allowlist reescrita com as rotas públicas do HouseArt (ver E/G); cookie de atribuição `housemap_corretor`→`houseart_ref` |
| `lib/authz/{permissions,roles-seed,core,legacy-map,permission-labels,role-rules,server,roles-server,seed-server,seed-sql,trail}.ts` + testes (`equivalence`, `seed`) | `lib/authz/*` | catálogo de permissões reescrito (D.2); mecanismo igual |
| `lib/cadastro/{usuarios-regras,usuarios-server,crud-handler,usuario-acesso-core,usuario-acesso-audit,usuario-conta}.ts` | `lib/accounts/{user-rules,users-server,crud-handler,user-access-core,user-access-audit,user-account}.ts` | `nivelDoPerfil`→`profileLevel` |
| `app/api/cadastro/usuarios(/[id])`, `app/configuracoes/cadastro/usuarios` | `app/api/registry/users(/[id])`, `app/settings/registry/users` | |
| `lib/audit/`, `lib/depois.ts` (+ testes `depois`, `depois-solto`) | `lib/audit/`, `lib/after.ts` | `depoisDaResposta`→`afterResponse`, `semMorrerNaResposta`→`detached` |
| `lib/rate-limit/{index,rate-limit-core,rate-limit-server,http,publico}.ts` | `lib/rate-limit/*`, `public.ts` | políticas públicas reescritas (oferta, pedido de visita, upload de certidão → `OFFER_IP`, `MARKER_SCAN_IP`, `UPLOAD_IP`) |
| `lib/http/{ip,indisponivel}.ts` | `lib/http/{ip,unavailable}.ts` | |
| `lib/url-publica.ts`, `lib/fuso.ts`, `lib/datas.ts`, `lib/format.ts`, `lib/telefone.ts`, `lib/phone/links.ts`, `lib/names/similarity.ts`, `lib/busca-texto.ts`, `lib/ids.ts`, `lib/flags.ts`, `lib/transform.ts` | `lib/public-url.ts`, `lib/timezone.ts`, `lib/dates.ts`, `lib/format.ts`, `lib/phone/{format,links}.ts`, `lib/names/similarity.ts`, `lib/text-search.ts`, `lib/ids.ts`, `lib/flags.ts`, `lib/transform.ts` | `FLAGS` com a lista de I.3 |
| `lib/job-lease/`, `lib/jobs/{auth-core,auth}.ts`, `lib/filas/backoff.ts` | `lib/job-lease/`, `lib/jobs/`, `lib/queues/backoff.ts` | `comJob`→`withJob` |
| `lib/observability/`, `instrumentation.ts` | idem | |
| `lib/token-links/core.ts` | `lib/token-links/core.ts` | |
| `lib/system-user/identity.ts` | `lib/system-user/identity.ts` | e-mail `sistema@houseart.local` |
| `lib/theme.ts`, `lib/theme-routes.ts`, `lib/graficos/tema.tsx` | `lib/theme.ts`, `lib/theme-routes.ts`, `lib/charts/theme.tsx` | `THEME_KEY='ha-theme'`; `ALWAYS_LIGHT_ROUTES` pelo design |
| `lib/pdf/page-count.ts` | `lib/pdf/page-count.ts` | |
| `lib/certidoes/{cripto,cpf-hash,cpf}.ts` | `lib/crypto/{cipher,document-hash,document}.ts` | `CERTIDOES_CPF_KEYS`→`DOCUMENT_CIPHER_KEYS`, `CERTIDOES_CPF_PEPPER`→`DOCUMENT_HASH_PEPPER`; `protegerCpfCnpj`→`protectDocument` |
| `lib/storage/{blob,private-vault,content-type,private-file-href,read-document,stream-head}.ts`, `lib/private-files/{core,server,response}.ts`, `app/api/files/[kind]/[id]/route.ts` | idem (inglês) | `PRIVATE_FILE_KINDS` ver D.1 |
| `lib/canais/redacao-core.ts`, `lib/audio/transcrever.ts` | `lib/channels/redaction-core.ts`, `lib/audio/transcribe.ts` | |
| `lib/tasks/{core,present,server}.ts`, `lib/tarefas/constants.ts`, `app/api/tarefas/{route,[id],entidades,alertas,kanban}`, `app/crm/tarefas`, `components/tasks/*` (TasksScreen, TaskList, TaskRow, TaskKanban, TaskKanbanCard, TaskPanel, TaskFiltersBar, TaskActionsMenu, EntityPicker, TaskStates, kanban-state, row-click, task-actions, task-form, url-state, tasks.css) | `lib/tasks/`, `app/api/tasks/*`, `app/crm/tasks`, `components/tasks/*` | `LINKABLE_ENTITIES` = artwork, deal, contact, artist |
| `lib/conversations/{core,server,messages-server,dispatch-server,files,attachments-server,html,present,…}.ts`, `app/api/crm/conversas/**`, `app/crm/conversas`, `components/conversations/*`, `lib/client-chat/`, `app/conta/chat`, `app/api/conta/chat` | `lib/conversations/`, `app/api/crm/conversations/**`, `app/crm/conversations`, `components/conversations/*`, `lib/collector-chat/`, `app/collector/chat` | |
| `lib/contact-avatar/{core,server}.ts` | idem | |
| `lib/whatsapp/{client,mensagens}.ts`, `app/api/crm/whatsapp/webhook`, `lib/whatsapp-business/*`, `lib/whatsapp-evolution/*`, `app/api/whatsapp-business/**`, `app/api/whatsapp-evolution/**`, `app/configuracoes/whatsapp-business`, `app/configuracoes/whatsapp-web`, `components/whatsapp-*` | idem com `app/settings/whatsapp-*` | `instanceName` prefixo `ha-` |
| `lib/parceiros/{hmac,segredos,eventos-core,url-core,webhook-in,webhook-out}.ts`, `app/api/partners/v1/events`, job `parceiros-eventos` | `lib/partner-webhooks/{hmac,secrets,events-core,url-core,inbound,outbound}.ts`, `app/api/partners/v1/events`, job `partner-events` | allowlists de evento reescritas (E — API pública) |
| `lib/payouts/{alcada-core,lote-core,codigo}.ts` | `lib/payouts/{approval-core,batch-core,code}.ts` | só se houver tela de repasse manual |
| `lib/architecture/*` + `baseline/*.json` vazios, `lib/tailwind-paleta.test.ts`, `lib/hm-tokens.test.ts`, `lib/app-shell-tokens.test.ts`, `lib/hm-text-on-bg.test.ts`, `lib/campos-mascara.test.ts`, `lib/marca.test.ts`, `components/ds/icones.test.ts` | idem (`ha-tokens.test.ts`, `brand.test.ts`) | prefixos `--ha-*`, marca "HouseArt" |
| `test/integration/{setup,db,esperar-solto,sessao}.ts`, `test/fakes/supabase-ssr.ts`, `vitest.config.ts`, `e2e/playwright.config.ts`, `e2e/alvo.ts` | idem | `fixtures.ts` reescrita (tenant galeria A com artista A1/consultor A2, artista autônomo B) |
| `scripts/{migrate-deploy.mjs,migrate-deploy-core.mjs,db-preparar.mjs,db-native.mjs,pre-deploy-checks.ts,seed-admin.ts,gen-rbac-seed.ts,authz-report.ts}`, `.husky/*`, `.lintstagedrc.mjs`, `.github/workflows/ci.yml`, `docker-compose.yml` (porta **5436**, DB `houseart`/`houseart_test`), `prisma.config.ts`, `next.config.ts` (sem os redirects da HB), `postcss.config.mjs`, `tsconfig.json`, `eslint.config.mjs` (sem as regras do valuation), `vercel.json` (crons de I.4), `.vercelignore`, `.nvmrc` | idem | porta de dev **3008** (`next dev -p ${PORT:-3008}`; 3007 é a HB) |
| `components/ds/{Ico,Botao}.tsx`, `components/ui/{CampoMoeda,CampoNumero,HubCard,Interruptor,OlhoSenha,useConfirm}.tsx`, `components/comum/superficies.tsx`, `components/layout/{ClickableRow,dense-table,PlaceholderPage}`, `components/wizard/StepsBar.tsx`, `components/client-app/toast.tsx`, `public/ds/icons/*` | `components/ds/{Icon,Button}.tsx`, `components/ui/{MoneyField,NumberField,HubCard,Switch,PasswordEye,useConfirm}.tsx`, `components/common/surfaces.tsx`, … | ver G para o que o design substitui |
| `lib/email/{client,disparador,layout,marcacao,undeliverable,modelos-server}.ts`, `app/backoffice/email/*`, `app/api/admin/email/*`, `components/admin/{EditorModeloEmail,ModelosEmailClient}.tsx` | `lib/email/{client,dispatcher,layout,markup,undeliverable,templates-server}.ts`, `app/backoffice/email/*`, … | modelos (`templates.ts`) reescritos — D.21 |
| `lib/notifications/{core,server,push-server,bell-core}.ts`, `app/api/notifications/*`, `public/sw.js` | idem | catálogo reescrito — D.20 |
| `lib/pwa/{install-core,assetlinks-core}.ts`, `app/manifest*.webmanifest/route.ts`, `app/.well-known/assetlinks.json`, `components/pwa/*`, `mobile/android/*` | idem | pacotes `br.com.houseart.collector`, `br.com.houseart.studio` |
| `lib/integrations/{catalog,server,house-admin-core}.ts`, `components/integrations/IntegrationsHub.tsx`, `app/configuracoes/page.tsx` | `lib/integrations/*`, `app/settings/page.tsx` | sem `google-ads`, sem `assertiva` |
| `lib/profile/{core,server}.ts`, `components/profile/ProfileForm.tsx`, `app/configuracoes/perfil` | `lib/profile/`, `app/settings/profile` | sem CRECI/comissão/meta |
| `lib/market-indicators/{core,server,sources}.ts`, `components/layout/MarketIndicatorsStrip.tsx`, `app/api/market-indicators` | idem | séries — D.25 |
| `lib/toolgw/{assinatura,gate-server}.ts`, `app/api/tools/[tool]/route.ts` | `lib/toolgw/{signature,gate-server}.ts`, idem | tools — D.24 |

## D. ADAPTAR — origem, destino, lista objetiva de alterações

### D.1 Obra (`lib/imoveis/` → `lib/artworks/`)
Origem: `lib/imoveis/{server,cadastro-server,maquina-estados,photo-intake-core,proprietarios,proprietarios-server,dominio,publico,vitrine*,anuncio,slug,documentos,completude*}.ts`, `components/imoveis/{WizardImovel,wizard-estado,Passo*,GaleriaFotos,DocumentosImovel,FichaAcoes,TabelaImoveisVenda,preparePhoto}`, `app/imoveis/*`, `app/api/imoveis/*`.
1. Model `Imovel` → `Artwork`: sai endereço/geo/condomínio/entorno/matrícula/cartório/inscrição/face/finalidade/valorAnuncio Decimal; entra ficha técnica (título, artista, ano, técnica, materiais, dimensões (altura/largura/profundidade mm), edição/tiragem, assinatura, moldura, categoria: pintura/escultura/papel/fotografia/digital/outro, condition report, histórico de exposições e publicações). Preço em `listPriceCents BigInt`. **Campos exatos das telas.**
2. `maquina-estados.ts` → `state-machine.ts`: `DRAFT → PENDING_AUTHENTICATION → AUTHENTICATED → LISTED → IN_DEAL → SOLD`, + `ARCHIVED`, + `STOLEN`/`DISPUTED` (status de proveniência vindo do brief). Guarda de LISTED = selo "Obra Autenticada" verde (análogo a `exigeSeloVerde`).
3. `proprietarios*.ts` → `owners*.ts`: `ArtworkOwner` com `documentHash/Enc`, `shareBps` (soma 10000), sem estado civil/regime/cônjuge. Owner ≠ titular do certificado: o titular vem de `ownership`.
4. `photo-intake-core.ts`: manter validação por bytes; **mudar a régua**: a foto de registro (fingerprint) sobe INTEIRA ao cofre privado (`savePrivateFile`, kind `artwork-master`), e `preparePhoto` gera só a derivada pública (≤ 2048 px). Limite por arquivo passa de 4 MB para o que o design e a Vercel permitirem (upload direto ao Blob por token, como `app/api/crm/conversas/[id]/attachments/token`).
5. Wizard: passos pelo design (ficha → mídia → proveniência → proprietário → preço). `PassoEndereco`, `PassoCondominio`, `PassoEntorno`, `MapaEndereco` saem.
6. `publico*.ts`/`vitrine*.ts` → `lib/marketplace/public*.ts`: allowlist pública da obra (sem endereço do artista, sem titular em claro, sem documentos).
7. `TIPOS_IMOVEL` → `ARTWORK_CATEGORIES`; `FINALIDADES` saem; `SELOS` → `AUTHENTICATION_SEALS`.
8. `PRIVATE_FILE_KINDS` = `artwork-master`, `artwork-doc`, `certificate-pdf`, `appraisal-pdf`, `contract`, `signed-contract`, `kyc-doc`.
9. Rotas `app/api/imoveis/[id]/{documentos,proprietarios,fotos,transicao,anunciar}` → `app/api/artworks/[id]/{documents,owners,media,transition,list}`; `upload-foto` → `upload-media`.

### D.2 Perfis e permissões (`lib/auth/perfis.ts`, `lib/authz/permissions.ts`, `roles-seed.ts`)
1. Perfis built-in: `admin`, `manager` (gestor), `operator` (mesa de autenticação/avaliação), `finance`, `member` (artista, consultor — equivalente a `corretor`, escopado), `gallery_admin` (papel de tenant PJ), `appraiser` (avaliador credenciado), `collector` (externo, = `cliente`), `institution` (externo, API). Saem `engenheiro`, `almoxarife`, `fiscal`, `incorporador`.
2. Permissões: reescrever `PERMISSIONS` — manter `panel:access`, `scope:total`, `users:*`, `roles:*`, `tenant*:*`, `platform:administer`, `settings:administer`, `channels:administer`, `campaigns:publish`, `finance:*`, `contracts:*`; trocar `credit:*`→ nada, `dd_desk:operate`→`authentication_desk:operate`, `brokers:approve`→`members:approve`, `valuation:promote`→`appraisal:sign`, `developments:manage`→ nada, `reservations:release_any`→ nada; novas: `certificates:issue`, `certificates:revoke`, `markers:provision`, `ownership:transfer_offplatform`, `provenance:flag_stolen`, `royalty:administer`, `marketplace:feature`.
3. `BUILT_IN_ROLES` recalculados; `equivalence.test.ts` reescrito contra as listas novas (não há legado para espelhar — a regra legada E o kernel nascem juntos; pode-se nascer já em `FLAG_RBAC=1`).
4. `AREAS`/`REGRAS_DE_HREF` do AppShell pelo design (G).

### D.3 Tenant e escopo (`lib/tenant/`, `lib/escopo/`)
1. `Tenant.tipo` PF/PJ fica (PF = artista ou consultor autônomo; PJ = galeria). `TipoTenant` enum fica (ADR-010).
2. `Corretor` → `Member` (perfil comercial do usuário: `kind` ARTIST/GALLERY_STAFF/ADVISOR, `galleryId`, `tenantId`, `slug`, `statusPortal`). `Imobiliaria` NÃO existe: a galeria É o `Tenant` PJ (+ `GalleryProfile` com os dados públicos). `garantirTenantDoCorretor` → `ensureMemberTenant`.
3. `MODELOS_QUENTES` = `Artwork`, `Offer`, `Deal`, `Contact`, `Opportunity`, `Order`, `Member`, `User`, `Tenant`, `Certificate`, `Appraisal`. `CHAVES_DE_DONO` = `tenantId, memberId, id, userId, ownerUserId, offerId, dealId, artworkId`.
4. Triggers: `ha_tenant_from_member_id` (Artwork, Offer, Deal, Appraisal), `ha_tenant_from_owner_id` (Contact, Opportunity), `ha_tenant_from_offer_id` (Order). `hb_tenant_corretor_por_imobiliaria` sai (não há Imobiliaria). `ha_tenant_user_from_member` fica.
5. `imoveisAlcancaveis` → `reachableArtworks`; `alcanca*` renomeados.
6. `FLAG_ESCOPO_TENANT` → `FLAG_TENANT_SCOPE` — **nasce ligada** (não há legado sem tenantId).

### D.4 Cadastro de membro e de colecionador (`lib/corretor/signup-*`, `lib/client-account/`)
1. `signup-core.ts`: `ATUACOES` → `MEMBER_KINDS` (ARTIST, GALLERY, ADVISOR); `BROKER_DOCUMENT_KINDS` → documentos pelo design (ex.: documento civil com foto, selfie, comprovante de endereço, para galeria o CNPJ/contrato social). Sem CRECI.
2. `signup-criar.ts`: `criarCorretorVerificado` → `createVerifiedMember` (Member + Tenant + User inativo); aprovação manual pela equipe (`members:approve`) até o KYC automático (E).
3. `client-account/` → `collector-account/`: idem, perfil `collector`; `clientVerifiedAt` → `collectorVerifiedAt`.
4. `account-notice/`: textos.

### D.5 Termo de consignação (`lib/autorizacao/` → `lib/consignment/`)
1. `AutorizacaoVenda` → `ConsignmentAgreement`: `artworkId`, `galleryTenantId`, `artistOwnerId`, `token`, `status`, `commissionBps`, `minimumPriceCents` (sigiloso), `exclusive`, `validityDays`, aceite (IP, UA, `termsText`, `termsHash`, `termsVersion`), `lgpd*`. Índice parcial "uma ACEITA por obra+dono" (`ConsignmentAgreement_artwork_owner_accepted_key`, só na migration).
2. `termo.ts` → `terms.ts`: texto do termo de consignação (jurídico, placeholder de engenharia — trava igual à dos termos do HouseCrédito).
3. Fluxo: a galeria pede, o artista aceita por link (`/e/consignment/[token]` ou rota do design) ou no ato (`SELF_REGISTRATION`); publicar obra consignada exige ACEITA vigente (`FLAG_CONSIGNMENT_REQUIRED`).
4. Artista vendendo a própria obra não precisa de termo (é o dono).

### D.6 Selo "Obra Autenticada" (`lib/imoveis/seal-core.ts` → `lib/artworks/seal-core.ts`)
1. `SEAL_CHECKLIST_TYPES` = `{ PHYSICAL_MARKER_LINKED, CERTIFICATE_ISSUED, OWNER_VERIFIED }` (brief). `computeSeal` com os três itens; verde = os três; `sealRequiredToList`.
2. `OWNER_DOC_TYPES`, `SALE_TERM_DOC_TYPE`, `LGPD_REASONS` reescritos (termo de consignação quando há galeria).
3. `SealTab` → `components/seal/SealTab.tsx` com o card "O que o certificado diz" (substitui `RegistryCard`).

### D.7 Motor de verificações de proveniência (`lib/certidoes/` → `lib/provenance-checks/`)
1. Fica intacto (renomeado): `motor/{motor,politica,reemissao,idempotencia}`, `provedor/{index,tipos,fake}`, `upload-server`, `consentimento*`, `dossie-db` (→ `dossier-db`), `validacao`, `extracao`, `marcadores`, `redacao`, `defaults`, `fila-mesa`, `lib/dd-desk-queue/`, `lib/assisted-issuance/`.
2. `TIPOS_CERTIDAO` → `CHECK_TYPES`: `ART_LOSS_REGISTER`, `SANCTIONS_PEP` (PLD), `SELLER_CIVIL_CERTIFICATE`, `SELLER_FEDERAL_CERTIFICATE`, `IPHAN_EXPORT_RESTRICTION`, `INTERPOL_STOLEN_ART`, `PRIOR_CERTIFICATE_REVIEW`. Provedores reais: nenhum no MVP (ALR é consulta manual £85; `PORTAL_TITULAR` → `MANUAL`).
3. `PAPEIS_PARTE` → `PARTY_ROLES` = SELLER, BUYER, ARTIST, HEIR, REPRESENTATIVE.
4. `exigeConsultaCensec` e CENSEC/CNIB saem; `lib/parties/marital` sai.
5. `DossieDiligencia` → `ProvenanceDossier` (`artworkId`, `monthlyCapCents`).
6. Infosimples/DirectData saem com as envs; `CERTIDOES_PROVEDOR` → `PROVENANCE_PROVIDER` (`fake|none`).

### D.8 Dossiê de proveniência e verificação pública (`lib/dd-report/`, `lib/dd-steps/`, `app/v`)
1. `FRONTS` → (1) Identidade da obra e marcador, (2) Cadeia de titularidade, (3) Verificações de bases (roubo/sanções), (4) Certidões do vendedor, (5) Situação legal (IPHAN, contestações). `CHECK_RESULTS`, `VERDICTS`, `suggestedVerdict` ficam.
2. `VERIFICATION_PREFIX='HB-'` → `'HA-'`; `code` `DD-AAAA-NNNN` → `PR-AAAA-NNNN`. PDF determinístico, hash, índice "um DRAFT por obra".
3. `/v` → `/verify`: ordem de checagem `checkCertificatePublic` (NOVO, lib/certificates) → `checkProvenanceReportPublic` → `checkAppraisalPublic`. A página do marcador NFC (`/a/[publicId]`, E) é outra porta.
4. `dd-steps` → `provenance-steps`: 4 passos pelo design.

### D.9 Leitura de documentos por IA (`lib/registry-reading/` → `lib/document-reading/`)
1. Pipeline igual: `startAiReading`/`runAiReading` (reserva READING → chamada paga → PENDING_REVIEW → CONFIRMED), `scheduleReading` no upload, tetos (3/obra/dia, 200/dia), `MAX_PDF_PAGES=40`, sha256 nunca relê, `stripHashes` no `toView`.
2. `claude.ts`: tool `document_extraction` com schema para **certificado anterior / nota fiscal de galeria / catálogo**: título, artista, ano, técnica, dimensões, edição, emitente, data, titular anterior (nome + documento → hash), número de certificado, assinaturas. `MAX_TOKENS=8000`, modelo `claude-sonnet-5` por env `DOCUMENT_READING_MODEL`.
3. `compare-owners.ts` → `compare-artwork.ts`: compara ficha cadastrada × documento lido (título, dimensões ±2 %, artista por `nameScore ≥ 900`).
4. `SOURCE_DOCUMENT_TYPE` → lista: `PRIOR_CERTIFICATE`, `GALLERY_INVOICE`, `CATALOG_PAGE`, `CONDITION_REPORT`.
5. Flags `FLAG_DD_REPORT`→`FLAG_PROVENANCE_REPORT`, `FLAG_SEAL_REGISTRY_READING`→`FLAG_DOCUMENT_READING`, `REGISTRY_READING_MODE`→`DOCUMENT_READING_MODE`.

### D.10 Ofertas e mandato (`lib/ofertas/` → `lib/offers/`)
1. `MandatoVenda` → `Mandate`: fica `listPriceCents`, `reservePriceCents` (piso, NUNCA sai do backend), `targetPriceCents`, `minVisiblePct`, `negotiatorAutonomy`, `maxAutonomousDiscountBps`, `version`; saem `prazoDesocupacaoDias`, `mobiliaIncluida`, `quemPagaItbi`, `quemPagaEscritura`, `aceitaPermuta`, `aceitaFinanciamento`, `aceitaConsorcio`; entra `fixedPrice Boolean` (modalidade preço fixo), `acceptsTrade`, `shippingIncluded`.
2. `Proposta` → `Offer`: saem `valorEntrada`, `saldoComoSeraPago` (lib/ofertas/pagamento.ts descartado), `usaFGTS`, `financiarCustosITBIRegistro`, `preQ*`, `rendaMensalBruta`, `prazoDesocupacaoDesejadoDias`, `quemPagaItbiProposto`; ficam `code` (`OFR-AAAA-NNNNNN`), `documentEnc/Hash/Mask`, `offeredCents`, `acceptedCents`, status, OTP, `retractionTokenHash` (art. 427 CC, 24 h), `riskAdjustedCents`/`closeProbability` (sigilosos), `origin`.
3. `estado.ts` → `state.ts`: máquina igual; `EM_DUE_DILIGENCE` → `IN_PROVENANCE_CHECK`.
4. `aceite-core.ts`/`negocio-vivo-server.ts`: `negocioPrendeImovel` → `dealLocksArtwork`, `travarImovel` → `lockArtwork` (advisory lock por obra).
5. `mandato-motor.ts`, `alcada.ts`, `var.ts`, `retratacao-*`, `resumo-abaixo-do-minimo`: intactos (renomeados). Anti-leilão: sem lances/ranking/contador públicos; linguagem "proposta/proponente/contraproposta" (regra inegociável herdada).
6. `lib/negociacao/faixa.ts` (comparáveis por bairro) → `lib/offers/range.ts` com comparáveis por artista/técnica — depende de `lib/appraisal`.
7. `comissao.ts`: `COMISSAO_PADRAO_PCT` → `MARKETPLACE_FEE_BPS` primário 1200, secundário comprador 800 + vendedor 400 (brief).
8. Rotas: `app/api/propostas` → `app/api/offers`; `app/api/publico/propostas` → `app/api/public/offers`; `app/e/imovel/[id]/proposta` → página pública da obra `/offer`.
9. `buildOffer` (lib/client-app/buyer-core) → `lib/collector-app/buyer-core.ts`.

### D.11 Transação (`lib/esteira/` + `lib/negocio/` → `lib/transaction/` + `lib/deal/`)
1. `FASES_TRANSACAO` → `DEAL_PHASES`: `OFFER` → `AGREEMENT` (cessão assinada) → `PROVENANCE_CHECK` → `PAYMENT_ESCROW` → `LOGISTICS` (embalagem, frete, seguro de trânsito) → `DELIVERY` (aceite na entrega, tap da tag) → `TRANSFER` (certificado transferido, split liberado) → `COMPLETED`. `TRILHAS` → `TRACKS`: DOCUMENTAL, FINANCIAL, LOGISTICS, COMMERCIAL.
2. `templates.ts`: `TEMPLATES_SEED` reescrito com as tarefas-gate (peso 8): cessão assinada, KYC do comprador, verificações concluídas, escrow liquidado, frete contratado, seguro apólice, entrega confirmada por tap, certificado emitido.
3. `protocolo.ts` (prenotação) sai; `dd-sync.ts` → `provenance-sync.ts`.
4. `policies.ts`/`portal*.ts`: portal das partes com OTP fica; `MATRIZ_PORTAL` por papel SELLER/BUYER/ARTIST/GALLERY/SHIPPER.
5. `avancarAutomaticamente`, `avancarFase` (CAS), `definirExcecao`, `relatorio*` ficam.
6. `lib/negocio/`: `dominio.ts` `ETAPAS_TIMELINE` reescritas; `glossario.ts` (termos de arte: proveniência, condition report, direito de sequência, escrow); `copiloto*` com prompts novos; `automacao*` (eventos `DOCUMENT_PARTY`, `SIGNATURE_DONE`, `ESCROW_PAID`, `DELIVERY_CONFIRMED`); `whatsapp-inbound.ts` fica.
7. `lib/sales/stages.ts`: vocabulário único = as fases acima. `lib/compra/` → `lib/purchase/` (jornada do comprador pós-aceite, checklist: KYC, endereço de entrega, seguro).
8. `Transacao` → `Deal`: `artworkId`, `offerId`, `memberId`, `tenantId`, `phase`, `exceptionStatus`, `amountCents`, `progress*`.
9. Jobs: `esteira` → `deals`, `automacao-negocios` → `deal-automation`, `resumo-negocios` → `deal-digest`; `monitor-vendas` → `offers-monitor`.

### D.12 Contratos (`lib/contratos/`, `lib/assinaturas/`)
1. PORTAR: `data/{server,seal,present,signers}.ts` (cofre `⟦doc:N⟧`), `protecao.ts`, `extenso.ts`, `numero.ts`, `active-contract.ts`, `contract-lifecycle-server.ts`, `contract-list.ts`, `signature-block.ts`, `lib/contract-templates/*`, `lib/assinaturas/*` (OTP, `turn-server`, `ordem-core`, `certificadoPdf`, `validacao*`, `fluxo`, `link-server`, `resend-invite`, `eventos`, `token`).
2. DESCARTAR: `promessa.ts`, `promessa-server.ts`, `variaveisRegistry.ts` (empreendimento/unidade), `modelosPadrao.ts`, `sale-template.ts`, `deals-awaiting-contract-server.ts`.
3. NOVO dentro do módulo: `assignment.ts` + `assignment-server.ts` (minuta de **cessão de titularidade** a partir de Offer/Deal/Artwork/Certificate: partes, obra, preço (ou preço selado — só hash), condições de entrega, direito de sequência calculado, foro) e `consignment-contract.ts` (termo de consignação). `VARIAVEIS_DISPONIVEIS` = `seller.*`, `buyer.*`, `artist.*`, `artwork.*`, `certificate.*`, `deal.*`.
4. `ModeloContrato.segmento` LANCAMENTO/USADOS → `ContractTemplate.kind` ASSIGNMENT/CONSIGNMENT/LOAN; `isGlobal` + `tenantId` ficam.
5. `Assinatura.papel` → SELLER, BUYER, ARTIST, GALLERY, WITNESS; `fluxo.ts`/`email.ts` perdem o ramo "gestores da incorporadora".
6. Acima do valor de corte (`QUALIFIED_SIGNATURE_THRESHOLD_CENTS`, sugestão R$ 100 mil) exigir assinatura qualificada ICP-Brasil/e-Notariado — provedor em `lib/signatures/provider.ts` (hoje `nativeProvider`; ICP é NOVO/J).

### D.13 Laudo de Opinião de Valor (`lib/valuation/opinion/` → `lib/appraisal/`)
1. PORTAR: `engine.ts` (base × Σ ajustes bps com min/max, bloqueadores, arredondamento), `factors.ts` (`factorTableFrom`, `validateFactorRows`), `params.ts` (`FACTORS_VERSION`, `ENGINE_VERSION`), `service.ts` (port `DepsOpinion`, versões imutáveis `rootId/version/supersededById`, CAS no status), `pdf.ts` + `document-kit/pdf-kit.ts`, `verification.ts` (`HA-`), `present.ts`.
2. `domain.ts`: `SINGLE_QUESTIONS`/`MULTI_QUESTIONS`/`OPTIONS` reescritos pelo design (técnica, dimensão, estado de conservação, assinatura, moldura, exposição institucional, publicação, edição, data, proveniência documentada); `PURPOSES` = SALE_PRICE, INSURANCE, INVENTORY, ESTATE_DIVISION, COLLATERAL; `LIQUIDITY_QUESTIONS` por artista (mercado primário ativo, leilão nos últimos 5 anos).
3. Base: `referenceAverageM2Cents` → `referenceBaseCents` = preço de tabela do artista por cm² e técnica OU comparáveis (vendas primárias registradas na plataforma, catálogos de leilão informados à mão); `areaM2` → `areaCm2`. Sem AVM.
4. `signerRoleOf`: "Corretor de imóveis · CRECI/CNAI" → avaliador credenciado (`Appraisal.appraiserId`, `appraiserCredential`); estimativa automática grátis vs laudo assinado pago (`Order` CATALOG `APPRAISAL_SIGNED`).
5. `ValuationOpinion` → `Appraisal` (ids `Int` — o valuation da HB usava cuid; o HouseArt nasce em Int), `ValuationOpinionFactor` → `AppraisalFactor`; os 3 índices parciais e o CHECK de status viram migration nova.
6. Descartar `legacy.ts` (fromRov/fromSimulacao), `copy.ts` reescrito.
7. `lib/valor/` → `lib/appraisal/http.ts` (gate, cobrança por `Order`).

### D.14 Billing (`lib/billing/`)
1. PORTAR intactos: `provedores/{tipos,index,stripe-live,stripe-mock,stripe-core}`, `webhooks/*`, `assinaturas/*` (checkout, dunning 5/15 dias, portal, assentos), `servicos/*` (checkout de pedido, meio a meio, estorno, disputa), `razao/{contas,razao-core,razao-server,ganchos-server}`, `fiscal/*` (IRRF/INSS/ISS, fila manual), `connect/*` (Express BR, PF individual/PJ company), `contas/*`, `mock/*`, `admin/rotina-server`.
2. `dominio.ts`: `TIPOS_CONTA_BILLING` = MEMBER, GALLERY, COLLECTOR, GUEST_COLLECTOR, PLATFORM, ROYALTY_FUND (fundo de direito de sequência a repassar), `chaveConta*` idem; `CONFIG_BILLING` com take por plano (brief: 12 % primário; 8 %+4 % secundário); `ORIGENS_NEGOCIO` sai (toda venda é da plataforma ou off-platform com taxa fixa); `BILLING_TRILHO_CORRETAGEM` sai (só Stripe).
3. `split/split-core.ts`: partes = PLATFORM_FEE, GALLERY, ARTIST_PRIMARY, ARTIST_ROYALTY (5 % × max(0, Δ preço), só no secundário), ADVISOR, SHIPPING, INSURANCE; invariante soma = bruta fica. `aplicarTetoAnual` sai.
4. `corretagem/*` → `commission/*` (ver D.17): `emitirCorretagemStripe` → `createEscrowPaymentIntent` (PaymentIntent boleto/Pix/cartão, captura manual = escrow), `distribuirCorretagem` → `releaseSplit` (transfers do Connect após `TRANSFER` do Deal).
5. `origem/*` sai. `catalogo.ts`: planos ver D.16, serviços ver D.15.
6. Escrow: `FLAG_BILLING` nasce ligada (não há caminho legado sem Stripe); `STRIPE_AMBIENTE`/`stripeSimuladoProibido` ficam.

### D.15 Pedidos e catálogo (`lib/pedidos/` → `lib/orders/`)
1. `CODIGOS_SERVICO` → `SERVICE_CODES`: `CERTIFICATION` (tag + certificado, R$ 149 / R$ 99 em lote), `RECERTIFICATION` (R$ 49), `OFFPLATFORM_TRANSFER` (R$ 199), `APPRAISAL_SIGNED` (R$ 390–1.490 por faixa), `APPRAISAL_FORENSIC` (sob orçamento), `PROVENANCE_CHECK` (R$ 290), `SHIPPING`, `TRANSIT_INSURANCE`, `COLLECTION_INSURANCE`, `EXPORT_ASSIST` (R$ 890), `MARKETPLACE_FEATURE` (R$ 99/semana), `PLAN_SUBSCRIPTION`, `PARTNER_SERVICE` (molduraria etc., 10 %). Preços no catálogo seedado pela migration, editáveis em `/orders/catalog`.
2. `TIPOS_PAGADOR` → BUYER, SELLER, ARTIST, GALLERY, REQUESTER, OTHER; `METODOS_PEDIDO` → só Stripe (CARD, PIX, BOLETO); `provedorCobranca` default STRIPE.
3. Vínculos do `Pedido` → `Order`: `memberId`, `artworkId`, `offerId`, `dealId`, `appraisalId`, `certificateId`, `contractId`, `shipmentId`.
4. `ganchos.ts`: `pedirServico` acionado por certificação, laudo, DD de proveniência, frete/seguro no checkout.
5. `lib/pedidos/emissao.ts` (BTG) sai; `baixa.ts` só pelo webhook Stripe (`aoPagarPedido`).

### D.16 Planos (`lib/planos/` → `lib/plans/`)
1. `CODIGOS_PLANO` → `ARTIST_FREE` (até 10 obras), `ARTIST_STUDIO` (R$ 49/mês), `GALLERY` (R$ 349/mês, 3 usuários), `GALLERY_PRO` (R$ 899/mês, multiusuário, API, relatórios), `ADVISOR` (R$ 149/mês). `PLANOS_SO_BILLING` → GALLERY e GALLERY_PRO (por tenant).
2. `CHAVES_USO` → `ARTWORKS` (teto de obras cadastradas), `CERTIFICATIONS_BATCH` (desconto em lote), `USERS` (assentos), `APPRAISAL_AUTO`, `FEATURED_WEEKS`.
3. `uso-server.ts`: `gateDeAnuncio` → `artworkRegistrationGate` (lê `prisma.artwork`).
4. `take-server.ts`: `takeRateDoCorretor` → `feeRateForMember` (take do marketplace por plano).
5. Mensalidade via Stripe subscription (`lib/billing/assinaturas`), não via `Pedido` AUTOMATICO + BTG: `mensalidade-server.ts` e `regua-server.ts` ficam só para o fallback sem Stripe — avaliar remoção (J).

### D.17 Comissão (`lib/corretagem/` + `lib/parcerias/` → `lib/commission/`)
1. PORTAR: `corretagem-core.ts` (`calcularCorretagem`, `partesDoRateio`, `conferirInvariantes`), `decidir-modo.ts`, `baixa-core.ts` (`decidirLiquidacao`, `destinoDaParte`, `decidirEstorno`), `emissao-core.ts`, `emissao-estado.ts`, `perfil-core.ts`, `perfil-server.ts`, `codigo.ts` (`COM-AAAA-NNNNNN`), `dominio.ts` (`STATUS_CORRETAGEM` PREVISTA→CONGELADA→COBRADA→PAGA→LIQUIDADA), `lib/parcerias/split.ts` (`calcularCascata`, `porBps`), `lib/parcerias/timeline.ts` (cadeia de hash).
2. `server.ts`: `nascerCorretagem` nasce no **aceite da oferta** (`Offer` ACCEPTED), não na promessa assinada; `aoNascerTransacao` → `onDealCreated`. `emissao.ts`: `TAREFA_PROMESSA` → gate `AGREEMENT_SIGNED`; vencimento = escrow.
3. Papéis: `PAPEIS_CORRETAGEM` → PLATFORM, GALLERY, ARTIST, ARTIST_ROYALTY, ADVISOR, SHIPPER, INSURER. `MAPA_PAPEL_PARCERIA` sai.
4. `pagador.ts`: pagador = BUYER da oferta (fica).
5. `vinculo.ts`, `eventos-banco.ts` (BTG split) saem. `PerfilCobrancaCorretor` → `PayoutProfile` (PF/PJ, regime, CNPJ cifrado, Pix mascarado; `btgSplitterId` sai, entra `stripeAccountId` via Connect).
6. `Partnership` e os 16 models irmãos NÃO vão. "Parcerias de representação" galeria↔artista = `ConsignmentAgreement` (D.5).

### D.18 CRM (`lib/crm/`)
1. `Contato` → `Contact` com `collectorProfileJson` (técnicas, artistas, faixa de preço, cidades) e `origin`; `Oportunidade` → `Opportunity` com `artworkId`, `offerId`, `visitId`; funil padrão (`seed.ts`) reescrito (Interesse → Visita/Viewing room → Proposta → Fechamento).
2. `originacao*.ts`: dedupe por telefone/CPF por tenant fica; sinais de origem (Instagram, marketplace, indicação).
3. `client-record-*`: abas Visão geral · Negócios · Atividade · Conversas · Propostas · Coleção (obras que possui) · Sobre.
4. `ia.ts`/`score-core.ts`: prompt do score de lead para arte; `canais.ts`, `rotulos.ts` textos.

### D.19 Agenda (`lib/agenda/` → `lib/schedule/`) — só se o design tiver
1. `Compromisso` → `Appointment` com `artworkId`, `dealId`, `memberId`; tipos VISIT_STUDIO, VISIT_GALLERY, VIEWING_ROOM, DELIVERY, APPRAISAL_INSPECTION.
2. `visit-recipient.ts`, `google-*`, `ics.ts`, `disponibilidade*`, `compartilhamento*` ficam.

### D.20 Notificações (`lib/notifications/catalog.ts`)
Audiências `member` e `collector`. Categorias: leads, visits, offers, deals, payments*, artworks (certificado emitido, marcador vinculado, obra listada), messages, account*, community, collector_offers, collector_deals, collector_certificates* (transferência recebida, nova versão), collector_messages. Eventos derivados das telas.

### D.21 E-mail (`lib/email/modelos.ts` → `templates.ts`)
`CHAVES_MODELO` reescritas: `MEMBER_CODE`, `MEMBER_APPROVED`, `MEMBER_DOCUMENTS_PENDING`, `COLLECTOR_CODE`, `PASSWORD_RECOVERY`, `ACCOUNT_EXISTS_NOTICE(_COLLECTOR)`, `CONSIGNMENT_REQUEST`, `CONSIGNMENT_ACCEPTED`, `CERTIFICATE_ISSUED`, `CERTIFICATE_TRANSFERRED`, `OFFER_CONFIRMED_BUYER`, `OFFER_RECEIVED_SELLER`, `OFFER_COUNTER`, `DEAL_PHASE_ADVANCED`, `ESCROW_PAID`, `SHIPMENT_BOOKED`, `DELIVERY_CONFIRMED`, `APPRAISAL_DELIVERED`, `PROVENANCE_REPORT_DELIVERED`, `ROYALTY_PAID`, `VISIT_*` (se agenda), `PARTY_PENDING_REMINDER`. Layout: logo HouseArt, cores do design. `CHAVES_SEM_CTA` = códigos OTP.

### D.22 Marketing (`lib/marketing/`, `lib/meta-account/`)
1. `anuncio-imovel.ts`/`campanha-imovel.ts`/`destino.ts` → `artwork-post.ts`/`artwork-campaign.ts`: card/carrossel da obra (imagem em fundo neutro, título, artista, técnica, dimensões, preço opcional), `montarCardImovelComIA` → `buildArtworkCardWithAI`.
2. `ai.ts`: prompts de campanha para arte; templates de peça pelo design.
3. Catálogo Meta para shopping (`ads_catalog_*`): NOVO dentro do módulo, fase 2.
4. `CampanhaMarketing.imovelId` → `artworkId`; `empreendimentoId` sai.

### D.23 Comunidade (`lib/community/`) — só se o design tiver
Post por obra/artista (`CommunityPost.artworkId`), perfis de artista/galeria/colecionador, convites de exposição (`CommunityEvent` NOVO), parceria por swipe → "pedido de representação" galeria→artista (gera `ConsignmentAgreement` em rascunho). Termos de parceria reescritos (versão v1 nova, hash ancorado em teste).

### D.24 Tool Gateway (`lib/toolgw/`)
Tools: `searchArtworks`, `artworkDetails`, `verifyCertificate(publicId|markerUid)`, `estimateValue`, `offerStatus`, `listMandates`, `evaluateOfferAgainstMandate`, `registerCounterOffer`, `provenanceAssistant(documentId)` (lê certificado antigo/nota e devolve resumo), `scheduleVisit`/`suggestSlots` (se agenda). Operador: `dealStatus`, `listDeals`, `dealChecklist`. Mesma assinatura v2 e `operator.phone`.

### D.25 Indicadores do cabeçalho (`lib/market-indicators/`)
Séries: `USD_BRL`, `EUR_BRL` (AwesomeAPI/PTAX, ficam), `ART_INDEX` (índice próprio calculado das vendas da plataforma — NOVO em `lib/art-price-index/`, fase 2; até lá a faixa mostra só câmbio). IPCA/INCC saem.

### D.26 Marketplace público (`app/e/*` → conforme design)
1. Home, vitrine (filtros por artista, técnica, faixa de preço, tamanho, categoria; ordenação), página pública da obra (galeria de imagens em alta, ficha, selo, "Fazer proposta"/"Comprar" a preço fixo, estado de proveniência), viewing room (NOVO), página do artista e da galeria (NOVO). `HeaderPortal`/`FooterPortal`/`FiltrosPortal`/`OrdenarPortal`/`CardImovelPortal`/`GaleriaPortal`/`PdpPortal`/`PropostaPortal`/`RetratarProposta`/`RegistrarVisita` → equivalentes `*Portal` de arte; `SimuladorPortal`, `AgendarPortal` (se agenda), `AnunciarPortal` (D.51), `AssistedCertificateUpload` conforme design.
2. Dois mercados: `Artwork.market` PRIMARY (artista/galeria) | SECONDARY (colecionador com certificado vigente); regras de comissão distintas; só obra `AUTHENTICATED` com selo verde é listada.
3. `ListingView` → `ArtworkView` (contagem por `POST /api/public/artwork-view`, hash de IP+UA, `VIEW_HASH_SECRET`).
4. `TemaClaroFixo`, `portal.css` (paleta `hb/paper/ink`) substituídos pelos tokens do design (G).

### D.27 Dashboard (`lib/dashboard/`)
KPIs: volume vendido (mês/ano), comissão em aberto/paga, obras em carteira por status do selo, certificações emitidas, laudos, metas por membro, ranking por galeria/consultor, "Precisa de você agora" (ofertas sem resposta, cessões pendentes de assinatura, entregas sem confirmação).

### D.28 Perfil, integrações, configurações
`ProfileView.broker` → `member` (kind, gallery, plan); `INTEGRATIONS` pessoais = whatsapp-evolution, whatsapp-business, google-calendar (se agenda), meta-account; globais = whatsapp-system, instagram-house, meta-ads-house; `HOUSE_ADMIN_ITEMS` = email, automation, portal, community (se houver), access, catalog, plans.

## E. NOVO — especificação por módulo (cada item aponta para a tela que o define)

Referência de telas: `houseart-design/screens.html` (extraído do bundle; `data-screen-label`) e os
dados em `houseart-design/app-source.tsx`. Telas citadas pelo design mas **ausentes do pacote
enviado** (`HouseArt Obra.dc.html`, `HouseArt Verificacao.dc.html`, `HouseArt Site.dc.html`,
`HouseArt Web Galeria.dc.html`, `HouseArt Web Colecionador.dc.html`, `HouseArt App Artista.dc.html`,
`HouseArt Design System.dc.html`) estão em J; onde uma delas define a tela, o módulo nasce com a
API e uma página mínima no mesmo DS, a ser trocada quando o arquivo chegar.

### E.1 `lib/profiles/` — escolha e troca de perfil
Telas: **Escolha de perfil** (6 cartões: Artista, Galeria, Colecionador, Prestador · avaliador, Consultor de arte, Equipe HouseArt), menu do avatar (`trocarPerfil`).
- `UserProfile` por usuário; `activeProfile` guardado na sessão (`Session.activeProfileKind`); `NAV` por perfil (`lib/profiles/nav.ts`, tabela igual a `NAV` do design, com badges calculados: cert = obras aguardando ação, vendas = ofertas abertas, compras = negócios em andamento, laudos = fila, admin = itens abertos).
- Rotas: `GET/POST /api/profiles` (listar/trocar), página `/profiles`.
- Regra: admin (`STAFF`) só por convite; `APPRAISER` só aprovado pela equipe; `ADVISOR` usa a casca de galeria (`NAV.galeria`) com `tenant` PF.

### E.2 `lib/artworks/` — cadastro em 6 passos (ADAPTAR + NOVO)
Tela: **Cadastro de obra** (`PASSOS` = Ficha técnica · Mídia · Condition report · Histórico · Preço e disponibilidade · Revisão; "Salvo automaticamente").
- Passo 1 campos (`campos`): Título, Ano, Técnica, Materiais, Altura/Largura/Profundidade (cm → mm no banco), Edição/tiragem, Assinatura, Série. Autosave `PATCH /api/artworks/[id]` a cada mudança (debounce 800 ms, como o wizard do HouseCrédito).
- Passo 2 mídia (`midias`): 6 slots fixos (frontal com cartão de cor, verso, 4 macros em regiões fixas), qualidade por slot (Boa/Desfocada/Pendente — `quality`), upload direto ao Blob privado por token (`POST /api/artworks/[id]/media/token`) + derivada pública gerada no servidor; **duplicidade** (`lib/duplicate-detection`) roda no upload da frontal e mostra o aviso "Encontramos uma obra parecida" com "São obras diferentes"/"É a mesma obra" (`DuplicateCheck.decision`).
- Passo 3 condition report (`regioes`): estado geral (Excelente/Bom/Regular/Precisa de restauro) + 5 regiões com nota e estado (Íntegra/Atenção); "Responsável · data".
- Passo 4 histórico (`historico`): Exposição/Publicação/Prêmio com descrição e AAAA-MM; "Adicionar".
- Passo 5 preço (`modalidades`): Preço fixo · Preço fixo e aceitar ofertas · Sob consulta; campo Preço; régua "R$ 17 mil — R$ 21 mil sugerido — R$ 26 mil · Estimativa de referência com base em N vendas comparáveis. Não é laudo." (`ArtworkPriceEstimate`, calculada por `lib/appraisal/estimate-core.ts` sobre vendas registradas do mesmo artista/técnica; sem comparáveis → sem régua).
- Passo 6 revisão (`revisao`) + "Enviar para certificação" → `Artwork.status = IN_CERTIFICATION`, `Certificate` criado com `stage 0/1`.
- Lista **Minhas obras/Inventário** (`filtros`: Todas, Autenticadas, Em certificação, À venda, Vendidas, Rascunhos com contagens; seleção múltipla com barra "N obras selecionadas · Solicitar etiquetas · Listar no marketplace").

### E.3 `lib/physical-markers/` — etiquetas NFC
Telas: **Certificação** (kit de etiquetas: quantidade, "Pedir etiquetas · R$ 150", "Chegam pelo correio em até 5 dias úteis"; régua de 5 pontos por obra: pedida · recebida · vinculada · assinada · emitida; ações: "Aguardar etiqueta" · "Vincular no app" · "Assinar" · "Emitir" · "Ver certificado"), **Admin · Etiquetas** (KPIs Em estoque / Vinculadas / Alertas de remoção; tabela de lotes com destino, vinculadas %, status Em uso/Esgotado/Novo emissor; busca por UID ou ID da obra; "Uma etiqueta removida invalida a leitura e abre alerta automático").
- `MarkerBatch` criado pela equipe (`POST /api/admin/markers/batches`); UIDs importados do fornecedor (CSV) com `keyRef` derivado (`MARKER_MASTER_KEY_REF`, diversificação por UID no servidor; chave nunca gravada).
- `MarkerOrder` do membro (`POST /api/markers/orders`, gera `Order` CATALOG `MARKER_KIT` R$ 15/un) → `stage 1`; envio marcado pela equipe → `stage 2`.
- Vinculação (`POST /api/markers/link`, chamada pelo app/celular com `uid`, `ctr`, `cmac`, `artworkId`): valida CMAC (`lib/physical-markers/sun-core.ts`, AES-128 CMAC conforme NTAG 424 DNA; modo `MARKER_VENDOR=mock` aceita CMAC de teste), replay por `counter`, grava `MarkerRead` e `PhysicalMarker.artworkId`, gera `Artwork.publicId` (`HA-AAAA-XXXX-XXXX`, Crockford) → `stage 3`.
- Leitura pública `GET /a/[publicId]?uid&ctr&cmac` → página de verificação (E.4); tamper (TT) → `status REMOVED` + `ReviewQueueItem MARKER_REMOVED`.
- Fallback QR: `/a/[publicId]` sem SUN mostra a obra com aviso "leitura não autenticada".

### E.4 `lib/certificates/` — certificado-escritura
Telas: **Certificação** (modal HouseSign "Assinar certificado": "Ao assinar, você declara ser a autora desta obra. O certificado recebe carimbo do tempo ICP-Brasil e não pode ser alterado…"; "Assinando…" → "Assinado · carimbo do tempo aplicado. Falta emitir." → "Emitir" → "Certificado emitido"), **Carteira de escrituras** (documento "Escritura da obra": ID, Obra, Artista, Titular com CPF mascarado, Desde, Apólice, "Carimbo do tempo ICP-Brasil · data", QR; ações Vender · Transferir · Segurar · Pedir laudo · Registrar restauro · Compartilhar certificado), página pública de verificação (`HouseArt Verificacao.dc.html`, ausente — J).
- Assinar (`POST /api/certificates/[id]/sign`): monta `contentJson` canônico (obra, artista, titular inicial, hashes das mídias, condition report), `contentHash` sha256, assinatura JWS do emissor (chave da plataforma; assinatura avançada do artista = OTP + registro, como `lib/signatures`), carimbo do tempo (`TIMESTAMP_AUTHORITY_URL`; modo `mock` grava token simulado) → `stage 4`.
- Emitir (`POST /api/certificates/[id]/issue`): `CertificateVersion 1` ACTIVE, `CertificateEvent CERTIFIED`, PDF A4 (`lib/certificates/pdf.ts` sobre o `document-kit`: cabeçalho HouseArt, ID, obra, artista, titular mascarado, QR para `/verify/[publicId]`, hash), `Artwork.status = AUTHENTICATED`, `seal = GREEN` → `stage 5`.
- Cadeia: todo evento tem `hash = sha256(prevHash + canonical(payload))`; `DailyAnchor` pelo cron `certificate-anchor` (`ANCHOR_NETWORK=none` no MVP só grava o merkle root).
- Verificação pública `GET /verify/[publicId]` e `GET /api/v1/certificates/[publicId]`: obra, artista, status (ativa/roubada/contestada), titular anonimizado ("Colecionador particular · desde 2026"), cadeia de eventos sem valores, hash da versão vigente.
- "Compartilhar certificado": link público. "Registrar restauro": `CertificateEvent RESTORED` + `ArtworkHistoryItem`.

### E.5 `lib/offers/` + `lib/deals/` (ADAPTAR, com telas)
Telas: **Vendas e ofertas** (aba Ofertas recebidas: obra, quem ("Colecionador verificado, Recife/PE", "Consultora Ana Paes, para cliente"), expira em, valor, "pedido R$ X · −7%", Recusar · Contrapropor · Aceitar; "Negociador automático: ligado · aceita ofertas a partir de 92% do preço pedido"; aba Em andamento: timeline de 6 etapas com % e "Repartição dos valores" + transporte/seguro), **Compras** (mesma timeline do lado do comprador + "A obra chegou? Abra o app e encoste o celular na etiqueta… Confirmar recebimento" → "Escritura emitida em seu nome").
- Aceite (`POST /api/offers/[id]/accept`): CAS no status, trava por obra, cria `Deal` fase OFFER_ACCEPTED, `DealSplit` calculado (`lib/commission/split-core.ts`: PLATFORM 12 % primário; GALLERY/ARTIST conforme `Consignment.commissionBps`; secundário 8 % comprador + 4 % vendedor + royalty), toast "Oferta aceita · o comprador tem 24 h para pagar em garantia".
- Negociador automático: `Mandate.autoNegotiatorOn` + `autoAcceptMinBps`; oferta ≥ mínimo é aceita sozinha (evento NEGOTIATOR), abaixo vai à tela. Piso nunca sai.
- Escrow (`lib/escrow/`): PaymentIntent Stripe com captura/transfer group (`STRIPE_ENV=mock` em dev); pago → fase ESCROW ("Pix confirmado · valor retido na HouseArt").
- Documentos (fase DOCUMENTS): cessão gerada por `lib/contracts/assignment.ts`, assinada pelas partes (`lib/signatures`).
- Logística (fase SHIPPING): `Shipment` + `InsurancePolicy` TRANSIT (provedor `mock` no MVP; carrier/tracking digitados pela galeria).
- Entrega (fase DELIVERY): `POST /api/deals/[id]/confirm-delivery` exige `MarkerRead` com `purpose DELIVERY_CONFIRM` válido do comprador (mock: botão "Confirmar recebimento" grava leitura simulada quando `MARKER_VENDOR=mock`).
- Transferência (fase TRANSFER → COMPLETED): `OwnershipTransfer` com `dealId`, nova `CertificateVersion`, `DealSplit RELEASED`, `RoyaltyPayment` quando secundário.

### E.6 `lib/ownership/` — transferência fora da plataforma
Tela: **Transferência fora da plataforma** (passos Comprador → Valor → Assinaturas → Toque do comprador; CPF do comprador + e-mail/celular; "O comprador recebe um convite para confirmar a identidade (CPF e biometria)"; valor da venda; toggle "Preço selado"; "Direito de sequência: R$ 275 (5% da valorização de R$ 5.500) será repassado a Rafael Moura"; assinaturas Você · vendedor / Compradora; "Falta o toque da compradora"; "Taxa de transferência R$ 199"; "Pagar R$ 199 e concluir").
- `POST /api/ownership/transfers` (rascunho) → convite por e-mail ao comprador (`EmailTemplate TRANSFER_INVITE`) → KYC (`lib/kyc`, `KYC_PROVIDER=mock` aprova) → assinaturas (vendedor na hora, comprador pelo link) → `Order OFFPLATFORM_TRANSFER` R$ 199 pago (Stripe mock) → `AWAITING_TAP` → leitura do marcador pelo comprador (`purpose TRANSFER_CONFIRM`) → COMPLETED: nova versão do certificado, `RoyaltyPayment`.
- Preço selado: grava `sealedPriceHash` e `priceCents` fica só no servidor; a página pública mostra "Preço selado".

### E.7 `lib/resale-royalty/`
Tela: **Direito de sequência** (texto da Lei 9.610/98 art. 38; KPIs Recebido no ano / A receber / Obras revendidas; tabela Data · Obra · Revenda · Valorização · Repasse 5% · Status Repassado/A receber).
- `royaltyFor(saleCents, previousSaleCents)` = 500 bps × max(0, Δ); `previousSaleCents` = último `OwnershipTransfer.priceCents` ou `Deal.amountCents` da obra; preço selado conta pelo valor guardado. Retido no `DealSplit ARTIST_ROYALTY`; pago ao artista (ou herdeiros em `Artist.heirsJson`) ao liberar o split; recibo PDF.
- `FLAG_RESALE_ROYALTY` liga a retenção; decisão J.6 define obrigatório/opcional (padrão: obrigatório — o design mostra como automático).

### E.8 `lib/collector-wallet/`
Tela: **Carteira de escrituras** (lista de obras do titular com artista, data de aquisição, valor registrado ou "Preço selado", status Segurada/Sem seguro; total "Valor registrado · N obras"; o documento da escritura à direita).
- Carregador por `CertificateVersion.holderUserId = session.user` (versão ACTIVE); "Vender" lista no secundário (`Artwork.market = SECONDARY`, mandato novo; toast "Obra listada no mercado secundário · comissão 8% + 4%"); "Segurar" cria `Order COLLECTION_INSURANCE` + cotação mock ("Chubb e Tokio Marine"); "Pedir laudo" cria `AppraisalRequest` + `Order APPRAISAL_SIGNED`.

### E.9 `lib/marketplace/`
Tela: **Marketplace** (chips: Só autenticadas, Pintura, Até R$ 50 mil, Primário, Bahia; grade artista · título, ano · preço · "Autenticada"; card leva à página da obra `HouseArt Obra.dc.html` — ausente, J).
- `GET /api/public/artworks` com filtros (category, maxPriceCents, market, uf, só `status LISTED` e `seal GREEN`); página `/marketplace` (logado) e `/e` pública (fase 6, quando o Site chegar); página pública da obra `/e/artwork/[publicId]` mínima (ficha, mídias públicas, selo, botão "Fazer proposta" → `POST /api/public/offers` com OTP, como a Housebroker).

### E.10 `lib/appraisal/` (ADAPTAR + fila)
Tela: **Laudo de opinião de valor** (fila: obra, quem pediu, prazo; dossiê da obra: ficha, "Proveniência: 3 eventos · condition report excelente · etiqueta íntegra"; comparáveis sugeridos (obra, dimensões, valor, data); Mínimo / Sugerido / Máximo com régua; "Laudo assinado · PDF com QR para a página pública"; "Assinar e emitir laudo").
- `GET /api/appraisals/queue` (perfil APPRAISER), `POST /api/appraisals/[requestId]/issue` (gera `Appraisal` ISSUED, PDF com código `HA-L-…`, `CertificateEvent` opcional, e-mail ao solicitante); comparáveis sugeridos de `AppraisalComparable` + vendas na plataforma do mesmo artista.

### E.11 `lib/admin-review/`
Tela: **Admin · Obras e certificados** (KPIs Obras certificadas / Na fila de revisão / Contestações abertas; fila: Duplicidade, Contestação, Emissor novo, Etiqueta removida, Restrição IPHAN; Aprovar/Rejeitar).
- `ReviewQueueItem` criado por: `DuplicateCheck` ≥ 85 % (DUPLICATE), contestação pública (`POST /api/public/certificates/[publicId]/contest`, CONTESTATION → `Certificate.status CONTESTED`), primeiro lote de membro novo (NEW_ISSUER), `MarkerRead.tamperFlag` (MARKER_REMOVED), obra com `year < 1950` ou categoria marcada (EXPORT_RESTRICTION, revisão manual IPHAN).
- Decisão (`POST /api/admin/review/[id]`): APPROVED/REJECTED com efeito por tipo (duplicidade rejeitada → obra ARCHIVED; contestação aprovada → certificado REVOKED + obra DISPUTED; etiqueta removida → marcador REVOKED, nova etiqueta exigida).

### E.12 `lib/billing/` + `lib/plans/` + `lib/orders/` (ADAPTAR, com tela)
Tela: **Cobrança** ("Seu plano" Ateliê R$ 49 / Galeria Pro R$ 899 com descrição; "Mudar de plano"; "Uso em outubro" com barras: Obras cadastradas 38 de 60 · Etiquetas disponíveis 7 de 10 · Laudos incluídos 0 de 1 / Certificações no mês 18 de 40 · Viewing rooms ativos 3 de 10 · Assentos da equipe 4 de 5; "Faturas e notas fiscais": data, descrição, valor, status Paga/Retida no split, link NF-e).
- `PlanFeature` por plano (os limites acima); `PlanUsage` por mês; `Invoice` agrega fatura do plano, comissões retidas no split, pedidos (etiquetas, certificação).

### E.13 `lib/crm/` (ADAPTAR, com tela)
Tela: **CRM de colecionadores** (Kanban: Interessados · Em conversa · Proposta · Fechado; card: iniciais, nome, interesse, valor, quando).

### E.14 `lib/dashboard/`
Tela: **Dashboard** (saudação; KPIs artista: Obras certificadas, À venda, Vendidas no ano, Direito de sequência; galeria: Obras em inventário, Certificadas, GMV no ano, Ofertas abertas; "Próximas ações" (assinar certificado, responder oferta, enviar foto do verso, vincular etiqueta); "Vendas em 2026" barras por mês; "Obras recentes").
- `lib/dashboard/core.ts` puro sobre contagens de Artwork/Offer/Deal/RoyaltyPayment/Certificate; `nextActions` derivadas (certificado stage 3 → "Assinar", oferta aberta → "Responder", mídia pendente → "Enviar foto", marcador SHIPPED → "Vincular").

### E.15 `lib/market-indicators/` (ADAPTAR)
Faixa do topo: "Índice HouseArt 112,4 +0,8% · Dólar R$ 5,42 · Euro R$ 6,11". `HA_INDEX` = índice próprio (`lib/art-price-index/`, média móvel das vendas da plataforma normalizada = 100 na base; sem vendas, mostra "—").

### E.16 `lib/kyc/`, `lib/duplicate-detection/`, `lib/logistics/`, `lib/escrow/`
Conforme §3 (lista preliminar) com provedor `mock` no MVP; interfaces em `lib/<modulo>/provider.ts`, igual ao padrão `ProvedorCertidao` da Housebroker.

## F. DESCARTAR (uma linha por módulo — o agente NÃO traz)
- `lib/housecredito/`, `app/housecredito/*`, `app/api/housecredito/*`, `components/housecredito/`, `app/backoffice/housecredito/*`, `app/financiamento-imobiliario`, jobs `housecredito-diario`, `housecredito-hub-sincronizar`, `credito-vencimentos`, 27 models `*Credito`/`BancoCredito`/`EnvioBanco`/…, flags `FLAG_HOUSECREDITO*`, envs `THE_HOUSE_*`, `HOUSECREDITO_*` — financiamento imobiliário.
- `lib/credito/`, `app/credito/*`, `app/api/credito/*`, models `Credit*`, `AnaliseCredito`, `DocumentoAnaliseCredito`, `ConfigAssertiva`, `AgentCertification`, `CreditDisclosureLog`, flags `CREDIT_MODULE_ENABLED`, `CREDIT_PREQ_ENABLED`, `lib/assertiva/`, `app/backoffice/assertiva` — crédito legado e bureau.
- `lib/valuation/{rov,simulador,normative,estimate,ingestion,model,features,geo,offer-factor,observability,backoffice,db,contracts,report}`, `services/valuation-model/`, `lib/valor/`, `lib/simulador/`, `lib/simulacao.ts`, `app/simulador`, `app/e/{valor,rov,precificacao,parecer}`, `app/backoffice/valuation`, `app/api/v1/valor/*` (exceto o que D.13 reescreve), `app/api/simulador`, jobs `valuation-*`, `lib/integrations/valuation-host/`, 23 models `valuation_*` + `SugestaoPisoOferta`, `TaxaFinanciamento`, `TaxaBcb`, `ReferenciaMercado`, flag `VALUATION_NORMATIVE`, envs `VALUATION_*`, `ITBI_SALVADOR_URL` — AVM e métricas imobiliárias do HouseValor.
- `lib/btg/`, `lib/banking/`, `lib/payouts/` (exceto `alcada-core`, `lote-core`, `codigo`), `app/banking/*` (exceto pedidos/catálogo que viram `/orders`), `app/api/banking/*`, `app/api/payouts/*`, jobs `extrato-banco`, `payouts-lote`, `cobrancas-vencidas`, models `BankAccount`, `PagadorBanking`, `Cobranca`, `LinkPagamento`, `Movimento`, `ConciliacaoMovimento`, `EventoWebhookBanco`, `LotePagamento`, `Payout` (BTG), flags `FLAG_PAYOUT_BTG`, `FLAG_SPLIT_ORIGEM`, `FLAG_COBRANCA_SERVICOS` (o catálogo vai, mas só Stripe), envs `BTG_*` — banco BTG.
- `lib/financeiro/`, `app/financeiro/*`, `app/api/financeiro/*`, `components/financeiro/`, models `LancamentoFinanceiro`, DIMOB — ERP financeiro da corretora.
- `lib/corretagem/{server,emissao,vinculo,eventos-banco,leitura,pagador,mensagem,rotas-core}.ts` (o que não está em D.17), `lib/parcerias/` (exceto `split.ts`, `timeline.ts`), `app/parcerias/*`, `app/api/parcerias/*`, `components/parcerias/`, 17 models `Partnership*`/`CommissionSplit`/`SplitLine`/`SplitExpense`/`SplitAmendment`/`ClientRegistration`/`ConflictCase`/`PartnershipDispute`/`CommissionClaim`/`PartnershipTask`/`PartnershipVisit`/`PartnershipDocument`/`PartnershipMessage`/`PartnershipEvent`, `CounterOffer`, `PartnershipInvite`, `PartnershipParticipant`, flag `FLAG_CORRETAGEM_V2` — parceria entre corretores.
- `lib/rede/`, `lib/network/`, `lib/partners/` (API Housemap), `lib/lancamentos/`, `app/rede/*`, `app/lancamentos/*`, `app/api/rede/*`, `app/api/network/*`, `app/api/partners/v1/{agencies,referrals,projects,export,invites,links}`, models `EmpreendimentoParceiro`, `Vinculo`, `ConviteVinculo`, `DecisaoVinculoToken`, `LeadParceiro`, `Association`, `AssociationCommission`, `AgentReferralCode`, `PartnerDealEvent`, `PartnerProposal`, `PartnerConversationLink`, flags `FLAG_NETWORK_*`, `FLAG_PARTNER_*`, envs `HOUSEMAP_*`, `PARTNER_SECRET_*__HOUSEMAP`, `URL_PORTAL_LANCAMENTOS` — integração Housemap e lançamentos.
- `lib/empreendimentos/`, `lib/unidades/`, `lib/mktplace/`, `lib/market/`, `lib/tabela/`, `app/empreendimentos/*`, `app/tabela`, `app/tabela-de-precos`, `app/marketplace`, `app/mktplace`, `app/formas-de-pagamento`, `app/api/{empreendimentos,unidades,chamados,clientes,cnpj,importar,parcelas,selecoes,tabela,templates,vendas,mandatos(legado)}`, `components/{edit,detail,lancamentos,tabela,vendas,pagamento}`, models `Empreendimento`, `MarketplaceListing`, `MarketplaceDeal`, `Planta`, `Unidade`, `FormaPagamento`, `LinhaFormaPagamento`, `ReservaUnidade`, `RegraCorretagem`, `Cliente`, `Venda`, `Parcela`, `Chamado`, `InteracaoCliente`, `Incorporadora`, `Imobiliaria`, `Fornecedor`, `Midia`, `SelecaoImoveis(Item)`, `SolicitacaoAnuncio` (ver #51), job `expirar-reservas`, `scripts/seed-marketplace.ts` — incorporadora e lançamentos.
- 33 models de obras/viabilidade/Sienge (`Obra`…`ChecklistObra`, `Viabilidade`, `AiInteracao` com `obraId`, `MensagemAgente`), `scripts/contar-tabelas-mortas.ts` — construção; `AiInteracao` nasce NOVA sem `obraId`.
- `lib/creci-verification/`, `lib/corretor/creci.ts`, cron `creci-verification`, model `BrokerCreciVerification`, flags `FLAG_CRECI_*`, env `CRECI_*`, `scripts/creci-report.ts` — CRECI.
- `lib/registry-reading/` (conteúdo: atos, ônus, averbações), `lib/imoveis/validadores/registral.ts`, `lib/imoveis/{caracteristicas,custo-total,financiamento-pdp,estimativa-bairro,geocode,cep,backfill-geo*,circulo-geo,entorno,tabela}.ts`, `components/imoveis/{PassoEndereco,PassoCondominio,PassoEntorno,MapaEndereco,BannerCoordenadas}`, model `Condominio`, `ImovelPrecoHistorico` (vira `ArtworkPriceHistory` NOVO se o design tiver) — matrícula, geo, condomínio.
- `lib/certidoes/provedor/{infosimples,directdata}.ts`, `lib/certidoes/trf-por-uf.ts`, `TIPOS_CERTIDAO` forenses (CNIB, CENSEC, inventariante), `lib/parties/`, model `ParteDossie.{estadoCivil,regimeBens,nomeMae}`, envs `INFOSIMPLES_*`, `DIRECTDATA_*`, `CERTIDOES_*` (exceto cripto) — certidões imobiliárias.
- `lib/contratos/{promessa,promessa-server,variaveisRegistry,modelosPadrao,sale-template,deals-awaiting-contract-server}.ts`, `app/contratos/novo/lancamento`, `app/api/contratos/[id]/assinaturas/incorporadora`, `components/wizard/IncorporadoraSelect.tsx`, `docs/MINUTA-PROMESSA-COMPRA-VENDA.md` — promessa de compra e venda de imóvel.
- `lib/ofertas/pagamento.ts` (entrada 10 % + saldo), campos ITBI/FGTS/desocupação/preQ do `Proposta`, `lib/esteira/protocolo.ts`, fases TRIBUTOS/ESCRITURA/REGISTRO/AVALIACAO_CONTRATO_BANCARIO, templates ITBI/laudêmio/prenotação/habite-se/chaves, `lib/negocio/glossario.ts` (termos imobiliários) — cartório e tributos.
- `lib/google-ads-account/`, `lib/marketing/google*.ts`, `app/configuracoes/google-ads`, `app/api/google-ads/*`, `app/api/marketing/google/*`, job `google-ads-insights`, model `GoogleAdsConnection`, flag `FLAG_GOOGLE_ADS_POR_CORRETOR`, envs `GOOGLE_ADS_*` — Google Ads (dormente na HB).
- `lib/locacao/`, `lib/rental/`, `app/e/alugar`, `components/market/portal/{LeadLocacaoPortal,PdpLocacaoPortal}`, `Imovel.finalidade`, env `URL_PORTAL_LOCACAO` — locação.
- `lib/agente/` (`roteador.ts`, `processar.ts` sem importador) — morto.
- `lib/market-indicators` séries IPCA/INCC (`INCC_SGS_SERIE`) — índices imobiliários.
- `lib/dashboard` KPI "VGV"/"selos DD"/`Corretor.metaMensal` como nome — renomeados em D.27 (não é módulo, é vocabulário).
- `prisma/cutover/`, `scripts/migrar-*`, `scripts/backfill-tenants.ts`, `scripts/encrypt-contract-documents.ts`, `scripts/migrate-personal-files-to-vault.ts`, `scripts/recalcular-selos.ts`, `scripts/prova-*.manual.ts`, `scripts/fixture-*.manual.ts`, `scripts/seed-{billing,catalogo-servicos,esteira-templates,housecredito,planos,marketplace}.ts` — migrações de dados e provas do histórico da HB (as seeds do HouseArt nascem novas sobre o schema novo).
- `docs/*` da HB — não copiar; o HouseArt tem `docs/` próprio nascendo com `HOUSEART_BUILD.md`, `CLAUDE.md` e os ADRs que a construção registrar.
- Todos os 12 `redirects()` de `next.config.ts` — endereços antigos da HB.

## G. Design system — instalação sobre a base portada

Fonte: `houseart-design/design.css` (extraído do bundle; `:root` com os tokens `--ha-*`), fontes
Fraunces (display) + Inter (UI) + Material Symbols Rounded (ícones), tema escuro por
`[data-ha-theme="dark"]`, keyframes `ha-pulse`, `ha-close`, `ha-spin`, `ha-fade`.

### G.1 Tokens (copiar literalmente para `app/ds/tokens.css`)
- Paleta: `--ha-paper-50/100/200` (#FBFAF7 #F6F3EE #ECE7DF), `--ha-ink-900/700/500/300` (#111111 #2B2B2B #6B6760 #B5B0A6), `--ha-sand-500/600/100` (#D9A441 #B9872F #F5E7C8), `--ha-verified-500/100` (#2E7D5B #E3F0E9), `--ha-pending-500/100` (#C77A1E #F7EAD9), `--ha-alert-500/100` (#B23A2F #F5E1DE), `--ha-info-500` (#3A5F8A), `--ha-wall` (#EEEAE3; escuro #1A1A1A).
- Semânticos: `--ha-bg`, `--ha-surface`, `--ha-border`, `--ha-fg`, `--ha-fg-body`, `--ha-fg-muted`, `--ha-fg-disabled`.
- Tipografia: `--ha-font-display: 'Fraunces', Georgia, serif`; `--ha-font-ui: 'Inter', system-ui, sans-serif`; escalas `--ha-text-hero` 72/76, `display` 48/56, `h1` 36/44, `h2` 28/36, `h3` 22/30, `body-lg` 18/28, `body` 16/24, `body-sm` 14/20, `caption` 12/16. Títulos em display peso 400; UI peso 500/600.
- Espaço `--ha-space-1..24` (4px…96px), raio `--ha-radius-0/sm/md/lg/full` (0/4/8/16/999 — **o design usa raio; a regra `border-radius: 0` da Housebroker NÃO vale aqui**), `--ha-border-w` 1px, `--ha-focus-w` 2px, `--ha-passepartout` 12px, sombras `--ha-shadow-sm/lg/wall`, motion `--ha-dur-fast` 160ms / `panel` 240ms / `tap` 600ms, `--ha-ease`, `--ha-max` 1280px, `--ha-gutter` 24px.
- Foco: `outline: var(--ha-focus-w) solid var(--ha-sand-500); outline-offset: 2px` ou `box-shadow: 0 0 0 2px var(--ha-sand-500)` em inputs. Links `--ha-info-500`, hover `--ha-ink-900`.

### G.2 O que da base Housebroker é substituído
- `app/ds/tokens.css` e `app/ds/cells.css` da HB **não são copiados**: o DS do HouseArt nasce de `design.css` + classes `.ha-*` escritas a partir dos padrões repetidos nas 17 telas (`lib/ds/`): `.ha-btn` (`--primary` sand, `--ink`, `--outline`, `--ghost`; tamanhos sm/md), `.ha-input`/`.ha-label`, `.ha-chip` (filtro, com `--on`), `.ha-badge` (status: `verified`, `pending`, `alert`, `neutral`, `ink`), `.ha-kpi`, `.ha-card`, `.ha-table` (grid com cabeçalho caption uppercase `.08em`), `.ha-wall` (fundo de obra com `--ha-shadow-wall`), `.ha-stepper` (passos verticais), `.ha-timeline` (6 etapas), `.ha-progress` (barra 6px), `.ha-toast`, `.ha-modal` (scrim `rgba(17,17,17,.55)`), `.ha-tabs` (underline `inset 0 -2px 0`), `.ha-nav-item`, `.ha-topbar` (64px), `.ha-sidebar` (240px), `.ha-ticker` (faixa de índices), `.ha-avatar`.
- Ícones: Material Symbols Rounded por `<Icon name="verified" />` (`components/ds/Icon.tsx` renderiza o ligature com a fonte); os 313 SVGs da HB saem.
- `HousebrokerLogo` → `HouseArtLogo` (o glifo do design: retângulo 16×20 com borda 1,5px + quadrado 7×7 no canto superior direito + wordmark Fraunces "HouseArt").
- `components/layout/AppShell.tsx` da HB sai; nasce `components/layout/AppShell.tsx` novo com a estrutura do design: ticker (índices) → header 64px (logo 192px, busca "Buscar obras, artistas, galerias ou IDs", sino, botão de perfil com iniciais + rótulo + `swap_horiz`) → aside 240px com `NAV[perfil]` e rodapé (links + Sair) → `main` com `max-width: var(--ha-max)`.
- `app.css` dos apps (`.ca-*`), `components/market/portal/*`, `portal.css`, paleta Tailwind do portal: saem. Tailwind fica só para utilitários de layout sem cor (catraca `tailwind-paleta` adaptada para `--ha-`).
- `lib/theme.ts`: `THEME_KEY='ha-theme'`, atributo `data-ha-theme`.
- Catracas: `lib/ha-tokens.test.ts` (todo `var(--ha-*)` definido), `lib/tailwind-paleta.test.ts`, `lib/brand.test.ts` ("HouseArt"; proíbe "Housebroker"/"Housemap" em telas), `lib/design-screens.test.ts` (NOVA: cada `data-screen-label` do design tem uma página correspondente em `lib/architecture/screen-map.ts`).

### G.3 Instalação
1. `app/ds/tokens.css` = `:root` + `[data-ha-theme="dark"]` + keyframes de `design.css`, sem alteração de valor.
2. `app/layout.tsx`: `next/font/google` Fraunces (`axes: ['opsz','SOFT']` opcional) + Inter, variáveis `--font-fraunces`/`--font-inter` lidas pelos tokens; Material Symbols Rounded via Google Fonts `<link>` (não há npm).
3. `app/ds/cells.css` = classes `.ha-*` (G.2), escritas com os estilos inline das telas (sem inventar valores).
4. `components/ds/{Icon,Button,Badge,Chip,Kpi,Table,Stepper,Timeline,Progress,Toast,Modal,Tabs}.tsx` — primitivos que as 17 telas usam.
5. Rodar as catracas de G.2.

## H. Plano de execução em fases

Cada fase: `TaskCreate` por item → implementar → testes mínimos + `npm run build` → commit `fase N: <critério>` → resumo. Critério de pronto em negrito.

**Fase 0 — Esqueleto** (A, C infra, G): package.json, configs, Docker 5436 + `db:up:native`, CI, husky, `lib/prisma*`, `lib/flags`, `lib/architecture` (baselines vazias), `instrumentation.ts`, `middleware.ts`, DS instalado, `AppShell` com o layout do design e `NAV` por perfil, página `/` placeholder. **Pronto: `npm run gate` verde; `next build` sem `DATABASE_URL`.**

**Fase 1 — Auth, tenant, perfis e cadastro de obra** (telas Login, Escolha de perfil, Dashboard, Minhas obras, Cadastro de obra): C (auth, authz, accounts, scope com triggers, audit, rate-limit, storage, crypto, token-links), B tenancy/membros/obra, E.1, E.2, E.14 (KPIs que já existem: obras por status), `lib/duplicate-detection` com pHash. **Pronto: login por e-mail/senha e por código; escolher perfil; artista cria obra nos 6 passos com mídia no cofre e derivada pública; lista filtra por status; dashboard com contagens reais; tenant isola galeria A de artista B (`isolation.integration.test`); `guarda-de-rotas.integration` sem sessão.**

**Fase 2 — Certificação e verificação** (telas Certificação, Admin · Etiquetas, Admin · Obras e certificados, página `/verify`): E.3, E.4, E.11, `lib/contracts`+`lib/signatures` portados (OTP, trilha), cron `certificate-anchor`. **Pronto: pedir etiquetas gera pedido; lote + vinculação (mock SUN) gera `publicId`; assinar → emitir gera versão 1 com PDF e hash; `/verify/[publicId]` confere; fila admin decide duplicidade/contestação/remoção; selo verde deixa listar.**

**Fase 3 — Marketplace, ofertas e CRM** (telas Marketplace, Vendas e ofertas (aba Ofertas), CRM de colecionadores): E.9, E.5 (oferta pública com OTP, aceitar/recusar/contrapropor, negociador automático por mandato), E.13 (Kanban), notificações + e-mail (D.20/21), `lib/conversations` portado sem tela. **Pronto: colecionador faz proposta pública → OTP → aparece em Vendas e ofertas com %, aceita/recusa/contrapõe; negociador aceita ≥ 92 %; Kanban do CRM com oportunidades reais; piso nunca aparece (catraca de vazamento).**

**Fase 4 — Negócio, carteira, transferência e direito de sequência** (telas Vendas · Em andamento, Compras, Carteira de escrituras, Transferência fora da plataforma, Direito de sequência): E.5 (Deal com 6 fases, escrow mock, split, logística mock, entrega por leitura), E.6, E.7, E.8, `lib/commission` (D.17), `lib/kyc` mock, cessão (`lib/contracts/assignment.ts`). **Pronto: venda ponta a ponta no Stripe mock até COMPLETED com nova versão do certificado e split liberado; transferência fora da plataforma com taxa R$ 199, assinaturas e toque; royalty 5 % calculado e listado.**

**Fase 5 — Cobrança, planos e laudos** (telas Cobrança, Laudo de opinião de valor): E.12 (planos com limites, uso do mês, faturas), `lib/billing` Stripe mock + Connect, `lib/orders` com catálogo D.15, E.10 (fila, comparáveis, emissão PDF com código), estimativa de referência do passo 5 (E.2). **Pronto: fatura do plano, comissão retida e pedidos aparecem em Cobrança; avaliador emite laudo assinado verificável; estimativa aparece no cadastro quando há comparáveis.**

**Fase 6 — Deploy e acabamento**: Vercel + Supabase + envs (I), crons em `vercel.json`, smoke Playwright das 5 jornadas do brief, `grep` final por vocabulário imobiliário, CLAUDE.md com comandos reais e estado. **Pronto: produção no ar com login de teste e as 17 telas; suíte completa verde; pendências listadas.**

Fora destas fases (esperam as telas ausentes — J.1): site público `/e`, página pública da obra completa, página de verificação no desenho final, web da galeria, web do colecionador, app do artista (captura guiada de mídia e leitura NFC real), design system completo.

## I. Variáveis de ambiente, integrações e serviços a provisionar

### I.1 Envs que PORTAM (mesmo nome)
`DATABASE_URL`, `DATABASE_URL_TEST`, `DIRECT_URL`, `ADMIN_EMAIL`, `ADMIN_SENHA`→`ADMIN_PASSWORD`, `ADMIN_CPF`, `ADMIN_NOME`→`ADMIN_NAME`, `AUTH_PROVIDER`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`, `ERROR_REPORT_WEBHOOK_URL`, `TOOLGW_SECRET`, `TOOLGW_ACCEPT_V1`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `BLOB_READ_WRITE_TOKEN`, `BLOB_PRIVATE_READ_WRITE_TOKEN`, `UPLOAD_HOSTS_PERMITIDOS`→`UPLOAD_ALLOWED_HOSTS`, `STRIPE_AMBIENTE`→`STRIPE_ENV`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `BILLING_WEBHOOK_SECRET`, `STRIPE_SIMULADO_LIBERADO`→`STRIPE_MOCK_ALLOWED`, `STRIPE_PIX_ATIVO`→`STRIPE_PIX_ENABLED`, `STRIPE_CUPOM_FUNDADOR`→`STRIPE_FOUNDER_COUPON`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `ANDROID_ASSETLINKS_SHA256`, `VIEW_HASH_SECRET`, `TZ_OVERRIDE`, `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `AWESOMEAPI_KEY`, `GOOGLE_AGENDA_CLIENT_ID/SECRET`→`GOOGLE_CALENDAR_*` (se agenda), `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `META_APP_ID`, `META_APP_SECRET`, `META_GRAPH_VERSION`, `NEXT_PUBLIC_META_APP_ID`, `NEXT_PUBLIC_META_WA_CONFIG_ID`, `NEXT_PUBLIC_META_ADS_CONFIG_ID`, `TRANSCRICAO_PROVIDER`→`TRANSCRIPTION_PROVIDER`, `TRANSCRICAO_MODEL`→`TRANSCRIPTION_MODEL`, `GROQ_API_KEY`, `OPENAI_API_KEY`, `LGPD_ENCARREGADO_EMAIL`→`LGPD_OFFICER_EMAIL`, `HOUSEBROKER_WHATSAPP`→`HOUSEART_WHATSAPP`, `NEXT_PUBLIC_LOGODEV_TOKEN` (só se houver logos), `QA_RBAC_SENHA`→`QA_RBAC_PASSWORD`, `CERTIDOES_CPF_KEYS`→`DOCUMENT_CIPHER_KEYS`, `CERTIDOES_CPF_PEPPER`→`DOCUMENT_HASH_PEPPER`, `DOCUMENT_READING_MODE`, `DOCUMENT_READING_MODEL`, `PARTNER_SECRET_IN__<ref>`, `PARTNER_SECRET_OUT__<ref>`, `NEXT_PUBLIC_MAPBOX_TOKEN` (só se o design tiver mapa), `NEXT_PUBLIC_AUTH_HOUSEGROUP` (federação; nome a confirmar em J).

### I.2 Envs NOVAS (do brief/E)
`MARKER_MASTER_KEY_REF` (referência à chave no HSM/KMS para diversificação por UID), `MARKER_VENDOR` (`ntag424|mock`), `TIMESTAMP_AUTHORITY_URL`, `TIMESTAMP_AUTHORITY_CREDENTIALS_REF` (ACT ICP-Brasil), `ANCHOR_NETWORK` (`none|opentimestamps|polygon`), `ANCHOR_CREDENTIALS_REF`, `KYC_PROVIDER` (`mock|didit`), `KYC_API_KEY`, `KYC_WEBHOOK_SECRET`, `QUALIFIED_SIGNATURE_THRESHOLD_CENTS` (10000000), `ESCROW_BANK_THRESHOLD_CENTS` (10000000), `SHIPPING_PROVIDER` (`mock|convelio|arta|manual`), `SHIPPING_API_KEY`, `INSURANCE_PROVIDER`, `INSURANCE_API_KEY`, `EMBEDDINGS_PROVIDER` (`none|openai|local`), `EMBEDDINGS_API_KEY`, `PROVENANCE_PROVIDER` (`fake|none`), `ART_LOSS_REGISTER_CREDENTIALS_REF` (manual no MVP), `RESALE_ROYALTY_BPS` (500), `MARKETPLACE_FEE_PRIMARY_BPS` (1200), `MARKETPLACE_FEE_SECONDARY_BUYER_BPS` (800), `MARKETPLACE_FEE_SECONDARY_SELLER_BPS` (400).

### I.3 Flags (`lib/flags.ts` do HouseArt — nasce com estas; nenhuma de dinheiro ligada por padrão)
`FLAG_MEMBER_APP`, `FLAG_COLLECTOR_APP`, `FLAG_COMMUNITY` (defaultOn só se houver comunidade), `FLAG_DEALS` (= FLAG_ESTEIRA), `FLAG_TENANT_SCOPE` (nasce `1`), `FLAG_CONSIGNMENT_REQUIRED`, `FLAG_WHATSAPP_EVOLUTION`, `FLAG_WHATSAPP_BUSINESS_SIGNUP`, `FLAG_META_PER_MEMBER`, `FLAG_FEDERATED_PROVISIONING`, `FLAG_RBAC_SHADOW`, `FLAG_RBAC`, `FLAG_RBAC_SOURCE_ROLES`, `FLAG_ORDERS`, `FLAG_PLANS`, `FLAG_COMMISSION`, `FLAG_BILLING`, `FLAG_PROVENANCE_REPORT`, `FLAG_DOCUMENT_READING`, `FLAG_PHYSICAL_MARKERS`, `FLAG_CERTIFICATES`, `FLAG_OWNERSHIP_TRANSFER`, `FLAG_KYC_REQUIRED`, `FLAG_RESALE_ROYALTY`, `FLAG_DUPLICATE_DETECTION`, `FLAG_LOGISTICS`, `FLAG_ESCROW`, `FLAG_APPRAISAL`, `FLAG_PUBLIC_API`, `FLAG_PROVENANCE_CHECKS_AUTO` (liga com `'true'`, custo), `FLAG_PROVENANCE_CONSENT_REQUIRED` (`'on'`).

### I.4 Crons (`vercel.json`) — os que portam
`notifications-flush` (0 10), `publish-scheduled` (*/10), `meta-refresh-token` (0 9), `meta-ads-insights` (0 10), `deal-automation` (30 11), `deal-digest` (0 11), `deals` (0 9), `billing-daily` (25 9), `plans-subscription` (45 8, se fallback), `partner-events` (0 1-23/2), `offers-weekly-digest` (0 12 seg), `market-indicators-fx` (*/15 12-21 seg–sex), `offers-monitor` (40 11), `provenance-checks` (10,40), `community-sweep` (35 *, se houver). NOVOS: `certificate-anchor` (diário, merkle root), `marker-health` (tags sem leitura/reportadas), `kyc-sync`, `shipment-tracking`.

### I.5 Serviços a provisionar
| Serviço | Para quê | Quem |
|---|---|---|
| Repositório GitHub `Housemap/houseart` (ou org própria) | código | Moacy/Lucas |
| Projeto Vercel `houseart` (framework preset nextjs, `main` = produção, domínio `www.houseart.com.br` ou o decidido) | deploy, crons, Blob público e privado (dois stores) | Lucas |
| Projeto Supabase (Postgres 17, extensão `vector`; opcional Auth para o modo supabase) | banco | Lucas |
| Stripe (conta BR, Connect Express, Pix por convite, webhook) | pagamentos, escrow, split | Moacy |
| ACT ICP-Brasil (ex.: Serpro) | carimbo do tempo do certificado | Moacy |
| Fornecedor de tags NTAG 424 DNA (Shop NFC / GoToTags / ACURA / HID) + HSM/KMS para master key | marcador físico | Moacy |
| KYC (Didit ou similar) | biometria + PEP | Moacy |
| Anthropic API key | leitura de documentos, copiloto, legendas | existente |
| Meta app (WhatsApp Business, Instagram, Ads) + App Review | canais | existente (housemap-app) |
| SMTP (Gmail/genérico) em `ChannelConfig` | e-mail | existente |
| Evolution API (servidor com URL pública) | WhatsApp Web | existente (Railway) |
| Cloudflare Turnstile | formulários públicos | existente |
| AwesomeAPI | câmbio | existente |
| Transportadoras (Fink, Alves Tegam, Convelio, Arta) e seguradora | frete/seguro — contrato comercial antes da API | Moacy |
| Art Loss Register | consulta manual £85 | Moacy |
| VAPID keys, `DOCUMENT_CIPHER_KEYS`, `DOCUMENT_HASH_PEPPER`, `TOOLGW_SECRET`, `CRON_SECRET`, `VIEW_HASH_SECRET` | segredos (`openssl rand`) | na criação do projeto |

## J. Perguntas em aberto (só o que bloqueia) e decisões registradas

### Bloqueiam
1. ~~Telas ausentes do pacote~~ **RESOLVIDO 2026-10-21**: handoff completo em `houseart-design/handoff/` (ver `docs/HANDOFF-2026-10-21.md`). Histórico: o bundle enviado tem só `HouseArt Web App` (17 telas). Ele linka `HouseArt Obra`, `HouseArt Verificacao`, `HouseArt Site`, `HouseArt Web Galeria`, `HouseArt Web Colecionador`, `HouseArt App Artista` e `HouseArt Design System`. Sem eles, a página pública da obra, a verificação, o site e os apps nascem mínimos no mesmo DS (E.4, E.9). **Enviar os 7 arquivos .dc.html.**
2. ~~Repositório GitHub~~ **RESOLVIDO 2026-10-21**: `moacyveiga-ai/houseart` (a conta pessoal criou na 1.ª tentativa apesar do 403 devolvido; a org Housemap segue sem permissão de admin). `main` enviada, projeto Vercel conectado, produção em https://houseart-housemapp.vercel.app. Migrar para `Housemap/houseart` = religar o projeto Vercel.
3. ~~Projeto Supabase~~ **RESOLVIDO 2026-10-21**: o projeto `houseart` existia (ref `zqxkwaivqqlkocbmdvch`, us-east-2 — o conector criou apesar do timeout). Schema aplicado pelo conector em blocos (o `apply_migration` e blocos com `$$` dão timeout — usar `$fn$` e `EXECUTE PROCEDURE`), `_prisma_migrations` registrada, papel `houseart_app`, admin semeado.
3b. ~~Blob stores da Vercel~~ **RESOLVIDO 2026-10-21** (upload conferido em produção; nomes das envs a limpar — `docs/PRODUCAO-PENDENCIAS.md` §2).

### Decididas (reversíveis, registradas aqui)
4. Vercel: time `housemapp` (o mesmo do Housebroker), projeto `houseart` (`prj_LquuKlmalxrqh1f1sQ7j2QyvKEoI`, Node 22, nextjs, funções `gru1`, SSO desligado), `main` = produção, **no ar desde 2026-10-21**. Pooler do Supabase é `aws-0-us-east-2` (o `aws-1` responde "tenant/user not found"); o host direto `db.<ref>.supabase.co` só resolve IPv6 e a Vercel não alcança.
5. Federação "Entrar com Housemap": fora do MVP; login próprio (e-mail/senha + código). O botão "Entrar com e-mail" da tela = fluxo por código. `lib/auth/supabase/federacao*` porta dormente.
6. Direito de sequência: retido automaticamente em toda revenda (o design apresenta como automático e cita a lei). `FLAG_RESALE_ROYALTY` nasce ligada em produção.
7. Certificação do artista: paga (R$ 149 avulsa; kit de etiquetas R$ 15/un como na tela). Subsídio de lançamento = cupom no Stripe, não regra de código.
8. Comissão do primário: 12 % cobrada do vendedor (galeria/artista), como mostra "HouseArt · 12%" na repartição.
9. Escrow acima de R$ 100 mil: manual (instrução de TED + conciliação pela equipe) no MVP.
10. Assinatura qualificada ICP-Brasil: fora do MVP; assinatura avançada (OTP + trilha + carimbo do tempo mock/ACT quando configurada). `TIMESTAMP_AUTHORITY_URL` vazio = carimbo simulado marcado como tal no certificado.
11. Índice HouseArt no ticker: índice próprio (`lib/art-price-index`), "—" sem vendas.
12. Mapa (Mapbox): não há mapa nas 17 telas → `mapbox-gl` fora.
13. ~~Agenda e Comunidade: não há telas → fora do MVP~~ **REVISTA 2026-10-21**: o handoff trouxe comunidade (feed, notícias, agenda, enquete, eventos) — Fase 5 do handoff.
14. Adapter Neon: fora; só `@prisma/adapter-pg`.
15. Fotos de registro: upload direto ao Blob privado por token (sem passar pela função), limite 50 MB por arquivo; derivada pública ≤ 2048 px gerada no servidor (`sharp`); sem canvas no cliente para o master.
16. KYC, frete, seguro, carimbo do tempo, ancoragem, e-mail de verificação SUN: provedores `mock` no MVP com interface pronta.
17. Dev local: Postgres 16 nativo em 5436 (`db:up:native`); CI com `postgres:17-alpine`.
18. (Fase 5) `PlanUsage` NÃO virou tabela: o uso do mês é contado da base (`usageCounts`) — a verdade é o que existe. `ArtworkPriceEstimate` também não: a estimativa do passo 5 é calculada ao vivo (`lib/appraisal/estimate-core.ts`) sobre `AppraisalComparable` + vendas concluídas do mesmo artista.
19. (Fase 5) A porta do Stripe mora em `lib/stripe/door.ts` (não em `lib/billing`) para `billing → plans → stripe` não fechar ciclo.
20. (Fase 4) Comissão do comprador no secundário (8 %) entra como `buyerTotalCents`; o split grava só as partes do vendedor. Fatura `COMMISSION` do comprador nasce `HELD_IN_SPLIT` e vira `PAID` na escritura.
