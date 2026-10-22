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
venda até o repasse, Equipe, Artistas representados e Conta da galeria — ver
"O que é nativo" abaixo.

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
| Abas por perfil | `src/nav/tabs.ts`, `app/(tabs)/_layout.tsx` | Colecionador = Explorar · Coleção · Comunidade · Mensagens · Perfil (a ordem do protótipo; as quatro primeiras nativas, `path: null`; a aba Mensagens leva o badge de `GET /api/messages/unread`, consultado a cada 30 s com o app em primeiro plano — `src/api/unread.ts`); Galeria/Consultor = Início · Acervo · Vendas · Mensagens · Comunidade (as cinco nativas: Início, Acervo e Vendas só para GALLERY/ADVISOR, por `NATIVE_FOR`/`isNativeTab` — o `path` fica para o Artista, que ainda abre essas abas na WebView); Artista = Início · Obras · Certificação · Mensagens · Avisos. As abas fora do perfil recebem `href: null`; aba nativa desenha o próprio topo (`headerShown: false`) |
| WebView | `src/ui/WebScreen.tsx` | Abre a rota do site com `sharedCookiesEnabled`; injeta a classe `ha-shell--embedded` no `<html>` e um CSS que esconde `.ha-topbar`, `.ha-sidebar` e `.ha-ticker` **só no app** (o web não muda); `houseart://` vira navegação do app, link de outro host abre no navegador; cair em `/login` = sessão morta → sair |
| Perfil nativo | `src/ui/ProfileScreen.tsx` | Dados da conta, toggle "Avisos no celular" (**Em breve**), "Minha conta (site)", trocar de perfil, Sair |
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
| Conta, equipe e repasses | `/gallery/account` | `src/screens/gallery/AccountScreen.tsx` | `GET /api/gallery/team`, `GET /api/gallery/artists` (Pix, plano, cartões, senha e ajuda abrem o site) |
| Compartilhar obra | folha nativa (`Share`) em Gestão do anúncio ("Enviar a um cliente") | — | — |

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

**Continua em WebView** (`/web?path=…&title=…`, `app/web.tsx`, só caminhos do
site): Cadastrar obra (`/wallet/register`), Vender esta obra (`/wallet`), Compras
(`/purchases` — "Acompanhar a compra" depois da oferta aceita ou do pagamento),
Vendas (`/sales`), perfil do artista e da galeria (`/e/artist/…`,
`/e/gallery/…`), certificado público (`/verify/[id]`), notícia inteira
(`/e/news/[slug]`, aberta pelo "Ler" da Comunidade), Minha conta (`/account`),
todas as abas do perfil Artista, a aba `wallet` dos perfis que não são o
colecionador (a "Carteira" web) e, no App Galeria, Cadastrar obra
(`/artworks/new`), Editar cadastro (`/artworks/[id]/edit`), Pix para repasses
(`/sales/payout`), Plano e cobrança (`/billing`), Carteira e cartões
(`/wallet/cards`), Alterar senha (`/recover-password`) e a página pública do
artista (`/e/artist/[slug]`).

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
  notícia e Guia —, 9 Artista): cada aba troca a WebView por tela nativa, por
  fase, sobre as mesmas rotas de `app/api/*`. Enquanto isso o app entrega as
  jornadas do site. Próximas do Colecionador: Compras/Vendas, Cadastrar obra,
  Vender uma obra, Carteira e cartões, Pix, Perfil completo, Ler notícia.
- Leitura NFC da etiqueta no app do Artista (`react-native-nfc-manager`; hoje o
  web faz por Web NFC/URL em `/certification/link/[artworkId]`).
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
