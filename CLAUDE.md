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
> **Fonte de verdade de UI: `./houseart-design/handoff/`** (handoff de 2026-10-21: 20 protótipos
> `.dc.html`, tokens, marca, capturas; `HANDOFF-README.md` tem as regras, `docs/HANDOFF-2026-10-21.md`
> o diagnóstico e o plano). `houseart-design/screens.html` é o export anterior das 17 telas do Web
> App, iguais às do handoff. Não resuma nem reinterprete: referencie por caminho. Onde o design e a
> Housebroker divergirem, o design vence. Telas da Fase 8 do handoff não têm design: pare e peça.

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
- **2026-10-23 — Papéis na tela e desempenho.** `GET /api/auth/me` devolve `teamRole`; regras de permissão em `lib/offers/seller-role-core.ts` (puro) usadas pelo servidor, pelo web e pelo app: o Acervo não responde propostas nem muda o anúncio, só a Admin vê e muda as regras e gere a equipe (a tela web de Equipe oferecia gestão a todos — corrigido). Vendas do colecionador no app com assinar e registrar envio (`GET /api/collector/sales`, `collectorSales`). Consultas em lote: `listingsOf`/`viewsSinceMany` (`lib/gallery/listing-server.ts`) e `currentCertificateVersionsOf` (`lib/certificates`) — com 60 obras o acervo do app caiu de 249 para 13 consultas e o painel de 317 para 22, custo constante provado em `gallery-perf.integration.test.ts`; páginas web do acervo e do Início da galeria usam o mesmo lote.
- **2026-10-22 — Conteúdo público editável, telas restantes dos apps e revisão.** Edição do que `/e` mostra sem SQL: equipe em `/admin/content` (notícias e agenda; `canEditPublicContent`: admin, gestor, operador), artista em `/profile/public`, galeria (só ADMIN) em `/gallery/public` e artistas representados sem conta em `/gallery/public/artists/[id]`; regra em `lib/public-content/editor-*`, imagens validadas por bytes e gravadas como derivada pública (`content/…`); teste `content-editor.integration.test.ts`. Apps: Compras e Confirmar recebimento, Vendas do colecionador, Cadastrar e Vender obra, Cartões, Pix e Verificar nativos (rotas `/api/collector/{purchases,artworks/[id]/sell-estimate}`, `/api/public/certificates[/[publicId]/read]`). Revisão adversarial dos apps: papéis da equipe da galeria passaram a restringir (`lib/offers/seller-role-server.ts`: Acervo só cadastra e certifica, Vendas responde propostas e gere o anúncio, só Admin muda regras), regras de ofertas valem para a galeria inteira (lidas por tenant), favoritos sem preço de obra fora de venda, `GET/PATCH /api/artworks/[id]` sem chave do cofre nem hashes (`lib/artworks/dto-core.ts`), e o lado do negócio decidido pelo negócio (`sideOfDeal`). (Pendências deste item resolvidas em 2026-10-23.)
- **2026-10-22 — App Artista nativo** (`apps/mobile`, perfil ARTIST): Início, Obras (a `InventoryScreen` da galeria), Nova obra com câmera guiada (`/artworks/new`, 10 slots de `MEDIA_SLOTS`, upload multipart por `apiUpload`, ficha rápida, envio e vínculo), Vincular etiqueta (`/certification/link/[artworkId]`: URL colada ou "Simular leitura" quando `simulateAllowed`; ponto de extensão `src/nfc/reader.ts` para `react-native-nfc-manager` num dev build), Escrituras e Avisos (push pelo hook `usePushToggle`). Dependência nova: `expo-image-picker` ~17.0.11. Rotas `GET /api/artist/{home,certificates,artworks/[id]/link}` (teste `artist-mobile-api.integration.test.ts`). Em WebView: Verificar obra, Confirmar recebimento, Vendas. Os três apps (Colecionador, Galeria, Artista) estão nativos; nenhum foi testado em aparelho.
- **2026-10-22 — App Galeria nativo** (`apps/mobile`, perfis GALLERY e ADVISOR): Painel do dia, Acervo, Gestão do anúncio (`/artworks/[id]/listing`), Vendas com Ofertas recebidas (aceitar, recusar, contrapropor), Vendas até o repasse e Regras de ofertas, Negócio (`/deal/[id]`), Equipe, Artistas representados e Conta (menu). `src/nav/tabs.ts` ganhou `NATIVE_FOR`/`isNativeTab` (home/artworks/sales são nativas só para galeria e consultor; o Artista segue em WebView nelas). Rotas novas `GET /api/gallery/{panel,inventory,deals,artworks/[id]}` (teste `gallery-mobile-api.integration.test.ts`, escopo por tenant, nada do mandato). Em WebView: Cadastrar e Editar obra, Pix, Plano, Cartões.
- **2026-10-22 — App Colecionador, fase 2 nativa** (`apps/mobile`): Fazer oferta em 5 etapas (Valor · Condições · Identidade · Garantia · Revisão) e acompanhamento da proposta com contraproposta (`/offer/[code]`), Comprar direto, Comunidade (feed, posts, comentários, enquetes, composer), badge de não lidas em Mensagens e Fraunces embarcada (`assets/fonts`, OFL). Rotas novas `GET /api/collector/offers/[code]` e `GET /api/messages/unread` (teste em `mobile-api.integration.test.ts`). Em WebView: Compras, Vendas, Cadastrar/Vender obra, perfis, certificado, notícia inteira, Minha conta e os perfis Galeria/Consultor/Artista. Cadastro web: só Google e Apple, marca 48 px, Cisne no quadro, sem rolagem no desktop.
- **2026-10-22 — App Colecionador, fase 1 nativa** (`apps/mobile`): Explorar (feed + deck Descobrir), Página da obra, Minha coleção, Favoritos e curtidos, Mensagens e Conversa, Busca viraram telas nativas (`src/screens/`, kit em `src/ui/kit.tsx`); Fazer oferta, Comprar, Cadastrar/Vender obra, Compras, Vendas, Comunidade, perfis e certificado seguem em WebView (`app/web.tsx`). Rotas JSON novas: `GET /api/collector/{explore,favorites,wallet}` e `GET /api/public/artworks/[publicId]` (teste `test/integration/mobile-api.integration.test.ts`; nada do mandato nem do documento). Não testado em aparelho. Conteúdo público com imagens em produção: `scripts/demo/content.sql`.
- **2026-10-22 — Cenário fictício em produção.** `scripts/demo/` (contas por SQL + roteiro pela API real) rodado contra https://houseart-housemapp.vercel.app: todos os perfis logam e operam (artista, galeria admin e vendas, consultora, colecionadores, avaliador, admin); 10 obras, 9 certificados, 4 negócios (2 concluídos com escritura), revenda no secundário, obra própria do colecionador, laudo, mensagens e comunidade. Logins e senha em `scripts/demo/README.md`. Bug achado e corrigido no caminho: vendedor da galeria (`GALLERY_STAFF`) não via as propostas da galeria (escopo por tenant em `lib/scope/core.ts`).
- **2026-10-22 — Colecionador dono e vendedor + apps mobile M0** (decisões do Moacy). Membro COLLECTOR nascido na primeira obra do colecionador (`lib/tenant/member-server.ts`: `ensureMemberForUser`, `moveArtworkToHolder` chamado pela transferência concluída — a obra passa ao titular, AUTHENTICATED, secundário); `lib/collectors/server.ts` (cadastrar obra própria com origem, vender pela carteira, serviços por obra), rotas `/api/collector/*`, telas `/wallet/register`, folhas Vender/Serviços na carteira, "Vendas" no nav; migration `20261022500000_collector_owner`. **`apps/mobile`** (Expo, pacote independente fora das catracas): sessão por bearer (`getSession` lê `Authorization`; login devolve `token` para `x-houseart-client: mobile`), abas por perfil em WebView com cookie, push por Expo (`expo:` em `PushSubscription`, `EXPO_ACCESS_TOKEN` opcional). Pendentes do handoff: 7 (Instagram, splash/onboarding). **Próximas:** telas nativas no app por fase; lista "minhas obras" do colecionador; Instagram quando houver provedor.
- **2026-10-22 — Web Colecionador feito.** `/explore` (Início do colecionador: feed + Descobrir em deck), `/favorites`, `/account`, `/search` (busca global, `lib/search`), `/e/news[/slug]` com leitor, `/e/guide`, `ShareSheet` na obra pública e coração real no marketplace; reação `ARTWORK` em `lib/community`. Pendentes do handoff: 11, todos dependentes de decisão (colecionador como vendedor/dono de obra, Instagram, splash/onboarding dos apps mobile). **Próximas:** decisões do Moacy (apps mobile; colecionador vendendo no secundário), página pública com sessão no header, `PATCH` de nome/celular na conta.
- **2026-10-22 — Handoff Fase 5 feita: mensagens, comunidade e avisos.** `lib/messaging` (conversa por par + obra, filtro de contato, linhas de sistema das ofertas; `/messages`), `lib/community` (feed com posts, notícias e agenda; reações, comentários, enquetes; `/community`), `/notifications` com web push (`lib/notifications/push.ts`, `WEB_PUSH_*` já na Vercel, `public/sw.js`); migration `20261022400000_phase5_social`; rotas públicas de leitura em `/api/public/community/*`. Divergências em `docs/HANDOFF-2026-10-21.md` §5. **Próximas:** Web Colecionador/Galeria (telas restantes), página da notícia `/e/news/[slug]`; apps mobile dependem de decisão.
- **2026-10-22 — Handoff Fase 6 feita: operação da galeria.** Regras de ofertas (`lib/offers/rules-*`, recusa abaixo de 60/70/80 % na hora), equipe por tenant com convite por e-mail e papéis Admin · Vendas · Acervo (`lib/gallery/team-server.ts`, `/team/accept`), artistas representados com contrato, gestão do anúncio (preço ≥ piso, aceita ofertas, pausar) e painel do dia; migration `20261022300000_phase6_gallery`. Telas: Início da galeria, Acervo, `/artworks/[id]/listing`, `/sales/rules`, `/gallery/{team,artists,account}`. Divergências em `docs/HANDOFF-2026-10-21.md` §5.
- **2026-10-22 — Handoff Fase 3 feita: núcleo da obra.** Captura guiada + editor no passo Mídia (`components/artworks/GuidedCapture.tsx`,
  `PhotoEditor.tsx`, `MediaStep.tsx`; 10 slots em `MEDIA_SLOTS`), leitura assistida das fotos (`lib/artworks/reading-*`,
  `ARTWORK_READING_MODE=claude` + `ANTHROPIC_API_KEY`, só campos vazios), vincular etiqueta no web (`/certification/link/[artworkId]`,
  Web NFC ou URL colada; `simulate:true` só com `MARKER_VENDOR=mock` fora de produção). Backend da Fase 6 (galeria) em `lib/gallery/`
  (regras de ofertas em `lib/offers/rules-*`, equipe com convites, contratos de artistas, gestão do anúncio, views; migration
  `20261022300000_phase6_gallery`). Divergências em `docs/HANDOFF-2026-10-21.md` §5.
- **2026-10-22 — Handoff Fase 4 feita: mercado.** Oferta em 5 etapas (`/e/artwork/[publicId]/offer` → `/e/offer/[code]`
  com contraproposta e linha do tempo), compra direta (`/e/artwork/[publicId]/buy`), Carteira e cartões (`/wallet/cards`),
  Pix de recebimento (`/sales/payout`). `lib/payment-methods/` (cartão só marca/últimos 4 + token mock; Pix cifrado),
  garantia/validade/cotação na `Offer`, captura em garantia no aceite, `buyNow`, identidade do comprador
  (`lib/accounts/identity-server.ts`); migration `20261022200000_phase4_market`. **Produção:** a posse das tabelas passou ao
  `houseart_app` (o conector criou o schema como `postgres`; migration que ALTERA tabela falhava no build) — ver
  `docs/PRODUCAO-PENDENCIAS.md`. Divergências em `docs/HANDOFF-2026-10-21.md` §5. **Próximas:** Fase 3 (captura guiada),
  Fase 6 (galeria), Fase 5 (mensagens, comunidade, push), Web Colecionador/Galeria.
- **2026-10-22 — Handoff Fase 2 feita: acesso no desenho.** Entrar e Cadastro em passos (`app/login`, `app/signup`,
  `app/signup/welcome`), login social em `lib/auth/oauth/` (Google/Apple/Facebook/LinkedIn; `MOCK` só com `OAUTH_MOCK=1`
  fora de produção; provedor sem chave = botão "Em breve"), celular por SMS (`lib/sms/`, Twilio ou mock), reset de senha por
  link de 1 h, "Manter conectado", preferências do onboarding, `UserIdentity`; migration `20261022100000_phase2_access`.
  `/terms` e `/privacy` provisórios. Divergências em `docs/HANDOFF-2026-10-21.md` §5. **Próximas:** Fase 4, 3, 6, 5, Web
  Colecionador/Galeria; apps mobile dependem de decisão.
- **2026-10-21 — Handoff Fases 1 e 7 feitas: design system em código e o site público no ar.**
  `/design-system` (galeria pública dos componentes, seção a seção como o protótipo; `components/ds/`
  ganhou Field, Toggle, ArtworkFrame, StatusBadge, ArtworkId, ArtworkCard, ProvenanceChain,
  CertificateSheet, PriceBox, SplitSummary, ValuationGauge, TagReader, WalletItem, IndexTicker; Button
  com os sete estados). Site público em `/e` (`app/e/layout.tsx` = PublicHeader/PublicFooter do desenho;
  `/` sem sessão vai para `/e`): Home, `/e/how-it-works`, `/e/marketplace` (filtros na URL,
  `lib/marketplace/filter-core.ts`), `/e/artists`, `/e/artwork/[publicId]` (cotação de frete em
  `lib/shipping/quote-core.ts`, mock determinístico), `/e/artist/[slug]`, `/e/gallery/[slug]`,
  `/e/galleries`, `/verify` (busca) e `/verify/[publicId]` (três estados, leitura da etiqueta), mais
  `robots.txt` e `sitemap.xml`. Conteúdo público no banco (migration `20261021500000_phase7_public_content`:
  ArtistProfile/ArtistEntry/Publication/GalleryPublicProfile/GalleryItem/NewsArticle/AgendaEvent) —
  editável desde 2026-10-22 (`/admin/content`, `/profile/public`, `/gallery/public`; `scripts/seed-public-demo.ts` semeia um exemplo LOCAL).
  Catraca `handoff-screens` com 65 telas pendentes (apps mobile, Web Colecionador/Galeria, Entrar/Cadastro
  novos). Divergências por página no relatório de cada lote em `docs/HANDOFF-2026-10-21.md` §5.
  **Próximas (na época):** Fase 2 (celular + código, login social), Fase 4 (oferta em 5 etapas, checkout, carteira),
  Fase 3 (captura guiada), Fase 6 (galeria), Fase 5 (mensagens, comunidade, push).
- **2026-10-21 — Handoff de design completo recebido; Fase 0 dele feita.** Pacote em
  `houseart-design/handoff/` (site, home, marketplace, obra, oferta, artista, galeria(s), verificar,
  entrar/cadastro, apps Colecionador/Galeria/Artista, Web Colecionador/Galeria, DS, pitch). Entraram:
  os 5 tokens `--ha-brand-*` (só nas marcas de linguagem), a marca real do cliente (`public/brand/`,
  `HouseArtLogo` por versão/tom/altura pela tabela §4.5 do handoff, `LanguageMark`, ícone do app =
  `simbolo_color`), e a catraca `lib/architecture/handoff-screens.ts` (72 telas pendentes; só
  diminui). Diagnóstico, ordem de fases e o que depende do Moacy: `docs/HANDOFF-2026-10-21.md`.
  **Cai a decisão 13 do build** (comunidade e agenda agora têm telas). Mobile (Expo) é decisão aberta.
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
  ligadas, `STRIPE_ENV=mock` + `STRIPE_MOCK_ALLOWED=1`, provedores `mock`. **Blob (2026-10-21, depois do Git conectado):** o store privado `houseart-private` está
  ligado ao projeto, mas a Vercel gerou a env com o nome `BLOB_PRIVATE_READ_WRITE_TOKEN_READ_WRITE_TOKEN`
  (prefixo digitado com o nome inteiro) e o `houseart-public` ficou sem token — o código aceita o
  alias (`privateStoreToken`) e, sem store público, guarda as derivadas no store privado sob
  `public/<key>` e as serve por `/api/public/media/<key>` (cache imutável). **Upload conferido em
  produção** com a conta de teste `smoke.artista@houseart.test` (login → obra → foto 1600×1200 →
  derivada servida 200 `image/jpeg`); apagar a conta e a obra 1 quando não precisar mais. Conector Supabase: `apply_migration` e blocos com `$$` dão timeout — `$fn$` e
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
1. Blob: o alias da env funciona, mas é gambiarra — na Vercel, renomear
   `BLOB_PRIVATE_READ_WRITE_TOKEN_READ_WRITE_TOKEN` para `BLOB_PRIVATE_READ_WRITE_TOKEN` (ou
   reconectar o store com o prefixo `BLOB_PRIVATE`) e ligar o `houseart-public` ao projeto para
   nascer `BLOB_READ_WRITE_TOKEN`; sem ele as derivadas passam pelo app em vez do CDN do Blob.
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
