# Produção — o que falta e como fazer (2026-10-21)

Produção: https://houseart-housemapp.vercel.app · projeto Vercel `houseart` (time `housemapp`) ·
repositório `moacyveiga-ai/houseart` · Supabase `houseart` (ref `zqxkwaivqqlkocbmdvch`).

## Feito pelo agente
- **2026-10-22 — cenário fictício em produção:** contas de `scripts/demo/accounts.sql` aplicadas no Supabase e `scripts/demo/scenario.mjs` rodado contra a produção (de uma Vercel Sandbox, porque o proxy desta sessão não alcança o host). Ficaram: 10 obras (artistas, galeria, consultora e colecionadora), 9 certificados com etiqueta mock, 10 mandatos, 6 propostas (recusada, em negociação, convertidas), 4 negócios (2 concluídos com transferência de titularidade, 1 em garantia, 1 em documentos), 1 laudo, 15 mensagens, 5 posts com reações, comentários e enquete. Logins no `scripts/demo/README.md` (senha `Demo-HouseArt-2026`). Para limpar: apagar os usuários `%.demo@houseart.test` e as obras deles (ou manter como vitrine).
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
Env de Production: `SMTP_URL` (`smtp://usuario:senha@host:porta`, usuário e senha com URL-encode) e
`SMTP_FROM`. **2026-10-23 — TEMPORÁRIO:** gravadas com o Gmail do Moacy (senha de app), o mesmo
SMTP da Housebroker (tirado do `ConfigCanal` dela), só para teste — o Gmail reescreve o remetente
para o endereço autenticado e limita a ~500 envios/dia. Trocar por um SMTP próprio
(Resend/SES/Google Workspace com domínio do HouseArt) e revogar a senha de app quando trocar.

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

### 9. Stripe em modo de teste — LIGADO em produção (2026-10-23)
Envs gravadas na Vercel (Production): `STRIPE_ENV=test`, `STRIPE_TEST_ALLOWED=1`, `STRIPE_SECRET_KEY`
(`sk_test_`, sensível), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_test_`) e `STRIPE_WEBHOOK_SECRET` do
endpoint `https://houseart-housemapp.vercel.app/api/stripe/webhook` (4 eventos `payment_intent.*`).
**Provado ponta a ponta em produção** (sandbox da Vercel, como o navegador faria): SetupIntent pela nossa
API → cartão 4242 confirmado na Stripe só com a chave publicável → cartão salvo (`providerMode=test`, só
marca/últimos 4/`pm_`) → compra direta de "Estudo em vermelho" (R$ 9.800 + frete + seguro) autorizada e
capturada → `Offer` 7 `IN_DEAL`/`CAPTURED`, `Deal` 5 em `ESCROW` → os dois eventos do webhook
(`amount_capturable_updated`, `succeeded`) chegaram e foram gravados em `StripeEvent`. A cobrança aparece
no Dashboard da Stripe (modo Test). Para ir a live: trocar as três chaves por `sk_live_`/`pk_live_`/
`whsec_` do endpoint live, `STRIPE_ENV=live`, remover `STRIPE_TEST_ALLOWED` e `STRIPE_MOCK_ALLOWED`.
Antes disso o código foi provado com um cliente falso injetado nos testes
(`test/integration/stripe-test-mode.integration.test.ts`). Sem chave nada muda — tudo segue no mock.

**Modos** (`lib/stripe/mode-core.ts`): `mock` (sem chave) · `test` (`STRIPE_ENV=test` + `sk_test_…`) ·
`live` (`STRIPE_ENV=live` + `sk_live_…`). Na produção de verdade (`VERCEL_ENV=production`) o mock só
roda com `STRIPE_MOCK_ALLOWED=1` e o teste só com `STRIPE_TEST_ALLOWED=1`; sem elas, toda cobrança
responde 409.

**Ligar o modo de teste na Vercel** (Production):
1. No painel da Stripe, modo **Test**: Developers › API keys → copiar a secret `sk_test_…` e a
   publishable `pk_test_…`.
2. Developers › Webhooks › Add endpoint:
   - URL: `https://houseart-housemapp.vercel.app/api/stripe/webhook`
   - Eventos: `payment_intent.succeeded`, `payment_intent.payment_failed`,
     `payment_intent.canceled`, `payment_intent.amount_capturable_updated`
   - Copiar o *Signing secret* `whsec_…`.
3. Envs (marcar `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` como sensíveis):
   - `STRIPE_ENV=test`
   - `STRIPE_SECRET_KEY=sk_test_…`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…` (lida no servidor e entregue às telas; só vale
     se casar com o modo: `pk_test_` com `sk_test_`)
   - `STRIPE_WEBHOOK_SECRET=whsec_…`
   - `STRIPE_TEST_ALLOWED=1`
   - pode tirar `STRIPE_MOCK_ALLOWED` (só vale em modo mock).
4. Redeploy. O build aplica a migration `20261023100000_stripe_test_mode` (aditiva).
5. Conferir: `/wallet/cards` → "Adicionar cartão" mostra o campo da Stripe (iframe do
   `js.stripe.com`); no painel da Stripe aparecem o Customer e o SetupIntent.

**Cartões de teste** (qualquer validade futura, qualquer CVC, qualquer CEP):
- `4242 4242 4242 4242` — aprova (Visa);
- `5555 5555 5555 4444` — aprova (Mastercard);
- `4000 0000 0000 0002` — recusado (`card_declined`);
- `4000 0000 0000 9995` — sem saldo (`insufficient_funds`);
- `4000 0025 0000 3155` — pede 3-D Secure no cadastro (o SetupIntent abre o desafio no navegador);
  a cobrança fora da sessão depois pode pedir confirmação de novo e aparece como "o banco pediu
  uma confirmação extra".

**O que passa pela Stripe**: cartão salvo (Customer + SetupIntent; o número nunca chega à HouseArt,
fica só bandeira, 4 últimos, validade e o `pm_…`; remover faz *detach*), plano (`changePlan`), pedidos
de serviço (`placeOrder`), garantia da proposta (PaymentIntent com `capture_method=manual`: autoriza
no envio, captura no aceite, cancela na recusa, expiração e retratação; se o aceite for maior que
o autorizado a garantia é liberada e o negócio pede o pagamento em garantia), compra direta (autoriza
o total do checkout, grava a proposta sob a trava da obra e captura), pagamento em garantia do
negócio e a taxa de transferência fora da plataforma (cartão padrão do pagador). Webhook idempotente
por id do evento (tabela `StripeEvent`).

#### 9.1 Connect — repasse automático aos vendedores (NO AR em 2026-10-23, modo teste; ligar na Stripe)
O vendedor (artista, galeria pelo ADMIN, colecionador que revende) conecta uma conta **Express** em
`/sales/payout` ("Receber pela Stripe", acima do Pix). Quando o negócio conclui (toque do comprador na
etiqueta), a parte de cada linha do split vai por **Transfer do saldo da plataforma** para a conta
ENABLED do beneficiário: a parte do vendedor (`ARTIST` numa venda do artista, `GALLERY` numa venda da
galeria ou revenda do colecionador), a parte do artista numa venda da galeria (quando o artista tem
conta) e o direito de sequência (`ARTIST_ROYALTY`). `PLATFORM`, `SHIPPING` e `INSURANCE` nunca saem.
Linha sem conta ENABLED fica `RELEASED` (repasse manual por Pix, como hoje); quem conecta DEPOIS do
negócio é pago pelo cron **`/api/cron/connect-payouts`** (de hora em hora, `40 * * * *`, `CRON_SECRET`
+ `JobLease`). Recusa da Stripe fica na linha (`DealSplit.payoutError`, só o código) e o cron tenta de
novo com chave nova (`payoutAttempts`); a conclusão do negócio nunca falha por causa do repasse.
Linha paga: `status=PAID`, `payoutRef=tr_…`, `transferredAt`. `transfer.reversed` devolve a linha a
`RELEASED` com `transfer_reversed` e o cron NÃO transfere de novo sozinho (decisão manual). Modo mock:
tudo 409, a tela do Pix é a de antes. Provas: `test/integration/stripe-connect.integration.test.ts`
(Stripe falso injetado), `lib/stripe/connect-core.test.ts`.

**Ligar na Stripe (modo Test)**:
1. Painel da Stripe › **Settings › Connect › Get started** (ou *Connect › Overview*): tipo de
   integração "Express"; país da plataforma Brasil. Em *Settings › Connect › Branding* pôr nome, ícone
   e cor — o onboarding hospedado e o painel Express mostram a marca da HouseArt.
2. *Settings › Connect › Express* (ou *Onboarding options*): país permitido **Brasil**; capacidade
   pedida pelo código: só `transfers` (recebedor). Nada a configurar além do que vem por padrão.
3. **Webhook de Connect**: *Developers › Webhooks › Add endpoint* → **mesma URL**
   `https://houseart-housemapp.vercel.app/api/stripe/webhook` → em "Listen to" marcar
   **"Events on Connected accounts"** (não "Events on your account") → evento `account.updated` →
   copiar o *Signing secret* desse endpoint em **`STRIPE_CONNECT_WEBHOOK_SECRET`** (é outro secret: o
   código aceita a assinatura de qualquer um dos dois). No endpoint de sempre ("Events on your
   account") acrescentar **`transfer.reversed`** (a Transfer é da plataforma; `transfer.failed` não
   existe na Stripe). Sem o webhook de Connect a tela ainda funciona: a volta do onboarding
   (`?connect=return`) e "Atualizar situação" releem a conta.
4. Redeploy (migration `20261023200000_stripe_connect`, aditiva).
5. **Saldo**: a Transfer sai do saldo da plataforma. Em teste, o pagamento em garantia do negócio
   (PaymentIntent com cartão 4242) já credita o saldo de teste; se faltar, "Add to balance" no painel
   (modo Test) ou `balance_insufficient` fica na linha e o cron paga na hora seguinte.
6. Onboarding de teste: a Stripe aceita dados fictícios no modo Test (CPF 000.000.001-91, qualquer
   endereço, conta bancária de teste que o próprio formulário oferece, "Skip this step" onde houver).
7. Conferir: `/sales/payout` → "Conectar conta" → formulário hospedado → volta com "Ativa"; concluir um
   negócio → a linha diz "pago pela Stripe"; a Transfer aparece em *Connect › Transfers*.

Para live: as mesmas chaves live (§9), **a conta Connect da plataforma ativada em live** (termos e
dados da empresa na Stripe) e os dois webhooks live. `STRIPE_CONNECT_WEBHOOK_SECRET` é opcional: sem
ela, só a assinatura do endpoint de sempre vale.

**Ainda NÃO** (pendências):
- **Connect**: ligar na Stripe (acima); estorno de Transfer (reversal) por tela; repasse manual
  (Pix) continua fora da Stripe; o consultor (`ADVISOR`) não tem membro no negócio — nenhuma linha
  é gerada hoje, e quando houver vai pelo mesmo caminho; a galeria recebe na conta do ADMIN do
  tenant (uma conta por membro, não por tenant).
- Reserva por Pix na proposta (`PIX_RESERVE`) é recusada em test/live — não há provedor.
- Estorno (refund) e disputa: não há tela; se a gravação falhar depois de uma cobrança com sucesso
  (plano, pedido), o estorno é manual no painel da Stripe.
- Mensalidade recorrente (Stripe Billing/subscription) e nota fiscal: o plano cobra o 1.º mês avulso.
- App mobile (`apps/mobile`): a tela nativa de cartões manda o número ao servidor (formulário do mock) e
  em test/live é recusada com a orientação de cadastrar pelo site (`/wallet/cards`). Para cadastrar no
  app: `@stripe/stripe-react-native` (exige dev build) ou abrir `/wallet/cards` em WebView.
- Cartões salvos em modo mock não servem no modo teste (e os de teste não servem no live): cada
  pessoa cadastra de novo ao trocar de modo.

### 9.2 Pix e boleto na garantia (código pronto em 2026-10-26)

O checkout e Compras oferecem **Pix · Cartão · Boleto** (protótipo Web Colecionador › Comprar). Pix e boleto
viram um PaymentIntent da Stripe (`payment_method_types: pix | boleto`), a obra fica reservada e o negócio
só passa a "Pago em garantia" quando chega o `payment_intent.succeeded` no webhook de sempre. Sem pagamento
até o vencimento (Pix 24 h, boleto 3 dias), o cron `offers-expire` cancela o negócio e devolve a obra à venda.

Para ligar na Stripe (modo de teste e depois live):
1. Dashboard › Settings › Payment methods: ativar **Pix** e **Boleto** (conta Brasil).
2. O webhook da plataforma já recebe `payment_intent.succeeded` — nada novo.
3. Teste: no modo de teste a página de instruções da Stripe (link "Abrir instruções de pagamento") simula o
   Pix pago; para o boleto, um e-mail de comprador terminado em `succeed_immediately@…` compensa sozinho.

Sem a ativação, escolher Pix/boleto responde "Pix ainda não está disponível" e a reserva é desfeita na hora.
Parcelamento no cartão (1×/3×/6×/10× do protótipo) **não** foi ligado: pede o fluxo de planos de parcela da Stripe.

## Depois do MVP (produto)
Stripe live (`STRIPE_ENV=live` com `sk_live_`/`pk_live_`, webhooks live; tirar `STRIPE_TEST_ALLOWED`), Connect live (§9.1), KYC real,
etiquetas NTAG 424 reais (`MARKER_VENDOR=ntag424` + master key), carimbo do tempo, âncora,
frete/seguro, telas do pacote de design que não vieram (site público, galeria, colecionador, app).
