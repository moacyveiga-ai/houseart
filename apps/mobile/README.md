# HouseArt — app mobile (Expo)

Um binário, três modos: Colecionador, Galeria/Consultor e Artista, decididos pelo
perfil ativo da conta (`activeProfileKind` de `GET /api/auth/me`). **M0 = casca:**
login nativo, sessão por bearer no secure store, abas por perfil abrindo as
jornadas web dentro de uma WebView com a sessão, sair, push preparado. As telas
nativas dos protótipos (`houseart-design/handoff/designs/HouseArt App *.dc.html`)
entram por fase, substituindo cada WebView. **Fase 1 do App Colecionador (feita):**
Explorar (feed e descobrir), Página da obra, Minha coleção, Favoritos e curtidos,
Mensagens e Conversa, Busca — ver "O que é nativo" abaixo.

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
| Abas por perfil | `src/nav/tabs.ts`, `app/(tabs)/_layout.tsx` | Colecionador = Explorar · Coleção · Comunidade · Mensagens · Perfil (a ordem do protótipo; Explorar, Coleção e Mensagens nativas, `path: null`); Galeria/Consultor = Início · Acervo · Vendas · Mensagens · Comunidade; Artista = Início · Obras · Certificação · Mensagens · Avisos. As abas fora do perfil recebem `href: null`; aba nativa desenha o próprio topo (`headerShown: false`) |
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

Peças comuns: `src/ui/kit.tsx` (ícone, parede, avatar, chip, barra do topo,
loading/erro/toast), `src/ui/format.ts` (R$, parcela, ficha, iniciais, URL
absoluta da mídia), `src/api/hooks.ts` (`useApi`), `src/api/reactions.ts`,
`src/api/types.ts` (DTOs), `src/ui/share.ts` (Share nativo).

**Continua em WebView** (`/web?path=…&title=…`, `app/web.tsx`, só caminhos do
site): Fazer oferta (`/e/artwork/[id]/offer`), Comprar direto (`/e/artwork/[id]/buy`),
Cadastrar obra (`/wallet/register`), Vender esta obra (`/wallet`), Compras
(`/purchases`), Vendas (`/sales`), perfil do artista e da galeria (`/e/artist/…`,
`/e/gallery/…`), certificado público (`/verify/[id]`), Comunidade (aba),
Minha conta (`/account`) e todas as abas dos perfis Galeria/Consultor/Artista
(a aba `wallet` desses perfis segue sendo a "Carteira" web).

Decisões onde o protótipo não bate com a API: sem contador de curtidas nem
comentários em obra (a API não conta); "Desenho" não existe no catálogo (Obra
sobre papel no lugar); o deck não tem "Compartilhar" no cartão (fica no feed e
na obra); a obra não tem zoom por ponto (toque alterna a parede cheia); sem
"Denunciar" nem "Enviar foto" na conversa (sem API); respostas rápidas são as
do lado comprador; a busca não tem sugestões de pessoas sem consulta (a API
só responde com termo) e "Em alta" são as categorias; buscas recentes vivem só
na sessão do app; KPI "valorização" fica "—" (sem estimativa na API); a fonte
de exibição (Fraunces) não vem no pacote — serif do sistema até entrar
(`src/theme.ts`, `fonts.display`); ícones por Material Icons do
`@expo/vector-icons` no lugar dos Material Symbols; o badge de não lidas na
aba Mensagens não existe ainda.

## O que falta (fora do M0 e da fase 1)

- **Push via Expo** (ver abaixo): o toggle existe, desligado, com "Em breve".
- **Telas nativas** dos protótipos (29 Colecionador — 8 feitas na fase 1 —,
  20 Galeria, 9 Artista): cada aba troca a WebView por tela nativa, por fase,
  sobre as mesmas rotas de `app/api/*`. Enquanto isso o app entrega as
  jornadas do site. Próximas do Colecionador: oferta em 5 etapas e compra
  direta nativas, Comunidade, Compras/Vendas, Cadastrar obra, Perfil completo.
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
