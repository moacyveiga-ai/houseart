# Auditoria de fidelidade — "HouseArt Web App" (foco: Admin)

Data: 2026-10-25 · Auditoria só de leitura (nenhum arquivo do repositório alterado).
Protótipo: `houseart-design/handoff/designs/HouseArt Web App.dc.html` (markup + `<script type="text/x-dc">`, linhas 679–889).
Capturas do protótipo renderizado (1440×900, por perfil × item de menu): `(captura local da auditoria)` (`admin-0..2.png`, `artista-0..6.png`, `galeria-0..7.png`, `colecionador-0..3.png`, `avaliador-0.png`).
A implementação foi lida no código; não subi a app (precisaria de banco).

## Resumo

- **A área Admin é a parte mais fraca.** Das três telas do protótipo (Obras e certificados, Etiquetas, Cobrança), só a primeira tem função de verdade, e mesmo assim pela metade:
  - Três dos cinco tipos da fila nunca são abertos por nenhum código: Duplicidade, Emissor novo e Restrição IPHAN. Na prática a fila só recebe contestação e etiqueta removida.
  - "Aprovar" uma contestação revoga o certificado com um clique, sem confirmação e sem dizer o efeito.
  - Um erro do servidor tira o item da tela, como se a decisão tivesse sido gravada.
  - Faltam miniatura, tempo relativo ("há 2 h"), notas dos KPIs e o badge "6" no menu.
- **Etiquetas mostra códigos em inglês ao operador:** `REQUESTED`, `SHIPPED`, `STOCK`, `LINKED`, além de "membro 12". Também:
  - Não há como importar os UIDs reais do fornecedor (a API aceita `uids`, a tela não).
  - "Enviar" um pedido dispara no `onChange` de um `<select>`, sem confirmação.
  - A barra de progresso de "Vinculadas" e as notas dos KPIs não existem.
- **Cobrança do admin fica vazia.** Diz "Sua conta não tem plano: colecionadores e a equipe pagam só pelos serviços que usam." e não lista nenhuma fatura. Não há visão da receita da casa.
- **Casca (todos os perfis):**
  - "Configurações" (`/settings`) e "Ajuda" (`/help`) no rodapé da sidebar dão 404.
  - Abaixo de 900 px a sidebar e a busca somem e nada as substitui: sem menu nenhum no tablet ou celular.
  - Só "Mensagens" tem badge; os badges de Certificação, Vendas, Compras, Fila de laudos e Obras e certificados não existem.
  - A faixa de índices (Índice HouseArt, Dólar, Euro) nunca aparece, porque o layout não passa `ticker`.
  - "Minha conta" no menu do avatar leva admin, artista e galeria à conta do colecionador.
- **Telas dos outros perfis estão razoavelmente fiéis nos textos.** As divergências que contam:
  - Dashboard sem o gráfico "Vendas em 2026"; "Obras recentes" em lista, não em grade de imagens.
  - Minhas obras sem seleção múltipla nem a barra "Solicitar etiquetas · Listar no marketplace".
  - Cobrança com o cartão do plano claro, não escuro, e sem o layout lado a lado com o uso.
  - Carteira sem "Registrar restauro".
  - Compras sem o cartão "A obra chegou? / Confirmar recebimento".
  - Fila de laudos sem miniaturas e com a régua min/sugerido/máx trocada por uma barra de progresso.
  - Direito de sequência sem miniaturas nem notas dos KPIs.
- **O que um operador real precisa e não existe nem no protótipo** (marcado "fora do protótipo"):
  - usuários e contas, KYC, galerias/tenants;
  - negócios, repasses e estornos;
  - lista e busca de obras e certificados por ID interno;
  - trilha de auditoria;
  - catálogo de planos, serviços e etiquetas;
  - atribuição de avaliadores;
  - saúde dos jobs e do Stripe;
  - aviso ao admin quando a fila recebe item.
- **Lacuna de processo:** o `CLAUDE.md` cita a catraca `nav-targets` em `lib/architecture/`, mas o arquivo não existe. Foi por isso que os links quebrados da sidebar passaram no gate.

---

## 0. Casca (Shell) — todos os perfis

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Rodapé da sidebar | Links do protótipo + "Sair" | "Configurações" → `/settings` e "Ajuda" → `/help`: **não existe página** (`ls app/settings app/help` falha) → 404 | alta | `components/layout/AppShell.tsx:61-62` (remover ou criar `app/(panel)/settings`, `app/(panel)/help`) |
| Navegação < 900 px | Sidebar 240 px (o protótipo é desktop) | `.ha-sidebar { display:none }` e `.ha-topbar__search { display:none }` abaixo de 900 px, **sem gaveta, hambúrguer nem barra inferior**: em tablet/celular não há como trocar de tela | alta | `app/ds/cells.css:210`, `components/layout/AppShell.tsx` |
| Badges no menu | Certificação `2`/`5`, Vendas e ofertas `3`, Compras `1`, Fila de laudos `4`, Obras e certificados `6` (script, `NAV`, linhas 30-34) | O layout só passa `{ messages }` | média (alta no admin: a fila não tem contador) | `app/(panel)/layout.tsx:22` (contar fila de revisão, certificações pendentes, ofertas abertas, compras ativas, laudos) |
| Faixa de índices | Barra ink-900 "Índice HouseArt **112,4** +0,8% · Dólar **R$ 5,42** · Euro **R$ 6,11**" | `AppShell` aceita `ticker`, mas o layout não passa nada; `IndexTicker` devolve `null` com lista vazia → a faixa nunca aparece | média | `app/(panel)/layout.tsx:22`, `components/ds/IndexTicker.tsx:5` |
| Sino | Ponto sand-500 | Ponto só com não lidas (ok); o admin não recebe aviso quando a fila de revisão recebe item (`openReviewItem` não notifica) | média (fora do protótipo) | `lib/admin-review/server.ts:15-21` |
| Busca do topo | "Buscar obras, artistas, galerias ou IDs" | `/search` procura só no conteúdo público (`lib/search/server.ts`): o admin não acha obra em rascunho/certificação, certificado, negócio, usuário nem ID interno | alta para o admin | `app/(panel)/search/page.tsx:14`, `lib/search/server.ts` |
| Menu do avatar › "Minha conta" | — (o protótipo troca de perfil) | Leva sempre a `/account`, que é a conta do **colecionador** ("Carteira de escrituras", "Cadastrar obra", "Compras"…), também para admin, artista e galeria | média | `components/layout/ProfileSwitcher.tsx:63`, `app/(panel)/account/page.tsx` |
| Escolha de perfil | Tela própria | Trocada pelo menu do avatar (decisão do dono) | — (não é lacuna) | — |
| Catraca de navegação | — | `lib/architecture/` não tem `nav-targets` (o CLAUDE.md diz que tem); links mortos passam no gate | média | `lib/architecture/` (criar a catraca sobre `NAV` + rodapé do `AppShell`) |

---

## 1. Admin · Obras e certificados (`/admin/review`)

Captura: `shots/webapp/admin-0.png`.

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Tipos da fila | 5 tipos: Duplicidade ("Imagem 91% semelhante a 'Voo baixo'"), Contestação, Emissor novo ("Primeiro lote · KYC aprovado, conferir portfólio"), Etiqueta removida, Restrição IPHAN | Só `CONTESTATION` (`lib/certificates/server.ts:262`) e `MARKER_REMOVED` (`lib/physical-markers/server.ts:173`) chamam `openReviewItem`. **DUPLICATE, NEW_ISSUER e EXPORT_RESTRICTION nunca nascem**: "São obras diferentes" (inclusive com obra de outra conta, o caso de imagem roubada) e "É a mesma obra" não sobem à equipe, apesar do comentário "the admin queue (Phase 2) reviews SAME decisions" | alta | `lib/artworks/server.ts:144-151` (`decideDuplicate` abrir DUPLICATE), primeiro lote de tenant novo → NEW_ISSUER, regra de IPHAN → EXPORT_RESTRICTION |
| Efeito de Aprovar/Rejeitar | Aprovar/Rejeitar com resultado "Aprovado"/"Rejeitado" | NEW_ISSUER e EXPORT_RESTRICTION não têm efeito nenhum; DUPLICATE aprovado também não. Contestação **aprovada revoga o certificado e põe a obra DISPUTED com um clique**, sem confirmar, sem motivo e sem que o botão diga o efeito | alta | `lib/admin-review/server.ts:44-69`, `components/admin/ReviewQueue.tsx:30-31` (diálogo de confirmação com o efeito e um campo de motivo; rótulos por tipo, ex.: "Revogar certificado" / "Manter certificado") |
| Erro na decisão | — | Se a resposta não é ok (403, 500, 404), o item **some da tela** sem mensagem, como se tivesse sido decidido | alta | `components/admin/ReviewQueue.tsx:14` (toast com o erro; tirar o item só no 404 "já decidido") |
| Estado de envio | — | Botões sem `disabled`/carregando: clique duplo manda dois POST | média | `components/admin/ReviewQueue.tsx:11-15` |
| Miniatura e título | Moldura 40×40 `--ha-wall` com a imagem; título em itálico display "*Céu de Ondina, 2025*" + artista | O servidor manda `cover`, mas a tela **não desenha a imagem**; título em `<b>` sem itálico | média | `components/admin/ReviewQueue.tsx:25`, `lib/admin-review/server.ts:37` |
| Coluna "Aberto" | Relativo: "há 2 h", "há 1 dia", "há 20 min" | Data absoluta `dd/mm/aaaa` | média | `components/admin/ReviewQueue.tsx:27` |
| Cor dos tipos | Etiqueta removida = alert-500 sólido com texto paper; Contestação = alert-100; Duplicidade = pending-100; Emissor novo/IPHAN = paper-200 | `Badge tone='alert'` igual para contestação e etiqueta removida | baixa | `components/admin/ReviewQueue.tsx:16` |
| Notas dos KPIs | "+1.240 em outubro" · "tempo médio 6 h" · "0,02% das obras" | Sem nota nos três KPIs | média | `app/(panel)/admin/review/page.tsx:17-21`, `lib/admin-review/server.ts:23-41` (certificadas no mês; média de `decidedAt − createdAt`; % de contestadas) |
| Estado vazio | — | "Fila vazia." numa linha de tabela | baixa | `components/admin/ReviewQueue.tsx:21` |
| Detalhe do item | — (sem drill-down) | Sem link para a obra, o certificado, as leituras da etiqueta, a obra parecida lado a lado nem o texto da contestação | alta (fora do protótipo) | nova `app/(panel)/admin/review/[id]/page.tsx` |
| Histórico e filtros | — | Decididos somem ao recarregar; sem filtro por tipo, sem paginação (`take: 200`), sem "decididos por mim" | média (fora do protótipo) | `lib/admin-review/server.ts:26` |
| Lista de obras e certificados | O título promete "Obras e certificados" | Só a fila; não há como listar/buscar obras ou certificados nem ver versões e revogar à mão | alta (fora do protótipo) | nova aba em `app/(panel)/admin/review` |

## 2. Admin · Etiquetas (`/admin/markers`)

Captura: `shots/webapp/admin-1.png`.

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Busca | Campo "UID da etiqueta ou ID da obra" **à direita do título** | O campo vem abaixo dos KPIs, com a classe do topo (`ha-topbar__search`), sem rótulo acessível | baixa | `components/admin/MarkersAdmin.tsx:32-34`, `app/(panel)/admin/markers/page.tsx:18` |
| Resultado da busca | — | Mostra status cru (`STOCK`, `LINKED`, `REMOVED`…) e "obra 123" (id interno, sem link) | alta (inglês na UI) | `components/admin/MarkersAdmin.tsx:35` (rótulos pt-BR em `lib/physical-markers/domain.ts`; link para a obra) |
| Coluna Vinculadas | Barra de progresso + "1.310" | Só texto "1.310 · 66%" | média | `components/admin/MarkersAdmin.tsx:43` (usar `Progress` do DS) |
| Status do lote | "Em uso", "Esgotado", **"Novo emissor"** (pending-100) | "Novo" (`BATCH_STATUS_LABELS.NEW`) | baixa | `lib/physical-markers/domain.ts:4` |
| Notas dos KPIs | "lote 2026-11 chega em 30/10" · "98,6% das enviadas" · "hoje" | Só "últimas 24 h" no terceiro | média | `app/(panel)/admin/markers/page.tsx:19-23` |
| Alertas de remoção | KPI "1 · hoje" | Só o número; sem lista das leituras com `tamperFlag` nem ação (revogar etiqueta, abrir revisão) | alta (fora do protótipo) | `lib/physical-markers/server.ts:51`, `components/admin/MarkersAdmin.tsx` |
| Pedidos de kit | — | Status em inglês (`REQUESTED`/`SHIPPED`/`DELIVERED`) e "membro {id}" em vez do nome do artista ou galeria | alta | `components/admin/MarkersAdmin.tsx:55-56` |
| Enviar pedido | — | Um `<select>` dispara o envio no `onChange`, sem confirmação, sem rótulo e com `window.location.reload()` | média | `components/admin/MarkersAdmin.tsx:57-62` |
| Novo lote | — | Inputs sem `<label>` (só placeholder); sem destino por tenant; **sem importar o CSV de UIDs reais** (a API aceita `uids`, `app/api/admin/markers/batches/route.ts:8`); sem UID informado, o servidor inventa UIDs aleatórios (`lib/physical-markers/server.ts:33`) | alta | `components/admin/MarkersAdmin.tsx:66-72` |
| Nota de rodapé | "Etiquetas com chip NXP e criptografia por obra…" | Igual | — | — |

## 3. Admin · Cobrança (`/billing`)

Captura: `shots/webapp/admin-2.png`.

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Conteúdo para a equipe | O protótipo repete o cartão "Seu plano · Ateliê", o uso e as faturas (dado de exemplo do artista) | Para o admin: "Sua conta não tem plano: colecionadores e a equipe pagam só pelos serviços que usam." + "Nenhuma fatura ainda." A tela é inútil para a equipe | alta | `app/(panel)/billing/page.tsx:8-22`, `lib/billing/server.ts:30-45` (visão da casa para `hasTotalScope`: receita do mês por plano, pedidos, comissões retidas, repasses, falhas de Transfer, NF-e pendentes) |
| Cartão do plano | Cartão **ink-900** (escuro) com "SEU PLANO", nome em display, preço "R$ 49 /mês", botão "Mudar de plano"; ao lado, cartão "Uso em outubro" | Cartão claro `ha-card`, empilhado (sem duas colunas) | média | `components/billing/BillingScreen.tsx:32-52` |
| Link NF-e | "NF-e" em cada fatura | Ver `BillingScreen` (coluna de 80 px) | baixa | `components/billing/BillingScreen.tsx:54+` |

## 4. Admin › "Conteúdo do site" (`/admin/content`) — fora do protótipo

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Existência | Não existe | Item de menu com abas Notícias e Agenda | — | `lib/profiles/nav.ts:81-85` |
| Guarda | — | `canEditPublicContent` (admin, gestor, operador): ok | — | `app/(panel)/admin/content/page.tsx:15` |

## 5. Capacidades de admin ausentes (fora do protótipo)

Nenhuma rota de staff além de `/api/admin/{review,markers,content}` (`grep requireStaff|hasTotalScope app` só acha essas e laudos).

| Capacidade | Hoje | Severidade | Onde mexer |
|---|---|---|---|
| Usuários e contas (buscar, ver perfis, bloquear, reenviar convite, redefinir senha, trocar papel) | Inexistente | alta | `app/(panel)/admin/users` + `lib/authz/` |
| KYC (fila de verificação, reprovar, revalidar) | Inexistente (KYC mock) | alta | `app/(panel)/admin/kyc` |
| Negócios (lista de todos os `Deal`, fase, garantia, liberar/estornar, repasse com falha, "Tentar de novo" já aceito pela API para a equipe) | Sem tela para a equipe | alta | `app/(panel)/admin/deals`; `POST /api/deals/[id]/payout/retry` |
| Transferências fora da plataforma travadas (falta toque, taxa paga) | Inexistente | média | idem |
| Galerias/tenants (dados, plano, equipe, contrato) | Inexistente | média | `app/(panel)/admin/tenants` |
| Atribuir avaliador ao laudo; ver prazos | `/appraisals` abre para a equipe mas não está no menu do admin e não atribui | média | `lib/profiles/nav.ts:81`, `lib/appraisal/server.ts` |
| Trilha de auditoria (`AuditLog`) | Gravada, sem tela | média | `app/(panel)/admin/audit` |
| Catálogo (planos, serviços, preço de etiqueta) | Só por SQL/seed | baixa | — |
| Saúde operacional (crons `certificate-anchor`/`offers-expire`/`connect-payouts`, webhooks Stripe com erro) | Inexistente | média | `app/(panel)/admin/ops` |
| Painel inicial do admin | `/` para admin mostra o dashboard de **galeria** com escopo total ("Obras em inventário", botão "Nova obra", "Cadastre a primeira obra para começar") | média | `app/(panel)/page.tsx:32-48` (redirecionar admin para `homeOf('admin')` ou criar painel da casa) |

---

## 6. Dashboard (`/`, artista)

Captura: `shots/webapp/artista-0.png`.

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Cabeçalho | Data "Segunda, 19 de outubro" + "Bom dia, Joana" + "Nova obra" | Igual + botão extra "Perfil público" | baixa | `app/(panel)/page.tsx:43-49` |
| KPIs | 4 KPIs com nota ("2 no marketplace, 4 na galeria") | 4 KPIs; nota de "À venda" = "no marketplace" | baixa | `lib/dashboard/core.ts:29-32` |
| Próximas ações | Uma linha por obra ("Assinar certificado · Estudo em vermelho · etiqueta já vinculada"); a primeira com fundo sand-100 | Agregadas por tipo ("2 obra(s) com etiqueta vinculada"), sem destaque na primeira | baixa | `lib/dashboard/core.ts:36-45` |
| "Vendas em 2026" | Gráfico de barras por mês (jan–out, mês atual em sand-500) + "R$ 268 mil em 11 obras" | **Ausente** | média | `app/(panel)/page.tsx:52-78`, `lib/dashboard/server.ts` |
| Obras recentes | Grade de 4 cartões com imagem em moldura, título e selo de status | Lista de linhas com miniatura de 40 px dentro de um card | média | `app/(panel)/page.tsx:63-77` |

## 7. Minhas obras / Inventário (`/artworks`)

Captura: `shots/webapp/artista-1.png`, `galeria-1.png`.

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Seleção múltipla | Checkbox em cada cartão + barra "N obras selecionadas · Solicitar etiquetas · Listar no marketplace · ×" | **Ausente** | alta | `app/(panel)/artworks/page.tsx:44-61` |
| Filtros | Todas · Autenticadas · Em certificação · À venda · Vendidas · Rascunhos com contagem | Iguais | — | `lib/artworks/domain.ts:104-111` |
| Título da galeria | "Inventário" | "Acervo" (segue o Web Galeria, que é mais novo) | baixa | `app/(panel)/artworks/page.tsx:23` |
| Estado vazio | — | "Nenhuma obra aqui ainda." sem CTA | baixa | `app/(panel)/artworks/page.tsx:42` |

## 8. Cadastro de obra (`/artworks/new` → `/artworks/[id]/edit`)

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Passos e textos | "Ficha técnica · Mídia · Condition report · Histórico · Preço e disponibilidade · Revisão", "Salvo automaticamente", "Encontramos uma obra parecida", "Enviar para certificação" | Iguais (`WIZARD_STEPS`, `ArtworkWizard.tsx:136,149`) | — | — |
| Duplicidade | "São obras diferentes" / "É a mesma obra" | A decisão do artista é final; nada vai à equipe (ver §1) | alta | `lib/artworks/server.ts:144-151` |

## 9. Certificação (`/certification`)

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Kit de etiquetas | Igual ("Kit de etiquetas de autenticação…", −/+, "Pedir etiquetas · R$ 150") | Igual; depois do pedido o botão não vira "Pedido enviado" (mostra toast e o callout de pedido) | baixa | `components/certification/CertificationScreen.tsx:85` |
| ID sem etiqueta | "ID gerado ao vincular" | "sem etiqueta" | baixa | `components/certification/CertificationScreen.tsx:105` |
| Coluna Status | Selo da obra ("Em certificação"/"Autenticada"/"Rascunho") | Nome da etapa ("Etiqueta recebida"…) | baixa | `components/certification/CertificationScreen.tsx:114` |
| Modal HouseSign | "Assinar certificado" com o texto da autoria e carimbo ICP-Brasil | Existe (`signing`) | — | — |

## 10. Vendas e ofertas (`/sales`)

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Abas | "Ofertas recebidas · 3" / "Em andamento · 1" | Iguais + aba "Regras" (Web Galeria) | — | `app/(panel)/sales/page.tsx:41` |
| Linha da oferta | Miniatura, título, "quem · expira em", valor, "pedido R$ X · −7%", Recusar/Contrapropor/Aceitar | Igual + código da proposta | — | `components/offers/OffersTable.tsx:33-39` |
| Linha do negociador | "Negociador automático: ligado · aceita ofertas a partir de 92% do preço pedido." | Por `negotiatorLabel` | — | — |
| Em andamento | Timeline de 6 etapas com % + "Repartição dos valores" (Artista, Galeria, HouseArt · 12%, Em garantia) + transporte | `DealTimeline` com repartição e transporte | — | `components/deals/DealTimeline.tsx:47-49` |

## 11. Direito de sequência (`/royalty`)

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| KPIs | Com notas ("2 revendas", "1 transferência em curso", "desde a primeira certificação") | Sem notas; ano por `getUTCFullYear()` (não usa `lib/timezone.ts`) | baixa | `app/(panel)/royalty/page.tsx:16` |
| Tabela | Miniatura + título em itálico | Só o texto | baixa | `app/(panel)/royalty/page.tsx:21` |

## 12. CRM de colecionadores (`/crm`)

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Colunas | Interessados · Em conversa · Proposta · Fechado com contagem; cartão com iniciais, nome, interesse, valor, quando | Equivalente; move por `<select>` (sem arrastar); botão "+ Interessado" extra | baixa | `components/crm/Kanban.tsx:26-41` |

## 13. Carteira de escrituras (`/wallet`)

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Ações | Vender · Transferir · Segurar · Pedir laudo · **Registrar restauro** · Compartilhar certificado | Sem "Registrar restauro" | média | `components/wallet/WalletScreen.tsx:67-72` |
| Escritura | Logo horizontal + ID, Obra/Artista/Titular "CPF ***.482.***-07"/Desde/Apólice, "Carimbo do tempo ICP-Brasil" | Equivalente (+ "versão N") | — | `components/wallet/WalletScreen.tsx:57-65` |

## 14. Compras (`/purchases`)

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Cartão de recebimento | Cartão "A obra chegou?" / "Abra o app e encoste o celular na etiqueta do verso…" + "Confirmar recebimento"; depois "Escritura emitida em seu nome" | Botão dentro da timeline "Confirmar com o toque na etiqueta"; sem o cartão nem o estado pós-confirmação com esse texto | média | `components/deals/DealTimeline.tsx:82` |
| Cabeçalho do pedido | "Joana Teixeira · Galeria Ladeira · R$ 38.000 + R$ 1.110 frete e seguro" | Via `DealTimeline` | baixa | — |

## 15. Transferência fora da plataforma (`/transfer`)

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Stepper | Barra de 4 passos com traço (Comprador · Valor · Assinaturas · Toque do comprador) | Chips | baixa | `components/transfer/TransferWizard.tsx:63` |
| Preço selado | Toggle com descrição | Checkbox + parágrafo | baixa | `components/transfer/TransferWizard.tsx:76-77` |
| Taxa | "Taxa de transferência R$ 199" no passo 4 | No passo 3 | baixa | `components/transfer/TransferWizard.tsx:88` |
| Texto do passo 4 | "Luiza encosta… nome dela" | Gênero fixo "nome dela" para qualquer comprador | baixa | `components/transfer/TransferWizard.tsx:95` |

## 16. Marketplace (`/marketplace`)

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Filtros | Só autenticadas · Pintura · Até R$ 50 mil · Primário · Bahia | Os mesmos rótulos, mas **mutuamente exclusivos** (um por vez) | baixa | `app/(panel)/marketplace/page.tsx:8-25` |

## 17. Laudo de opinião de valor (`/appraisals`)

Captura: `shots/webapp/avaliador-0.png`.

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Fila | Linha com miniatura 48×48 + título itálico + "quem · prazo" | Sem miniatura (+ selo Atrasado/Na fila: ok) | baixa | `components/appraisal/AppraisalDesk.tsx:40-42` |
| Faixa | Inputs "Mínimo", "Sugerido" (borda ink) e "Máximo"; régua com segmento min–máx e marcador sand no sugerido | Rótulos "Mínimo (R$)…"; uma barra de progresso simples | média | `components/appraisal/AppraisalDesk.tsx:67-71` |
| Rodapé | "Laudo assinado · PDF com QR para a página pública" à esquerda do botão | Em callout separado | baixa | `components/appraisal/AppraisalDesk.tsx:74-75` |
| Dossiê | "Proveniência: 3 eventos · condition report excelente · etiqueta íntegra" | `provenanceLine` | — | — |
| Admin | — | A equipe abre a página (`hasTotalScope`), mas ela não está no menu do admin e não atribui avaliador | média (fora do protótipo) | `lib/profiles/nav.ts:81-86` |

## 18. Login

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Tela | E-mail/senha + "Entrar com e-mail" | Substituída pelo handoff de Entrar (fase 2) | — | fora deste escopo |

---

## As 15 correções de maior valor (em ordem)

1. **Fila de revisão realmente alimentada:** abrir `DUPLICATE` em `decideDuplicate` (as duas decisões, ou ao menos "São obras diferentes" entre contas distintas), `NEW_ISSUER` no primeiro lote de um tenant e `EXPORT_RESTRICTION` pela regra IPHAN. Dar efeito às decisões que hoje não fazem nada. Arquivos: `lib/artworks/server.ts:144-151`, `lib/admin-review/server.ts`.
2. **Decisões seguras na fila:**
   - confirmação com o efeito escrito e campo de motivo (sobretudo "Aprovar contestação" = revogar certificado);
   - botões desabilitados durante o envio;
   - erro em toast, sem sumir com o item.

   Arquivo: `components/admin/ReviewQueue.tsx`.
3. **Remover ou criar `/settings` e `/help`** no rodapé da sidebar e criar a catraca `nav-targets` que o CLAUDE.md promete. Arquivos: `components/layout/AppShell.tsx:61-62`, `lib/architecture/`.
4. **Navegação abaixo de 900 px** (gaveta com o `NAV` do perfil e a busca). Arquivos: `app/ds/cells.css:210`, `components/layout/AppShell.tsx`.
5. **Etiquetas em pt-BR e utilizáveis:**
   - rótulos para os status de etiqueta e de pedido, e o nome do membro em vez do id;
   - confirmação antes de "Enviar do lote";
   - `<label>` nos campos do novo lote.

   Arquivo: `components/admin/MarkersAdmin.tsx`.
6. **Importar o CSV de UIDs reais** ao criar lote (a API já aceita `uids`) e escolher o tenant de destino. Arquivo: `components/admin/MarkersAdmin.tsx:66-72`.
7. **Cobrança da casa para a equipe:** receita por plano, pedidos, comissões, repasses e falhas. Hoje a tela diz "Sua conta não tem plano". Arquivos: `app/(panel)/billing/page.tsx`, `lib/billing/server.ts`.
8. **Badges do menu vindos do servidor:**
   - Obras e certificados = itens abertos;
   - Certificação = pendências;
   - Vendas = ofertas abertas;
   - Compras = ativas;
   - Fila de laudos = pedidos.

   Arquivo: `app/(panel)/layout.tsx:22`.
9. **Detalhe do item de revisão:** obra, certificado e versões, leituras da etiqueta, a obra parecida lado a lado, texto da contestação, com links. Arquivo novo: `app/(panel)/admin/review/[id]`.
10. **Fidelidade visual da fila:**
    - miniatura (o `cover` já vem do servidor);
    - título em itálico display;
    - "há 2 h";
    - notas dos KPIs ("+N em <mês>", "tempo médio", "% das obras");
    - cores por tipo.

    Arquivos: `components/admin/ReviewQueue.tsx`, `app/(panel)/admin/review/page.tsx`.
11. **Busca do admin com escopo total:** obras em qualquer estado, certificados, IDs `HA-…`, negócios, usuários. Arquivos: `lib/search/server.ts`, `app/(panel)/search/page.tsx`.
12. **Telas mínimas de operação** (fora do protótipo): Negócios (garantia, repasse, "Tentar de novo"), Usuários/KYC e Auditoria no menu do admin. Arquivos: `lib/profiles/nav.ts:81` + novas páginas em `app/(panel)/admin/`.
13. **"/" para admin** redireciona à fila, ou vira um painel da casa, em vez do dashboard de galeria com "Nova obra". "Minha conta" no avatar abre a conta certa por perfil. Arquivos: `app/(panel)/page.tsx:32`, `components/layout/ProfileSwitcher.tsx:63`.
14. **Etiquetas no desenho:**
    - busca ao lado do título;
    - barra de progresso em "Vinculadas";
    - "Novo emissor";
    - notas dos KPIs;
    - lista dos alertas de remoção com ação.

    Arquivos: `components/admin/MarkersAdmin.tsx`, `app/(panel)/admin/markers/page.tsx`.
15. **Fidelidade das telas de produto:**
    - Dashboard com "Vendas em 2026" e "Obras recentes" em grade;
    - seleção múltipla em Minhas obras;
    - cartão escuro do plano em Cobrança;
    - "A obra chegou?" em Compras;
    - "Registrar restauro" na Carteira;
    - régua min/sugerido/máx no laudo;
    - faixa de índices no topo.

    Arquivos: `app/(panel)/page.tsx`, `app/(panel)/artworks/page.tsx`, `components/billing/BillingScreen.tsx`, `components/deals/DealTimeline.tsx`, `components/wallet/WalletScreen.tsx`, `components/appraisal/AppraisalDesk.tsx`, `app/(panel)/layout.tsx`.
