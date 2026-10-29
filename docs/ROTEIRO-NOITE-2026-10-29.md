# Roteiro da noite: fechar o MVP (2026-10-29)

> Para rodar sem o Moacy. Nada aqui espera chave, conta, contrato ou decisão dele.
> O que precisa dele está no fim, na seção "Para o Moacy de manhã", pronto para ele ler em 5 minutos.

## 0. Como trabalhar esta noite

1. **Um bloco por vez, na ordem.** Cada bloco é uma branch curta `noite/<bloco>`.
   - Fluxo: `npm run gate` verde → revisão adversarial com zero achado CONFIRMED → `git pull --rebase origin main` → `git merge --no-ff` → push.
   - Depois do push, espere o deploy da Vercel ficar READY antes de abrir o próximo bloco.
2. **Sem decisão travando.** Quando o caminho exigir uma escolha de produto:
   - Escolha a opção mais conservadora: a que não cobra, não expõe dado e não apaga nada.
   - Registre a escolha em §9 ("Decisões tomadas à noite"), para o Moacy confirmar ou reverter.
3. **Nada de produção irreversível.**
   - Sem `db push`.
   - Sem renomear migration aplicada.
   - Sem mexer em env da Vercel.
   - Sem dinheiro real.
   - Sem apagar conta ou dado de demo.
   - Migration nova só aditiva e reexecutável.
4. **Prova em produção:** Playwright num Vercel Sandbox, com as contas demo (`scripts/demo/README.md`, senha `Demo-HouseArt-2026`).
   - Configuração do sandbox:
     - `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64`, com `chromium-headless-shell`.
     - Script sem sudo, saída gravada em arquivo e lida com `read_session_file` (a chamada com `wait` estoura 60 s).
   - Contas demo:
     - Colecionadores: `marina.demo`, `lia.demo`, `marcelo.demo`.
     - Galeria: `ana.demo` (admin), `caio.demo` (vendas).
     - Artista: `joana.demo`.
     - Avaliador e admin: estão no README da demo.
5. **CLAUDE.md:** um bullet datado por bloco entregue, no topo do "Estado atual". A seção "Pendências" é atualizada no fim da noite.
6. **Ao terminar cada bloco**, marque o checkbox aqui mesmo e commite este arquivo junto.

## 1. Simulador do app: terminar a prova dos três perfis (≈1 h)

Já provado em produção (2026-10-29):
- Artista: login, escolha de perfil, Início, Obras, Avisos.
- Colecionador e Galeria: as cinco abas de cada um, sem erro de página nem API 4xx/5xx.
- Colecionador: abrir obra pelo Explorar, abrir obra da Coleção (`?mine=1`), abrir conversa.

Falta provar:
- [ ] **Colecionador:**
  - [ ] "Fazer oferta" abre as 5 etapas. Pare antes de enviar: não criar proposta de verdade.
  - [ ] "Comprar" abre o checkout.
  - [ ] Busca.
  - [ ] Favoritos.
  - [ ] Compras (`/purchases`).
  - [ ] Vendas.
  - [ ] Registrar restauro (abre e cancela).
- [ ] **Galeria:**
  - [ ] Obra do Acervo → Gestão do anúncio.
  - [ ] Oferta recebida: abrir. Não aceitar nem recusar.
  - [ ] Vendas → negócio.
  - [ ] Regras.
  - [ ] Conversa.
  - [ ] Equipe e Artistas pelo menu.
- [ ] **Artista:**
  - [ ] Escrituras.
  - [ ] Nova obra: abre a câmera guiada; na web vira escolher arquivo, então só abrir.
  - [ ] Vendas.
- [ ] **Consultor** (se a demo tiver um) e **troca de perfil** dentro do app ("Escolher perfil" de novo).
- [ ] **Tema**: Claro, Pastel e Escuro trocados no painel web não quebram o app embutido.
- [ ] Toda tela que der "Tela não encontrada", página em branco ou erro de API vira correção.
  - Corrigir em `apps/mobile`, rodar `npm run app:web`, commitar `public/app` e provar de novo.

**Pronto quando:** um script `scripts/smoke-app-web.manual.cjs` estiver no repo.
- Ele percorre os três perfis e sai com código ≠ 0 em qualquer erro.
- O cabeçalho do script diz como rodar no sandbox.

## 2. Fotos do cofre no app na web (≈45 min)

Hoje `VaultImage` (`apps/mobile/src/ui/vault-image.tsx`) pede a foto com o bearer. Na web, um `<img>` não manda o cabeçalho, então as fotos não aparecem. Isso vale para as fotos da conversa e para a embalagem da compra.

- [ ] Criar `vault-image.web.tsx`.
  - Faz `fetch` com `Authorization` e `credentials: 'omit'`.
  - Converte a resposta em `blob` → `URL.createObjectURL`.
  - Chama `revokeObjectURL` ao desmontar.
  - Mostra o mesmo placeholder em caso de erro.
- [ ] Regerar `public/app` e provar com a conversa da `lia.demo` com a galeria, que tem foto se houver; senão, só a embalagem.

## 3. Retomar a entrega que falhou depois do toque (≈1 h 30)

Registrado em 2026-10-26: quando `completeTransfer` falha depois do toque, o negócio fica parado em **DELIVERY** e nada o retoma. O comprador recebe `WRONG_PHASE` se tentar de novo.

- [ ] **Cron `/api/cron/deal-complete-retry`**, de hora em hora, com `withJob` + `JobLease`.
  - Pega negócios em DELIVERY, sem exceção, cujo toque válido já foi registrado.
  - Roda `completeTransfer` de novo.
  - Precisa ser idempotente: a escritura nunca nasce duas vezes. Usar a mesma trava/CAS da conclusão.
- [ ] **Entradas novas:**
  - Cron no `vercel.json`.
  - `CRONS` em `/admin/ops`.
  - Teste de integração: falha simulada na primeira conclusão, cron conclui, segunda rodada não faz nada.
- [ ] O cartão "Leitura registrada…" das Compras passa a dizer "Estamos concluindo a escritura; em até 1 h ela aparece na sua coleção".

## 4. Pequenos buracos já registrados (≈2 h, um commit cada)

Todos estão anotados como "registrado" no CLAUDE.md e nenhum pede decisão:

- [ ] **Cabeçalho da coleção conta negócio cancelado** em "Compras".
  - Excluir `CANCELLED` do contador e do badge, que precisam ser a mesma régua.
  - Teste unitário.
- [ ] **Lista de conversas com obra de galeria suspensa** ainda mostra título e capa: aplicar o filtro de tenant `ACTIVE` em `listConversations`, como já é feito em `readConversation`.
- [ ] **`DEFAULT_SIGNUP_PLAN`** cai em `plans[0]` se o Ateliê for desligado no catálogo.
  - Cair no plano padrão ATIVO do público.
  - Se nenhum estiver ativo, mostrar mensagem clara.
  - Teste.
- [ ] **`/signup/welcome` lê só `plan`**: aceitar `plano` também, como o `/signup`.
- [ ] **Disparo manual de cron não registra quem disparou.**
  - Gravar `triggeredById` na `JobRun`. Migration aditiva, coluna nullable.
  - Mostrar o nome em `/admin/ops`.
- [ ] **Assinatura inválida no webhook da Stripe** não deixa rastro.
  - Gravar uma linha (`recordWebhookFailure` com motivo `bad_signature`, sem payload).
  - O cartão de `/admin/ops` passa a dizer "N entregas recusadas pela assinatura".
- [ ] **Reenvio do código de troca de e-mail sem freio próprio**: aplicar o mesmo freio do celular (`/api/auth/phone/*`) em `/api/auth/email/resend`.
- [ ] **Arquivo órfão no cofre** (foto de conversa ou embalagem gravada no Blob, mas a linha falhou).
  - Na falha da gravação, apagar o arquivo, como já é feito no avatar.
  - Teste com a gravação forçada a falhar.
- [ ] **Busca do topo com ID público completo inexistente** abre o 404: mandar para `/verify?q=<ID>` com "Nenhuma obra com este ID".
- [ ] **Logos de tom fixo no tema escuro:** onde o tema escuro alcança, usar o tom `auto-mono` em vez do `color`. Só nas telas logadas.
- [ ] **Preferência de tema acompanha a conta.**
  - Gravar em `preferences.theme` pelo `PATCH /api/auth/preferences`.
  - Ler no login.
  - O `localStorage` continua sendo o cache.

## 5. Central de Ajuda mínima (≈1 h 30)

O menu da conta aponta "Ajuda" para `/e/how-it-works` (`HELP_HREF`).

- [ ] **Criar `/help`** (público, no site): índice com seis artigos curtos.
  - Escritos a partir do que o produto FAZ, sem prometer o que não existe: conferir cada frase contra o código.
  - Artigos:
    - Como funciona o certificado.
    - Como fazer uma proposta.
    - Pagamento em garantia (cartão, Pix, boleto).
    - Como recebo uma venda (Connect e Pix).
    - Transferir uma obra fora da plataforma.
    - Etiqueta NFC: o que fazer se ela for removida.
- [ ] **Ligar a página:**
  - `HELP_HREF` → `/help`.
  - Entrada no `sitemap.xml`.
  - Catraca `nav-targets` atualizada.
  - "Falar com a HouseArt" no fim de cada artigo: `mailto:` do `SUPPORT_EMAIL`, ou a seção `#suporte` quando ele não existir.

## 6. Smoke das jornadas atualizado (≈1 h)

`e2e/journeys.smoke.ts` cobre 5 jornadas de 2026-10-21. Desde então entraram:
- Pix/boleto.
- Painel lateral.
- Cadastro em 5 passos (colecionador e galeria).
- Embalagem.
- Restauro.
- Simulador.

Tarefas:
- [ ] Acrescentar uma jornada por item acima, contra o `next start` local, com `SMOKE_READONLY` respeitado.
- [ ] Rodar `npm run smoke` local verde.
- [ ] Rodar `SMOKE_READONLY=1` contra a produção pelo sandbox.

## 7. Revisão adversarial da noite (≈1 h)

- [ ] Um agente revisor, sem o meu raciocínio, recebe o diff `main@início-da-noite..main`.
  - Ângulos: escopo e vazamento (piso, hash, CPF), idempotência do cron novo, segurança do `vault-image.web` (token só no cabeçalho, nunca em URL) e textos que prometem o que o produto não faz.
- [ ] Todo achado CONFIRMED vira correção na mesma noite.

## 8. Fechamento (≈30 min)

- [ ] **Atualizar `CLAUDE.md`:**
  - Bullets dos blocos.
  - "Pendências" reescrita só com o que sobrou.
- [ ] **Atualizar `docs/PRODUCAO-PENDENCIAS.md`** com o que depende do Moacy (§10 abaixo).
- [ ] **Teste final em produção:**
  - Login dos 9 perfis.
  - `/app` dos três perfis.
  - `/admin/ops` sem cron atrasado.
- [ ] **Resumo da noite:** escrito no fim deste arquivo (feito, provado, ficou de fora e por quê).

## 9. Decisões tomadas à noite (preencher)

| # | Onde | Escolha feita | Alternativa | Reverter é fácil? |
|---|------|---------------|-------------|-------------------|
|   |      |               |             |                   |

## 10. Para o Moacy de manhã (não bloqueia a noite)

### Chaves e contas
1. **Blob:**
   - Renomear `BLOB_PRIVATE_READ_WRITE_TOKEN_READ_WRITE_TOKEN` → `BLOB_PRIVATE_READ_WRITE_TOKEN`.
   - Ligar o store `houseart-public` ao projeto.
2. **Domínio próprio + `APP_URL`.** Hoje os e-mails saem com o link da Vercel.
3. **SMTP próprio**, no lugar do Gmail emprestado.
4. **Stripe:**
   - Ligar o Connect Express e o webhook de contas conectadas (§9.1).
   - Pix/Boleto (§9.2).
   - Parcelamento no cartão (conta BR).
   - Só depois disso, `FLAG_CARD_INSTALLMENTS=1`.
5. **Instagram:** `INSTAGRAM_APP_ID/SECRET` e o redirect.
6. **Envs:** `SUPPORT_EMAIL`, `ART_INDEX_BASE_START`.
7. **Provedores reais:** KYC (Didit), etiquetas NTAG 424 com master key e espelho TT, carimbo ICP-Brasil, frete e seguro, Art Loss Register.
8. **Apps nas lojas:** contas Apple/Google e build EAS. Os apps nunca foram abertos num aparelho.

### Decisões de produto pendentes
1. Quem absorve a taxa do parcelado "sem juros"? A parcela mínima de R$ 100 está boa?
2. A faixa de preço sugerida e a valorização usam vendas de terceiros do mesmo artista (agregadas, com 6 ou mais vendas). Pode?
3. Fotos na conversa passam sem filtro de contato, e a denúncia mostra "Foto" à equipe, sem a imagem.
4. Equipe lê as últimas 20 mensagens de conversa denunciada.
5. Emissor novo deve SEGURAR a emissão do certificado (hoje é revisão posterior)?
6. Trocar a etiqueta de obra já emitida: precisa de versão nova do certificado com o ID novo.
7. Descrição da obra editável depois de certificada (hoje sim, fora do hash)?
8. Laudo assinado pela equipe (não pelo avaliador): deve existir?
9. Avisar o comprador da decisão do KYC? A reprovação deve alcançar transferência já assinada?
10. Contrato de consignação: `DEFAULT_GALLERY_BPS` é placeholder.
11. Venda paga por Pix manual nunca sai de "A receber" na carteira.
12. Conta só com Google/Apple troca e-mail sem senha.
13. Revisão jurídica: termos, privacidade, termo de cessão.

## Resumo da noite (preencher no fim)

- Feito:
- Provado em produção:
- Ficou de fora:
