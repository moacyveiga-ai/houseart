# Produção — o que falta e como fazer (2026-10-21)

Produção: https://houseart-housemapp.vercel.app · projeto Vercel `houseart` (time `housemapp`) ·
repositório `moacyveiga-ai/houseart` · Supabase `houseart` (ref `zqxkwaivqqlkocbmdvch`).

## Feito pelo agente
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
- Admin `moacyveiga@gmail.com`: entrar e trocar em Perfil.
- Papel `houseart_app` no Supabase: SQL Editor → `ALTER ROLE houseart_app PASSWORD '<nova>';`
  → editar `DATABASE_URL` e `DIRECT_URL` na Vercel com a senha nova → Redeploy.

### 5. Domínio próprio
Vercel → Settings → Domains → adicionar (ex.: `app.houseart.com.br`) → DNS no registrador →
trocar `APP_URL` para a URL final → Redeploy.

### 6. Repositório na org Housemap (opcional)
Criar `Housemap/houseart` vazio → `git remote set-url origin git@github.com:Housemap/houseart.git`
→ `git push -u origin main` → Vercel → Settings → Git → reconectar.

## Depois do MVP (produto)
Stripe real (`STRIPE_ENV=live`, chaves e webhook; remover `STRIPE_MOCK_ALLOWED`), KYC real,
etiquetas NTAG 424 reais (`MARKER_VENDOR=ntag424` + master key), carimbo do tempo, âncora,
frete/seguro, telas do pacote de design que não vieram (site público, galeria, colecionador, app).
