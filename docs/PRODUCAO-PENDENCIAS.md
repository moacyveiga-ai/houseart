# Produção — o que falta e como fazer (2026-10-21)

Produção: https://houseart-housemapp.vercel.app · projeto Vercel `houseart` (time `housemapp`) ·
repositório `moacyveiga-ai/houseart` · Supabase `houseart` (ref `zqxkwaivqqlkocbmdvch`).

## Feito pelo agente
- Repositório, push da `main`, projeto Vercel com todas as envs, banco com schema e seeds, admin,
  `APP_URL`, primeiro deploy e correção do login.

## Para o Moacy (o conector não tem permissão)

### 1. Conectar o projeto Vercel ao GitHub (push = deploy automático)
Hoje cada deploy precisa ser disparado à mão. Dashboard → projeto `houseart` → Settings → Git →
"Connect Git Repository" → GitHub → `moacyveiga-ai/houseart` → Production Branch `main`.

### 2. Blob stores (fotos de obra e PDFs)
Dashboard → Storage → Create Database → Blob:
- `houseart-public`, acesso **Public** → conectar ao projeto `houseart` (Production) → a Vercel
  cria `BLOB_READ_WRITE_TOKEN` sozinha.
- `houseart-private`, acesso **Private** → NÃO conectar ao projeto (ele sobrescreveria a env);
  copiar o token do store (aba Settings/Tokens) e criar a env `BLOB_PRIVATE_READ_WRITE_TOKEN`
  (Production) em Settings → Environment Variables.
Depois: Deployments → ⋯ → Redeploy.

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
