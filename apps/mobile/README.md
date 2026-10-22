# HouseArt — app mobile (Expo)

Um binário, três modos: Colecionador, Galeria/Consultor e Artista, decididos pelo
perfil ativo da conta (`activeProfileKind` de `GET /api/auth/me`). **M0 = casca:**
login nativo, sessão por bearer no secure store, abas por perfil abrindo as
jornadas web dentro de uma WebView com a sessão, sair, push preparado. As telas
nativas dos protótipos (`houseart-design/handoff/designs/HouseArt App *.dc.html`)
entram por fase, substituindo cada WebView.

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
| Abas por perfil | `src/nav/tabs.ts`, `app/(tabs)/_layout.tsx` | Colecionador = Explorar · Mensagens · Comunidade · Carteira · Perfil; Galeria/Consultor = Início · Acervo · Vendas · Mensagens · Comunidade; Artista = Início · Obras · Certificação · Mensagens · Avisos. As abas fora do perfil recebem `href: null` |
| WebView | `src/ui/WebScreen.tsx` | Abre a rota do site com `sharedCookiesEnabled`; injeta a classe `ha-shell--embedded` no `<html>` e um CSS que esconde `.ha-topbar`, `.ha-sidebar` e `.ha-ticker` **só no app** (o web não muda); `houseart://` vira navegação do app, link de outro host abre no navegador; cair em `/login` = sessão morta → sair |
| Perfil nativo | `src/ui/ProfileScreen.tsx` | Dados da conta, toggle "Avisos no celular" (**Em breve**), "Minha conta (site)", trocar de perfil, Sair |
| Push | `src/push/register.ts` | Registra o token do Expo; o envio ao servidor espera `PUSH_API_READY` |

Fluxo das portas (`app/_layout.tsx`, `Gate`): sem token → `/(auth)/login`; com
token e várias contas de perfil sem uma ativa → `/profiles`; senão → `/(tabs)`.

### Sair

`POST /api/auth/logout` (bearer + o cookie do pote do app) e depois apaga o
secure store e os cookies. A rota hoje só lê o cookie — ver "Ajustes de API".

## O que falta (fora do M0)

- **Push via Expo** (ver abaixo): o toggle existe, desligado, com "Em breve".
- **Telas nativas** dos protótipos (29 Colecionador, 20 Galeria, 9 Artista):
  cada aba troca a WebView por tela nativa, por fase, sobre as mesmas rotas de
  `app/api/*`. Enquanto isso o app entrega as jornadas do site.
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
