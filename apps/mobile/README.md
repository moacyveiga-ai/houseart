# HouseArt — app mobile (Expo)

Um binário, três modos: Colecionador, Galeria/Consultor e Artista, decididos pelo
perfil ativo da conta (`activeProfileKind` de `GET /api/auth/me`). **M0 = casca:**
login nativo, sessão por bearer no secure store, abas por perfil abrindo as
jornadas web dentro de uma WebView com a sessão, sair, push preparado. As telas
nativas dos protótipos (`houseart-design/handoff/designs/HouseArt App *.dc.html`)
entram por fase, substituindo cada WebView. **Fase 1 do App Colecionador (feita):**
Explorar (feed e descobrir), Página da obra, Minha coleção, Favoritos e curtidos,
Mensagens e Conversa, Busca. **Fase 2 (feita):** Fazer oferta em 5 etapas,
Sua oferta / Contraproposta recebida, Comprar direto, Comunidade (feed, post,
comentários, enquete, evento), badge de não lidas em Mensagens e a Fraunces
embarcada. **App Galeria (feito):** Painel do dia, Acervo, Gestão do anúncio,
Negócios (Ofertas recebidas · Vendas até o repasse · Regras de ofertas), a
venda até o repasse, Equipe, Artistas representados e Conta da galeria. **App Artista (feito):** Início do artista, Obras, Nova obra ·
câmera guiada (com `expo-image-picker`), Vincular etiqueta, Carteira de
escrituras e Avisos — ver "O que é nativo" abaixo. **Telas restantes (feitas):**
Compras e Acompanhar compra, Confirmar recebimento, Vendas do colecionador,
Cadastrar obra, Vender esta obra, Carteira e cartões, Pix para receber vendas e
Verificar obra — ver "Telas restantes" abaixo.

Pacote **independente** do root (não está em `workspaces`; o `npm install` do root
não o instala; o `tsconfig.json` e o ESLint do root o excluem). Nada aqui importa
`lib/`, `app/` ou `components/` do root — a ponte é a API.

## Rodar

```bash
cd apps/mobile
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use   # Node 22
npm install
npx expo start            # QR para o Expo Go ou um dev build; `a` Android, `i` iOS
npm run typecheck         # tsc --noEmit
```

> `expo-secure-store`, `expo-notifications` e `@react-native-cookies/cookies` têm
> código nativo: o **Expo Go** serve para navegar, mas push e cookie no Android
> pedem um *development build* (`npx expo run:android` / `run:ios`, ou EAS abaixo).

### Apontar para o dev local

O app lê `EXPO_PUBLIC_API_URL` (inlinada pelo Metro no build); sem ela vale
`extra.apiUrl` do `app.json` (produção, `https://houseart-housemapp.vercel.app`).

```bash
# no root: PORT=3019 npm run dev   (ou npm run dev:3019)
EXPO_PUBLIC_API_URL=http://192.168.0.10:3019 npx expo start
```

Use o IP da máquina na rede do celular (não `localhost`). Em `http://` o cookie da
WebView sai sem `Secure` (só em dev). Android bloqueia tráfego HTTP em claro no
release — em dev build funciona; produção é sempre `https`.

### Build com EAS (sem credenciais neste repo)

```bash
npm install -g eas-cli
eas login
eas build:configure      # cria eas.json e grava extra.eas.projectId no app.json
eas build -p android --profile preview
eas build -p ios --profile preview
```

Credenciais (keystore, certificados Apple) ficam na conta EAS, nunca no
repositório. O `projectId` do EAS também é o que `expo-notifications` usa para
emitir o token de push.

## Como funciona

| Peça | Onde | O quê |
| --- | --- | --- |
| Base da API | `src/config.ts` | `API_URL` (env → `extra.apiUrl`), `SESSION_COOKIE`, `CLIENT_HEADER` (`x-houseart-client: mobile`), `PUSH_API_READY` |
| Cliente HTTP | `src/api/client.ts` | `fetch` com `Authorization: Bearer <token>` em toda chamada |
| Token | `src/auth/token-store.ts` | `expo-secure-store` (64 hex, validado) |
| Cookie da WebView | `src/auth/cookies.ts` | `CookieManager.set` de `houseart_session=<token>` só para o host da API (`Secure` em https; `HttpOnly` não é possível no cliente — aceito) |
| Sessão | `src/auth/session.tsx` | `SessionProvider`/`useSession`: login por senha, código por e-mail (`/api/auth/code/start` + `/verify`), `GET /api/auth/me`, `GET/POST /api/profiles`, sair |
| Abas por perfil | `src/nav/tabs.ts`, `app/(tabs)/_layout.tsx` | Colecionador = Explorar · Coleção · Comunidade · Mensagens · Perfil (a ordem do protótipo; as quatro primeiras nativas, `path: null`; a aba Mensagens leva o badge de `GET /api/messages/unread`, consultado a cada 30 s com o app em primeiro plano — `src/api/unread.ts`); Galeria/Consultor = Início · Acervo · Vendas · Mensagens · Comunidade (as cinco nativas: Início, Acervo e Vendas por `NATIVE_FOR`/`isNativeTab` — Vendas segue WebView para quem não é galeria/consultor); Artista = Início · Obras · Escrituras · Mensagens · Avisos (as cinco nativas: Início, Obras, Escrituras e Avisos também por `NATIVE_FOR`; Perfil pelo avatar do Início → `/settings`). As abas fora do perfil recebem `href: null`; aba nativa desenha o próprio topo (`headerShown: false`) |
| WebView | `src/ui/WebScreen.tsx` | Abre a rota do site com `sharedCookiesEnabled`; injeta a classe `ha-shell--embedded` no `<html>` e um CSS que esconde `.ha-topbar`, `.ha-sidebar` e `.ha-ticker` **só no app** (o web não muda); `houseart://` vira navegação do app, link de outro host abre no navegador; cair em `/login` = sessão morta → sair |
| Perfil nativo | `src/ui/ProfileScreen.tsx` | Dados da conta, toggle "Avisos no celular" (`src/push/usePushToggle.ts`, o mesmo da tela Avisos; o token Expo do aparelho fica no secure store), "Minha conta (site)", trocar de perfil, Sair |
| Push | `src/push/register.ts` | Registra o token do Expo; o envio ao servidor espera `PUSH_API_READY` |

Fluxo das portas (`app/_layout.tsx`, `Gate`): sem token → `/(auth)/login`; com
token e várias contas de perfil sem uma ativa → `/profiles`; senão → `/(tabs)`.

### Sair

`POST /api/auth/logout` (bearer + o cookie do pote do app) e depois apaga o
secure store e os cookies. A rota hoje só lê o cookie — ver "Ajustes de API".

## O que é nativo e o que ainda é WebView

Fonte das telas: `houseart-design/handoff/designs/HouseArt App Colecionador.dc.html`
(textos em pt-BR como lá; cores só de `src/theme.ts`, que espelha `app/ds/tokens.css`).

| Tela (protótipo) | Rota do app | Fonte | API |
| --- | --- | --- | --- |
| Explorar · feed / descobrir | aba `explore` | `src/screens/ExploreScreen.tsx`, `DiscoverDeck.tsx`, `explore-core.ts` | `GET /api/collector/explore`, `POST /api/community/reactions` |
| Página da obra | `/artwork/[publicId]` (`?mine=1` quando vem da coleção) | `src/screens/ArtworkScreen.tsx` | `GET /api/public/artworks/[publicId]`, `POST /api/messages` (Conversar) |
| Minha coleção | aba `wallet` (título "Coleção" para o colecionador) | `src/screens/CollectionScreen.tsx` | `GET /api/collector/wallet`, `GET /api/collector/favorites` |
| Favoritos e curtidos | `/favorites?tab=saved\|liked` | `src/screens/FavoritesScreen.tsx` | `GET /api/collector/favorites`, `POST /api/community/reactions` |
| Mensagens | aba `messages` | `src/screens/MessagesScreen.tsx` | `GET /api/messages?q=` |
| Conversa com galeria | `/messages/[id]` | `src/screens/ConversationScreen.tsx` | `GET /api/messages/[id]?after=` (5 s), `POST /api/messages/[id]` |
| Busca | `/search` | `src/screens/SearchScreen.tsx` | `GET /api/public/search?q=` |
| Fazer oferta (5 etapas) | `/artwork/[publicId]/offer` | `src/screens/market/OfferScreen.tsx`, `offer-core.ts` | `GET /api/public/artworks/[publicId]`, `GET/PATCH /api/auth/identity`, `POST /api/auth/phone/{start,verify}`, `GET/POST /api/collector/payment-methods`, `GET /api/public/shipping-quote`, `POST /api/public/offers`, `POST /api/public/offers/[code]/confirm` |
| Sua oferta · Contraproposta recebida | `/offer/[code]` | `src/screens/market/OfferStatusScreen.tsx` | `GET /api/collector/offers/[code]`, `POST /api/public/offers/[code]/{reply,retract}`, `POST /api/messages` (Conversar) |
| Comprar direto | `/artwork/[publicId]/buy` | `src/screens/market/CheckoutScreen.tsx`, `checkout-core.ts` | `GET /api/public/artworks/[publicId]`, `GET /api/public/shipping-quote`, `GET/POST /api/collector/payment-methods`, `POST /api/public/checkout` |
| Comunidade · Comentários · Novo post | aba `community` | `src/screens/community/{CommunityScreen,CommentsSheet,Composer}.tsx`, `community-core.ts` | `GET /api/public/community/feed?tab=`, `GET /api/public/community/comments`, `POST /api/community/{posts,comments,reactions}`, `POST /api/community/polls/[id]/vote`, `GET /api/collector/wallet` (obra marcada) |

### App Galeria (GALLERY e ADVISOR)

Fonte das telas: `houseart-design/handoff/designs/HouseArt App Galeria.dc.html`.
Todas as chamadas são JSON; o piso do mandato nunca chega ao app (o servidor
recusa o preço abaixo dele e o app só mostra a mensagem).

| Tela (protótipo) | Rota do app | Fonte | API |
| --- | --- | --- | --- |
| Galeria · painel do dia | aba `home` | `src/screens/gallery/DayPanelScreen.tsx` | `GET /api/gallery/panel` |
| Acervo | aba `artworks` (`?filter=`) | `src/screens/gallery/InventoryScreen.tsx`, `gallery-core.ts` | `GET /api/gallery/inventory` |
| Cadastrar obra | WebView `/artworks/new` (sem design próprio no app) | — | — |
| Gestão do anúncio | `/artworks/[id]/listing` | `src/screens/gallery/ListingScreen.tsx` | `GET /api/gallery/artworks/[id]`, `PATCH /api/artworks/[id]/listing` |
| Ofertas recebidas | aba `sales` (`?tab=offers`) | `src/screens/gallery/SalesScreen.tsx`, `OffersSection.tsx` | `GET /api/offers`, `POST /api/offers/[id]/{accept,refuse,counter}` |
| Vendas até o repasse | aba `sales` (`?tab=deals`) · `/deal/[id]` | `SalesScreen.tsx`, `DealScreen.tsx` | `GET /api/gallery/deals`, `POST /api/deals/[id]/{sign,shipping}` |
| Regras de ofertas | aba `sales` (`?tab=rules`) · `/sales/rules` | `RulesSection.tsx`, `app/sales/rules.tsx` | `GET/PUT /api/gallery/rules` |
| Equipe | `/gallery/team` | `src/screens/gallery/TeamScreen.tsx` | `GET/POST /api/gallery/team`, `PATCH/DELETE /api/gallery/team/[id]`, `DELETE /api/gallery/team/invites/[id]` |
| Artistas representados | `/gallery/artists` | `src/screens/gallery/ArtistsScreen.tsx` | `GET/POST /api/gallery/artists` |
| Conta, equipe e repasses | `/gallery/account` | `src/screens/gallery/AccountScreen.tsx` | `GET /api/gallery/team`, `GET /api/gallery/artists` (Pix e cartões abrem as telas nativas `/sales/payout` e `/wallet/cards`; plano, senha e ajuda abrem o site) |
| Compartilhar obra | folha nativa (`Share`) em Gestão do anúncio ("Enviar a um cliente") | — | — |

**Papel na equipe da galeria.** `GET /api/auth/me` devolve `teamRole`
(`ADMIN` · `SALES` · `INVENTORY`, `null` fora de uma equipe de galeria), guardado
em `me.teamRole` (`src/auth/session.tsx`). `src/screens/gallery/role-core.ts`
(puro, as mesmas listas de `lib/offers/seller-role-core.ts` do root) decide o
que aparece: **Acervo** não vê Aceitar · Contrapropor · Recusar (`OffersSection`
mostra o motivo), não muda preço, "Aceita ofertas" nem "Pausar" (`ListingScreen`
desabilita e explica), não tem a aba Regras nem Equipe; **Vendas** responde e
gere o anúncio, mas sem Regras e sem Equipe. `/sales/rules` aberto por link
mostra só o motivo; `/gallery/team` vira só leitura (sem convidar nem abrir a
pessoa); o atalho Equipe do painel e a linha Equipe da Conta somem. O servidor
segue a autoridade: um 403 ainda aparece como mensagem.

Chamadas em `src/api/gallery.ts`. Rotas novas no root para o app (finas, sobre
`lib/gallery`, `lib/artworks`, `lib/deals`): `GET /api/gallery/panel`
(`{ panel: { dateLabel, name, initials, kpis, actions, top } }`),
`GET /api/gallery/inventory` (`{ items, counts, summary }` — o `InventoryItem`
do web com `listing` nas obras à venda), `GET /api/gallery/artworks/[id]`
(`{ artwork, listing | null, rules | null }`; fora do escopo = 404) e
`GET /api/gallery/deals` (`{ deals }`, o `DealView` do web; 404 sem
`FLAG_DEALS`). Prova: `test/integration/gallery-mobile-api.integration.test.ts`.

Decisões onde o protótipo da galeria não bate com a API: o painel mostra o
nome da pessoa (não o da galeria) e não tem Agenda nem KPI de variação "vs.
mês anterior" (sem dado); os atalhos são Nova obra · Publicar post · Equipe ·
Ver marketplace ("Criar evento" vive no composer da Comunidade); o acervo não
tem "salvos" nem "curtidas" por obra ("—" na gestão do anúncio); os chips são
os do web (Autenticadas entra; "Em certificação" e "Rascunhos" seguem); a
gestão do anúncio não tem "Vendida fora" (sem rota) e "Editar cadastro" abre o
wizard web; nas ofertas o comprador aparece como a API o descreve ("Colecionador
verificado, Cidade"), sem histórico de compras, e não há "Conversar com" por
oferta (a API não expõe o comprador para abrir a conversa — a aba Mensagens
traz a conversa quando ela existe); a contraproposta sugerida é o meio entre
oferta e preço, arredondado a R$ 500, e aceita uma mensagem; as etapas da
venda são as seis do produto (oferta aceita → garantia → documentação e
assinatura → transporte → entrega e etiqueta → escritura), com "Assinar o
termo" e "Registrar envio" como ações da galeria (sem "Embalar e condition
report" nem agenda de coleta — a API não tem); a divisão da venda é a que o
negócio registra (sem o "50 % do líquido" fixo); a equipe não tem "aprovação
da diretora acima de R$ 50 mil"; a conta da galeria é um menu (dados da
galeria, página pública, endereço e horários, Face ID e aparelhos não existem
na API).

### App Artista (ARTIST)

Fonte das telas: `houseart-design/handoff/designs/HouseArt App Artista.dc.html`.
A única dependência nova é **`expo-image-picker` ~17.0.11** (câmera e galeria;
permissões no plugin do `app.json`).

| Tela (protótipo) | Rota do app | Fonte | API |
| --- | --- | --- | --- |
| Início do artista | aba `home` | `src/screens/artist/ArtistHomeScreen.tsx`, `artist-core.ts` | `GET /api/artist/home` |
| Obras | aba `artworks` (`?filter=`) | `src/screens/gallery/InventoryScreen.tsx` (`artist`) | `GET /api/gallery/inventory` (escopo por membro) |
| Nova obra · câmera guiada + Ficha rápida | `/artworks/new` (`?id=` continua um rascunho) | `src/screens/artist/NewArtworkScreen.tsx` | `POST /api/artworks`, `GET/PATCH /api/artworks/[id]`, `POST /api/artworks/[id]/media` (multipart: `kind` + `file`), `POST /api/artworks/[id]/read-photos`, `POST /api/artworks/[id]/duplicates/[checkId]`, `POST /api/artworks/[id]/submit` |
| Vincular etiqueta | `/certification/link/[artworkId]` | `src/screens/artist/LinkMarkerScreen.tsx`, `src/nfc/reader.ts` | `GET /api/artist/artworks/[id]/link`, `POST /api/markers/link`, `POST /api/certificates/[id]/sign` |
| Carteira de escrituras | aba `certification` (título "Escrituras") | `src/screens/artist/DeedsScreen.tsx` | `GET /api/artist/certificates` |
| Avisos | aba `notifications` | `src/screens/NotificationsScreen.tsx`, `src/push/usePushToggle.ts` | `GET/POST /api/notifications`, `POST /api/notifications/[id]/read`, `POST/DELETE /api/notifications/push` |
| Verificar obra · Confirmar recebimento | `/verify` · `/purchases/[id]/receive` (nativas, ver "Telas restantes") | `src/screens/collector/{VerifyScreen,ReceiveScreen}.tsx` | — |
| Onboarding | sem design utilizável no mapa — não feito | — | — |

Rotas novas no root (finas, sobre `lib/dashboard`, `lib/certificates`,
`lib/artworks`, `lib/physical-markers`): `GET /api/artist/home`
(`{ ok, home: { dateLabel, name, initials, kpis, actions, recent } }`),
`GET /api/artist/certificates` (`{ ok, items: [{ artworkId, certificateId,
title, publicId, coverUrl, status, stage, stageLabel, action, actionLabel,
version }], orders }`; 404 sem `FLAG_CERTIFICATES`) e
`GET /api/artist/artworks/[id]/link` (`{ ok, artwork: { id, title, status,
publicId }, certificateId, signed, issued, simulateAllowed }`; 404 fora do
escopo ou sem `FLAG_CERTIFICATES`/`FLAG_PHYSICAL_MARKERS`). Nenhuma leva hash,
assinatura, referência do cofre nem o mandato. Prova:
`test/integration/artist-mobile-api.integration.test.ts`.

**NFC:** este build não lê a etiqueta (`react-native-nfc-manager` exige
código nativo e dev build, e não foi adicionado). `src/nfc/reader.ts` é o ponto
de extensão (`TagReader`, hoje só `manualReader`): a tela de vincular aceita a
URL da etiqueta colada/digitada (o mesmo campo do web) e, quando a API diz que
o ambiente aceita (`simulateAllowed`: `MARKER_VENDOR=mock` fora de produção),
"Simular leitura" com o UID de uma etiqueta do kit. Para plugar o NFC:
`npx expo install react-native-nfc-manager`, o plugin no `app.json` (iOS:
`NFCReaderUsageDescription` e o entitlement de NDEF), implementar o leitor
`nfc` em `src/nfc/reader.ts` (NDEF → primeiro registro URI → `{ url }`) e
devolvê-lo em `tagReader()` quando `NfcManager.isSupported()`; build com
`npx expo run:ios|android` ou EAS.

Decisões onde o protótipo não bate com a API: a barra do artista segue o
conjunto do app (Início · Obras · Escrituras · Mensagens · Avisos), não as
quatro do protótipo (Início · Carteira · Verificar · Avisos); o Início ganhou os
quatro números do web Início abaixo de "Suas obras" e "Olá, <nome>" usa o nome
da conta; a câmera é a do sistema (`expo-image-picker`), sem moldura ao vivo
sobre o vídeo — a moldura, o cartão de cor e o ponto da macro aparecem no
quadro do slot, com a foto enviada dentro dele; são os **dez** slots do web (os
seis obrigatórios do protótipo e quatro opcionais que se pulam); "Foco e luz
bons" é o veredito do servidor (`quality`), e foto desfocada pede refazer; a
leitura assistida ("Preencher com as fotos") e a decisão sobre obra parecida
entram na Ficha rápida; "Enviar e vincular etiqueta" envia para certificação e
abre o vincular, que sem kit entregue responde o erro do servidor; sem anel
pulsante animado; a Carteira do artista lista as obras em certificação
(etapa e próxima ação) e as escrituras emitidas (ID e versão), sem "Valor
registrado", "Titular desde", Vender/Transferir/Segurar nem o cartão "chega
hoje" (são da carteira do colecionador); "Emitir" abre a Certificação do site;
Avisos ganhou o switch "Avisos no celular" e "Marcar todos como lidos".

Peças comuns: `src/ui/kit.tsx` (ícone, parede, avatar, chip, barra do topo,
loading/erro/toast, `Display` em Fraunces), `src/ui/forms.tsx` (campo, cartão
de opção, linha chave·valor, segmentos de passo, toggle, bottom sheet),
`src/ui/CardForm.tsx` (Adicionar cartão), `src/ui/format.ts` (R$, parcela,
ficha, iniciais, URL absoluta da mídia), `src/api/hooks.ts` (`useApi`),
`src/api/reactions.ts`, `src/api/market.ts` (oferta, compra, cartões,
identidade, cotação), `src/api/unread.ts`, `src/api/types.ts` (DTOs),
`src/ui/share.ts` (Share nativo). A fonte de exibição é a **Fraunces**
embarcada (`assets/fonts/Fraunces-{Regular,Italic,SemiBold}.ttf`, OFL,
build estático do Google Fonts; registrada por `useFonts` em `app/_layout.tsx`
com os nomes de `fonts.display` de `src/theme.ts`; o serif do sistema fica
como fallback enquanto carrega ou se falhar).

### Telas restantes (Colecionador, e comuns aos três perfis)

Fonte: `HouseArt App Colecionador.dc.html` (Minha coleção › Compras e Vendas,
`compra`, `vender`, `cadobra`, `carteira`, sheet `pix`) e `HouseArt Verificar` /
`Verificacao` para Verificar. Telas em `src/screens/collector/`, regras puras em
`collector-core.ts`, chamadas em `src/api/collector.ts`. O Perfil (todos os
perfis) ganhou os atalhos Compras · Carteira e cartões · Pix para receber vendas ·
Verificar obra.

| Tela (protótipo) | Rota do app | Fonte | API |
| --- | --- | --- | --- |
| Compras (compras + ofertas abertas) | `/purchases` (aba "Compras" da coleção) | `PurchasesScreen.tsx` | `GET /api/collector/purchases`, `GET /api/collector/offers` |
| Acompanhar compra | `/purchases/[id]` | `PurchaseScreen.tsx` | `GET /api/collector/purchases`, `POST /api/deals/[id]/{escrow,sign}` |
| Confirmar recebimento (leitor escuro) | `/purchases/[id]/receive` | `ReceiveScreen.tsx`, `src/nfc/reader.ts` | `POST /api/deals/[id]/confirm-delivery` (`{ uid, ctr, cmac }` ou `{}` simulado) |
| Vendas do colecionador | `/sales/collector` (aba "Vendas" da coleção; a aba `sales` também, para o perfil colecionador); "Em andamento" abre `/deal/[id]?as=collector` (a `DealScreen` da galeria: assinar o termo em ESCROW, registrar envio em DOCUMENTS) | `CollectorSalesScreen.tsx` + `gallery/OffersSection.tsx` (`beforeAccept` pede o Pix) + `gallery/DealScreen.tsx` | `GET /api/offers`, `GET /api/collector/sales`, `POST /api/offers/[id]/{accept,refuse,counter}`, `POST /api/deals/[id]/{sign,shipping}`, `GET /api/member/payout-account` |
| Cadastrar obra | `/wallet/register` → `/artworks/new?id=…&owner=collector` | `RegisterArtworkScreen.tsx`, `artist/NewArtworkScreen.tsx` (modo colecionador: "Enviar para certificação" e volta à coleção) | `GET /api/public/search?q=`, `POST /api/collector/artworks` e as rotas da câmera |
| Vender esta obra | `/wallet/sell/[id]` ("Vender esta obra" da página da obra) | `SellScreen.tsx` | `GET /api/collector/wallet`, `GET /api/collector/artworks/[id]/sell-estimate`, `POST /api/collector/artworks/[id]/{sell,services}`, `GET /api/member/payout-account` |
| Carteira e cartões | `/wallet/cards` (ícone da coleção; Conta da galeria) | `WalletCardsScreen.tsx`, `src/ui/CardForm.tsx` | `GET/POST /api/collector/payment-methods`, `PATCH/DELETE /api/collector/payment-methods/[id]`, `GET /api/collector/purchases`, `GET /api/member/payout-account` |
| Pix para receber vendas | `/sales/payout` (também "Pix para repasses" da galeria) | `PayoutScreen.tsx` | `GET/PUT/DELETE /api/member/payout-account` |
| Verificar obra | `/verify` (`?id=HA-…` abre direto) | `VerifyScreen.tsx` | `GET /api/public/certificates?id=` ou `?artist=&title=&year=`, `GET /api/v1/certificates/[publicId]`, `POST /api/public/certificates/[publicId]/read` |

Rotas novas no root (finas): `GET /api/collector/purchases` → `{ ok, deals:
PurchaseDeal[] (o DealView do web SEM a repartição), simulateAllowed }` (401 sem
sessão, 404 sem `FLAG_DEALS`, só os negócios em que a pessoa é a compradora);
`GET /api/collector/artworks/[id]/sell-estimate?listPriceCents=` → `{ ok,
estimate: { listCents, buyerFeeCents, buyerPaysCents, sellerFeeCents,
royaltyCents, appreciationCents, netCents }, registeredCents }` (a
`sellEstimate` do web; 404 para obra que a pessoa não tem; 400 sem preço);
`GET /api/public/certificates?id=` ou `?artist=&title=&year=` → `{ ok, results:
[{ publicId, title, year, artist, technique, cover, verdict }] }` (a busca
pública do `/verify`); `POST /api/public/certificates/[publicId]/read` com `{
uid, ctr, cmac, tt? }` → `{ ok, read: { authenticated, tamper } }` (a mesma
gravação da visita a `/verify/[id]?uid…`; freio de 60 por hora por IP). Prova:
`test/integration/mobile-api-2.integration.test.ts`.

O mínimo de "Vender esta obra" é digitado e enviado em `POST …/sell`; nenhuma
chamada o lê de volta e a tela o esquece ao publicar. Divergências em
`docs/HANDOFF-2026-10-21.md` §5 ("telas restantes nativas"); a principal: o lado
vendedor de um negócio do colecionador ("Assinar o termo", "Registrar envio")
não funciona pela API de hoje (`dealContext` trata todo colecionador como
comprador) — "Em andamento" é só leitura.

**Continua em WebView** (`/web?path=…&title=…`, `app/web.tsx`, só caminhos do
site): perfil do artista e da galeria (`/e/artist/…`, `/e/gallery/…`), notícia
inteira (`/e/news/[slug]`, aberta pelo "Ler" da Comunidade), Minha conta
(`/account`), no App Artista Vendas (`/sales`) e Emitir (`/certification`), a
aba `wallet` dos perfis que não são o colecionador (a "Carteira" web) e, no App
Galeria, Cadastrar obra (`/artworks/new`), Editar cadastro
(`/artworks/[id]/edit`), Plano e cobrança (`/billing`), Alterar senha
(`/recover-password`) e a página pública do artista (`/e/artist/[slug]`).

Decisões onde o protótipo não bate com a API: sem contador de curtidas nem
comentários em obra (a API não conta); "Desenho" não existe no catálogo (Obra
sobre papel no lugar); o deck não tem "Compartilhar" no cartão (fica no feed e
na obra); a obra não tem zoom por ponto (toque alterna a parede cheia); sem
"Denunciar" nem "Enviar foto" na conversa (sem API); respostas rápidas são as
do lado comprador; a busca não tem sugestões de pessoas sem consulta (a API
só responde com termo) e "Em alta" são as categorias; buscas recentes vivem só
na sessão do app; KPI "valorização" fica "—" (sem estimativa na API); ícones por Material
Icons do `@expo/vector-icons` no lugar dos Material Symbols.

Decisões da fase 2: a folha "Fazer oferta" do protótipo (um só passo) virou as
**cinco etapas** do fluxo web (Valor · Condições · Identidade · Garantia ·
Revisão) porque a API exige identidade verificada e garantia; as sugestões
(−5/−10/−15 %, arredondadas a R$ 500), a validade 24/48/72 h, a mensagem e a
linha dos 70 % são as do protótipo, mas a recusa é do servidor (regras do
vendedor) — o app só impede enviar abaixo de metade do preço pedido; o
comprador logado com e-mail provado não recebe código (a tela do código só
aparece se a API pedir). "Sua oferta" mostra o nome do vendedor e "Conversar"
só quando a obra pública carrega. Comprar direto: só cartão (sem Pix/boleto
nem parcelas na API), o endereço é só o CEP (sem cadastro de endereços),
"Acompanhar a compra" abre `/purchases` na WebView. Comunidade: sem Instagram
e sem "Guia" escuro; "Seguindo" é o feed filtrado por quem a pessoa segue;
"Responder" só prefixa o @nome; foto = obra marcada ou URL (sem upload);
"Ler" abre a notícia no site. Cartão novo pede os dados na própria tela
(sem a prévia animada do cartão).

## O que falta (fora do M0 e da fase 1)

- **Push via Expo** (ver abaixo): o toggle existe, desligado, com "Em breve".
- **Telas nativas** dos protótipos (29 Colecionador — 14 feitas nas fases 1 e 2 —,
  20 Galeria — 13 feitas, ficam Cadastrar obra (câmera guiada), Instagram, Ler
  notícia e Guia —, 9 Artista — 6 feitas; ficam Onboarding, Verificar obra e
  Confirmar recebimento): cada aba troca a WebView por tela nativa, por
  fase, sobre as mesmas rotas de `app/api/*`. Enquanto isso o app entrega as
  jornadas do site. Compras, Vendas, Cadastrar obra, Vender uma obra, Carteira e
  cartões, Pix e Verificar já são nativas; próximas: Perfil completo, Ler notícia.
- Leitura NFC da etiqueta no app do Artista (`react-native-nfc-manager` num dev
  build; o ponto de extensão é `src/nfc/reader.ts`; hoje cola-se a URL).
- Biometria para reabrir o app (`expo-local-authentication`), deep links
  universais (`https://…/e/artwork/...` → app), tema escuro.
- `eas.json`, `extra.eas.projectId`, ícones por sub-marca, lojas.

## Ajustes de API propostos (lado do root, não feitos aqui)

1. **Push por Expo** — `POST /api/notifications/push` (`lib/notifications/push.ts`,
   `savePushSubscription`) só aceita `endpoint` `https://` (web push por VAPID) e
   responde 503 sem as envs `WEB_PUSH_*`. Proposta: aceitar `endpoint` com o prefixo
   `expo:` (`ExponentPushToken[...]` validado por regex, `keys` ignoradas ou
   `{ p256dh: 'expo', auth: 'expo' }` como o app manda), guardar na mesma
   `PushSubscription` (coluna `kind`/`provider` ou só o prefixo do endpoint), e em
   `pushToUser` ramificar: `https:` → `web-push`; `expo:` → `POST https://exp.host/--/api/v2/push/send`
   (`expo-server-sdk`, lote de até 100, `to`, `title`, `body`, `data: { href }`;
   receipts `DeviceNotRegistered` apagam a linha como o 410 do web push). O `GET`
   que devolve a chave VAPID não precisa mudar; o 503 "Push desligado" deve valer
   só para o ramo web. Depois disso, `PUSH_API_READY = true` em `src/config.ts`.
2. **Logout por bearer** — `app/api/auth/logout/route.ts` lê só o cookie; com o
   bearer (`Authorization`) a sessão não é destruída no servidor. Proposta: ler o
   token também do header (como `getSession` já faz) antes de `destroySession`.
3. (Opcional) `GET /api/auth/me` poderia devolver `profiles` para poupar o
   segundo request a `/api/profiles` no boot do app.
