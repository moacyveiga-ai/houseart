# Produção — o que falta e como fazer (2026-10-21)

Produção: https://houseart-housemapp.vercel.app · projeto Vercel `houseart` (time `housemapp`) ·
repositório `moacyveiga-ai/houseart` · Supabase `houseart` (ref `zqxkwaivqqlkocbmdvch`).

## Feito pelo agente
- **2026-10-22 — posse das tabelas:** o schema inicial foi criado pelo conector como `postgres`, e o `migrate deploy` do build (papel `houseart_app`) só conseguia CRIAR tabelas, não ALTERAR as existentes (`must be owner of table AccessCode`, deploy `a6f97f0` vermelho). Todas as tabelas, sequências e funções de `public` passaram a `houseart_app` (`ALTER … OWNER TO`), a migration `20261022100000_phase2_access` foi aplicada à mão como `postgres` e marcada aplicada em `_prisma_migrations`; redeploy em seguida. Regra: toda migration nova é aplicada pelo build, como de costume.
- Repositório, push da `main`, projeto Vercel com todas as envs, banco com schema e seeds, admin,
  `APP_URL`, primeiro deploy e correção do login.

## Para o Moacy (o conector não tem permissão)

### 1. Conectar o projeto Vercel ao GitHub — FEITO (2026-10-21)
Push na `main` dispara o build sozinho.

### 2. Blob stores — FEITO com ressalva (2026-10-21)
Os dois stores existem e o upload foi conferido em produção (obra criada, foto enviada, derivada
servida em `/api/public/media/...`). O que ficou torto, e vale arrumar com calma:
- `houseart-private` foi conectado com o prefixo digitado como nome inteiro, então a env se chama
  `BLOB_PRIVATE_READ_WRITE_TOKEN_READ_WRITE_TOKEN`. O código aceita esse nome. Para limpar:
  Settings → Environment Variables → criar `BLOB_PRIVATE_READ_WRITE_TOKEN` com o mesmo valor
  (copiar do store em Storage → houseart-private → Tokens) e apagar a comprida → Redeploy.
- `houseart-public` está conectado mas sem `BLOB_READ_WRITE_TOKEN` (só `BLOB_STORE_ID`). Em
  Storage → houseart-public → Connect Project → projeto `houseart`, prefixo em branco → confirmar
  que nasceu `BLOB_READ_WRITE_TOKEN` → Redeploy. Até lá as fotos públicas são servidas pelo app
  (funciona, só não usa o CDN do Blob).
- Conta de teste no banco de produção: `smoke.artista@houseart.test` (usuário 2, obra 1). Apagar
  quando não precisar mais.

### 3. E-mail (código de login, OTP de proposta, convites)
Envs de Production: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
(ex.: Resend/SES/Google Workspace). Sem elas, só login por senha funciona. Redeploy.

### 4. Senhas geradas nesta sessão (trocar)
- Admin `moacyveiga@gmail.com`: senha redefinida em 2026-10-22 a pedido do Moacy (enviada no chat); trocar em Perfil.
- Papel `houseart_app` no Supabase: SQL Editor → `ALTER ROLE houseart_app PASSWORD '<nova>';`
  → editar `DATABASE_URL` e `DIRECT_URL` na Vercel com a senha nova → Redeploy. (2026-10-22: o agente
  não fez — as envs são sensíveis e ilegíveis pelo conector, e o pooler não é alcançável daqui para
  testar a senha nova antes de trocar; fazer pelo painel com os dois valores à mão evita derrubar a
  produção por um erro de URL.)

### 5. Domínio próprio
Vercel → Settings → Domains → adicionar (ex.: `app.houseart.com.br`) → DNS no registrador →
trocar `APP_URL` para a URL final → Redeploy.

### 6. Repositório na org Housemap (opcional)
Criar `Housemap/houseart` vazio (2026-10-22: a conta do agente segue sem admin na org — 403) → `git remote set-url origin git@github.com:Housemap/houseart.git`
→ `git push -u origin main` → Vercel → Settings → Git → reconectar.

### 7. Acesso (Fase 2 do handoff)
- Login social: criar os apps e colocar `OAUTH_<GOOGLE|APPLE|FACEBOOK|LINKEDIN>_CLIENT_ID/SECRET` na Vercel; redirect URI `<APP_URL>/api/auth/oauth/<provedor>/callback`. Sem a chave o botão aparece "Em breve".
- SMS: `SMS_PROVIDER=twilio` + `TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM`; sem eles o código do celular não sai (fica no log sem o código) e o cadastro trava no passo do celular.
- Texto jurídico de `/terms` e `/privacy` (hoje provisórios).

### 8. Avisos no celular (Fase 5 do handoff) — FEITO (2026-10-22)
- Chaves VAPID geradas e gravadas na Vercel (`WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY` sensível, `WEB_PUSH_SUBJECT` = URL da Vercel). Ao ter domínio próprio, trocar o `WEB_PUSH_SUBJECT` pelo `mailto:` ou URL do domínio (não exige gerar chaves novas).
- O push só chega em HTTPS com permissão do navegador; o toggle fica em `/notifications`.

## Depois do MVP (produto)
Stripe real (`STRIPE_ENV=live`, chaves e webhook; remover `STRIPE_MOCK_ALLOWED`), KYC real,
etiquetas NTAG 424 reais (`MARKER_VENDOR=ntag424` + master key), carimbo do tempo, âncora,
frete/seguro, telas do pacote de design que não vieram (site público, galeria, colecionador, app).
