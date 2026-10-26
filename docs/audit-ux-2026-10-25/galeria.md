# Auditoria de fidelidade — experiência da Galeria (e do Consultor) na web

Data: 2026-10-25 · Somente leitura (nenhum arquivo do repo editado).

Referências lidas:
- Protótipo principal: `houseart-design/handoff/designs/HouseArt Web Galeria.dc.html` (template linhas 1–1473 + `<script type="text/x-dc">` linhas 1474–2490, lido por completo nas partes da galeria: Galeria/painel, Acervo, Negócios, Venda, Lista, Gestão do anúncio, Conta, Mensagens/Conversa, Contraproposta, Cadastrar obra, Instagram e `out.atalhos`).
- `HouseArt App Galeria.dc.html`: mesma lógica (diff do script = 2 linhas: só o fundo do item ativo da sidebar e a posição do painel de Conta).
- Screenshots `0[1-7]-41-web-galeria.jpg` (Entrar, Acervo, Comunidade) e `0[4,6]-31-app-galeria.jpg` (Ofertas, Regras).
- Implementação: `components/layout/AppShell.tsx`, `lib/profiles/nav.ts`, `app/(panel)/page.tsx`, `components/gallery/*`, `app/(panel)/artworks/**`, `app/(panel)/sales/**`, `app/(panel)/gallery/**`, `components/offers/OffersTable.tsx`, `components/deals/DealTimeline.tsx`, `components/messaging/*`, `components/community/*`, `app/ds/cells.css`.
- Tentativa de renderizar o protótipo localmente: o runtime `support.js` não hidratou offline (os `{{ }}` ficaram crus); a comparação foi feita pelo código do protótipo e pelos screenshots.

## Resumo

A galeria tem as **telas certas como funções** (painel do dia, acervo com chips, gestão do anúncio, ofertas, regras, equipe, artistas, conta), e várias reproduzem bem o texto do protótipo (Regras de ofertas, KPIs do painel, chips do Acervo). O que mais se afasta do desenho é **estrutural**:

1. **Casca e navegação**: o protótipo tem 5 entradas (Acervo · Negócios · Comunidade · Mensagens · Galeria) e tudo o mais mora no painel de Conta; a implementação herdou a sidebar de 14 itens do "Web App" antigo, com rótulos diferentes ("Inventário", "Vendas e ofertas", "Início") e dois links quebrados no rodapé (`/settings`, `/help`). Abaixo de 900 px a sidebar some **sem nenhuma navegação substituta**.
2. **Painel lateral de detalhe** (handoff §7: "web logado com painel lateral de detalhe no desktop"): no protótipo obra, venda, conversa, equipe/artistas e conta abrem num painel de 600 px à direita sobre a lista. Na implementação tudo é página cheia; não existe o componente de painel lateral.
3. **Negócios**: o cartão de oferta do protótipo (comprador com perfil, mensagem, "outras ofertas nesta obra", "Conversar com…", insight no topo, contraproposta pré-preenchida) virou uma linha de tabela genérica; a lista de **Vendas até o repasse** (barra de 6 segmentos + ação + painel "Venda · data" com financeiro e agendamento de coleta) virou o `DealTimeline` do Web App, sem conversar, sem agenda, com fases diferentes.
4. **Painel do dia** sem Agenda, sem os botões do cabeçalho e com 2 dos 4 atalhos; "Precisa de você" sem mensagens sem resposta e sem rascunhos.
5. Pendentes registradas na catraca: **Cadastrar obra** (fluxo da galeria com "De onde vem esta obra?") e **Instagram** (`lib/architecture/handoff-screens.ts:31-35`, valores `null`).

Contagem de linhas nas tabelas: 17 alta · 45 média · 39 baixa (inclui a tabela de alvos de navegação, que repete alguns itens).

---

## 0. Casca (topbar + sidebar) — protótipo linhas 20–43

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Entradas da sidebar | 5: `Acervo` (imagesmode) · `Negócios` (handshake) · `Comunidade` (ícone próprio em caixa sand 38 px) · `Mensagens` (chat_bubble) · `Galeria` (storefront = painel do dia) (`out.tabs`, script l.278) | 14 itens: Início, Inventário, Nova obra, Certificação, Vendas e ofertas, Pix para receber, Colecionadores, Mensagens, Comunidade, Direito de sequência, Cobrança, Equipe, Artistas, Conta da galeria | alta | `lib/profiles/nav.ts:40-55` (GALLERY; advisor reusa em l.~95) |
| Rótulos | "Acervo", "Negócios", "Galeria" | "Inventário" (mas a página diz "Acervo"), "Vendas e ofertas", "Início" | alta | `lib/profiles/nav.ts:42,46,41` |
| Ordem / tela inicial | painel do dia é a aba "Galeria", última; app abre nela (`tab: 'perfil'`) | "Início" primeiro (ok abrir em `/`), mas o nome diverge | baixa | `lib/profiles/nav.ts:41` |
| Badge de Negócios | número de ofertas pendentes em sand-500 (`badge: k === 'negocios' && nOf`) | só Mensagens recebe badge | média | `app/(panel)/layout.tsx:22` (passar `sales: open offers`) |
| Rodapé da sidebar | links de protótipo (não são produto) | "Configurações" → `/settings` e "Ajuda" → `/help` — **rotas que não existem (404)** | alta | `components/layout/AppShell.tsx:60-63` |
| Itens fora do protótipo | Certificação, Pix, Cobrança, Equipe, Artistas, Direito de sequência ficam dentro de "Conta" (`ctSecoes`) | estão soltos na sidebar; Colecionadores (CRM) e Direito de sequência não aparecem no Web Galeria | média | `lib/profiles/nav.ts:43-55`; `app/(panel)/gallery/account/page.tsx:23-44` |
| Topbar · marca | `full_vert_color` 48 px + texto "Galeria" ao lado (12 px ink-500) | logo 48 px sem o rótulo do sistema | baixa | `components/layout/AppShell.tsx:36` |
| Topbar · busca | botão-campo "Buscar obras, artistas ou certificados" que abre a Busca | form com placeholder "Buscar obras, artistas, galerias ou IDs" | baixa | `components/layout/AppShell.tsx:37-40` |
| Topbar · direita | pill "Ver como colecionador" (swap) + botão conta (iniciais + "Galeria Ladeira") que abre o painel Conta | sino + ProfileSwitcher (rótulo do perfil, não o nome da galeria) | média | `components/layout/AppShell.tsx:41-44`, `components/layout/ProfileSwitcher.tsx:44-47` |
| Faixa de índices | não existe no Web Galeria | `IndexTicker` no topo (vazio aqui, mas o shell o reserva) | baixa | `components/layout/AppShell.tsx:34` |
| Responsivo < ~1024 px | protótipo empilha em tela cheia; o App Galeria tem tab bar de 5 | `@media (max-width:900px){.ha-sidebar{display:none}}` e **nenhuma nav substituta** (sem hambúrguer, sem tab bar) — o usuário fica sem menu | alta | `app/ds/cells.css:210`, `components/layout/AppShell.tsx` |
| Consultor (advisor) | usa as telas da galeria (B.1) | mesma nav, mas com "Conta da galeria", "Equipe", "Artistas" para um autônomo PF | média | `lib/profiles/nav.ts` (`advisor: GALLERY`) |
| Estados de carregamento/erro | spinner + gerúndio (§7) | nenhum `loading.tsx`/`error.tsx` em `app/(panel)` | média | `app/(panel)/` |

## 1. Galeria · painel do dia — protótipo template l.44–90, script l.373–399

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Cabeçalho | avatar GL (botão → Conta) · data · nome em Fraunces 24 · botões `search`, `notifications` (ponto alert) e `settings` | avatar estático e nome; **sem os 3 botões** | média | `components/gallery/DayPanel.tsx:16-19` |
| KPIs | 4, o 1º escuro; detalhe "2 obras · +18% vs. setembro" | 4 iguais, sem a comparação com o mês anterior | baixa | `lib/gallery/domain.ts:28` |
| "Precisa de você" · oferta | "Oferta de R$ 34.000" · "Construção nº 7 · Helena Vaz · 89% do preço" · tag "expira 20 h" | sub com `differenceLabel` (diferença, não % do preço); tag "expira em …" | baixa | `lib/gallery/panel-server.ts:36` |
| "Precisa de você" · venda | itens por etapa: "Confirmar venda" / "Embalar para envio" / "Agendar coleta" → abrem a Venda | "Assinar o termo…" e "Embalar e agendar a coleta" → `/sales?tab=deals` (lista, não a venda) | média | `lib/gallery/panel-server.ts:38-39` |
| "Precisa de você" · mensagens | "2 mensagens sem resposta" · nomes · tag "responder" → Mensagens | **ausente** | média | `lib/gallery/panel-server.ts` (usar `unreadMessages`) |
| "Precisa de você" · certificado | "Certificado aguardando a artista" · tag "lembrar" (envia lembrete) | "N obras em certificação" → `/certification` (sem lembrete) | média | `lib/gallery/panel-server.ts:41` |
| "Precisa de você" · rascunhos | "N obras sem certificado · peça a certificação" → Acervo filtro Rascunhos | **ausente** | média | `lib/gallery/panel-server.ts` (link `/artworks?filter=drafts`) |
| Agenda | seção "Agenda" com dia/mês: visita marcada, coleta, abertura (evento da comunidade) | **ausente** | alta | `components/gallery/DayPanel.tsx` (+ dados de eventos/coleta) |
| Obras mais vistas | stats "46 salvos · 214 curtidas · 2 ofertas"; abre a obra | só "N ofertas"; abre `/artworks/[id]/listing` | média | `components/gallery/DayPanel.tsx:48`, `app/(panel)/page.tsx:24` |
| Atalhos | 4: Nova obra · Publicar post · Criar evento · Ver marketplace | 2: Nova obra · Ver marketplace | média | `components/gallery/DayPanel.tsx:53-56` |
| "Ver marketplace" | leva ao feed logado (Explorar) | `/e/marketplace` (site público, sai da casca) | baixa | `components/gallery/DayPanel.tsx:55` |
| Estado vazio | "Tudo em dia por aqui." (task_alt, verde) | igual | — | — |

## 2. Acervo — protótipo l.92–113, script l.400–407

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Título / resumo / botão + | "Acervo" · "7 obras · R$ 88.800 à venda" · botão circular `add` | igual | — | — |
| Chips | Todas · À venda · Reservadas · Vendidas · Em certificação · Rascunhos (6) | + "Autenticadas" (7) | baixa | `components/gallery/inventory-core.ts:14-22` |
| Busca | filtra ao digitar | form GET (só filtra com Enter) | baixa | `components/gallery/InventoryList.tsx:18-22` |
| Linha · à venda | "1.820 views · 46 salvos · 2 ofertas" | "1.820 views · 7 dias · 2 ofertas" (sem salvos) | média | `components/gallery/inventory-core.ts:78-84` |
| Linha · vendida/reservada | "Vendida para Helena Vaz · embalar e condition report" | "Vendida" / "Negócio em andamento" (sem comprador nem etapa) | média | `components/gallery/inventory-core.ts:85,89` |
| Linha · em certificação | "Aguardando assinatura da artista" | "Vincule a etiqueta e assine o certificado" | baixa | `components/gallery/inventory-core.ts:86` |
| Linha · rascunho | "Peça a certificação para anunciar" | "Complete o cadastro e peça a certificação" | baixa | `components/gallery/inventory-core.ts:88` |
| Clique na linha | abre a **obra no painel lateral** (foto, ficha, Gestão do anúncio, certificado, proveniência) | abre o wizard de cadastro `/artworks/[id]/edit`; Gestão é um link à parte | alta | `components/gallery/InventoryList.tsx:32,43-44` |
| Título da aba do navegador | — | "Minhas obras — HouseArt" para a galeria | baixa | `app/(panel)/artworks/page.tsx:12` |
| Estado vazio | "Nenhuma obra neste filtro." | igual (+ variante de busca) | — | — |

## 3. Obra da galeria + Gestão do anúncio — protótipo l.470–542, script l.466–481

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Contêiner | painel lateral 600 px com voltar, compartilhar, salvar, curtir; foto com zoom, miniaturas, artista ›, título, ficha, preço+parcela, curtidas/comentários, certificado ("Ver certificado público →"), proveniência, garantias | página `/artworks/[id]/listing` só com cabeçalho texto + bloco de gestão; **sem foto, certificado, proveniência** | alta | `app/(panel)/artworks/[id]/listing/page.tsx` |
| Stats | views · salvos · curtidas · ofertas (números reais) | salvos e curtidas fixos "—" | média | `components/gallery/listing-manager-core.ts:68-75` (ArtworkReaction/favoritos existem) |
| Salvar preço · toast | "Preço reduzido · 46 pessoas que salvaram foram avisadas" | "Preço reduzido" | baixa | `components/gallery/listing-manager-core.ts:29-31` |
| Pausar · textos | "Some do marketplace sem perder curtidas" / "Fora do marketplace · curtidas e salvos mantidos" | "…sem perder o mandato" / "…mandato e ofertas mantidos" | baixa | `components/gallery/listing-manager-core.ts:44-46` |
| "Ofertas desta obra" | Negócios › Ofertas | `/sales` sem filtrar pela obra | média | `components/gallery/ListingManager.tsx:72` |
| "Enviar a um cliente" | abre a folha Compartilhar com a mensagem pré-escrita e "privado" ligado | copia texto para a área de transferência (sem folha) | média | `components/gallery/ListingManager.tsx:44-48,73` (usar `components/public/ShareSheet.tsx`) |
| "Vendida fora" | marca como vendida + "registre o comprador para transferir a escritura" | vai a `/transfer?artworkId=`, que só lista obras de que **o usuário** é titular e, se não achar, cai em `held[0]` (outra obra) ou "Você ainda não é titular" — risco de abrir a obra errada para a equipe da galeria | alta (verificar) | `components/gallery/ListingManager.tsx:74`, `app/(panel)/transfer/page.tsx:12-16` |
| Obra sem anúncio | botões "Vender esta obra" / "Peça certificação" / "Em certificação · visita agendada" / "Reservada · em negociação" | callout "A obra não está à venda. Abra o cadastro…" | média | `app/(panel)/artworks/[id]/listing/page.tsx:37-39` |

## 4. Negócios — protótipo l.115–169, script l.409–431

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Título | "Negócios" | "Vendas e ofertas" | média | `app/(panel)/sales/page.tsx:40` |
| Abas | "Ofertas · 2" · "Vendas · 2" · "Regras" (Regras visível a todos; o lock é por papel) | "Ofertas recebidas" · "Em andamento" · "Regras" (oculta para quem não é Admin; em `/sales/rules` as abas não têm contagem) | média | `app/(panel)/sales/page.tsx:41`, `app/(panel)/sales/rules/page.tsx:12` |

### 4.1 Ofertas recebidas

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Insight no topo | faixa sand com `insights`: "2 ofertas disputam Construção nº 7. A maior é 96% do preço." / "N ofertas abertas. Responda antes do prazo…" | **ausente** | média | `components/offers/OffersTable.tsx` |
| Layout | cartão por oferta (borda ink se pendente) | linha de tabela `ha-list__row` | alta | `components/offers/OffersTable.tsx:27-44` |
| Obra | miniatura clicável (abre a obra) + título itálico + "Preço R$ 38.000" | miniatura 40 px não clicável, título bold | média | idem l.30-32 |
| Valor | "R$ 34.000" + "89% do preço" colorido (verde ≥90, ink ≥75, alert <75) | valor + "pedido R$ … · {differenceLabel}" sem cor | média | idem l.33 |
| Comprador | avatar + nome + "Colecionadora verificada · 4 compras na HouseArt" | texto `buyer` no subtítulo; **código da oferta (`HA-…`) exposto** na linha | média | idem l.31 |
| Prazo | pill pending "expira em 20 h" | texto "expira em …" | baixa | idem l.31 |
| Mensagem do comprador | "“Posso buscar na galeria na sexta.”" | ausente (a mensagem existe em `rounds[].message`, `lib/offers/dto.ts:10`) | média | `components/offers/OffersTable.tsx`, `app/(panel)/sales/page.tsx:44-46` |
| Outras ofertas | "1 outra oferta nesta obra · maior R$ 36.500" (stacked_line_chart) | ausente | média | idem |
| Botões | **Aceitar** (sand, 1º) · Contrapropor (contorno) · Recusar | Recusar · Contrapropor · Aceitar (ordem invertida) | baixa | `components/offers/OffersTable.tsx:36-38` |
| Conversar | "Conversar com Helena" em todo cartão | ausente | alta | idem |
| Resolvida | "Aceita · aguardando pagamento do comprador", "Paga em garantia · prepare a embalagem", "Contraproposta enviada · aguardando Helena" | Badge com `statusLabel` genérico | baixa | idem l.39 |
| Aceitar · toast | "Oferta aceita · Helena tem 24 h para pagar · outras ofertas foram encerradas" | "Oferta aceita · o comprador tem 24 h para pagar em garantia" | baixa | idem l.21 |
| Linha extra | — | "Negociador automático: …" no rodapé (não está no desenho) | baixa | idem l.46 |
| Estado vazio | "Nenhuma oferta aberta agora." | "Nenhuma proposta ainda." | baixa | idem l.28 |

### 4.2 Contraproposta (folha) — template l.1320–1327, script l.913–917

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Título | "Contraproposta" | "Contrapropor" | baixa | `components/offers/OffersTable.tsx:48` |
| Texto | "Helena Vaz ofereceu R$ 34.000 em Construção nº 7. Seu preço é R$ 38.000." | "{obra} · proposta atual R$ …" | baixa | idem l.49 |
| Campo | "Sua contraproposta" com prefixo R$ e máscara de milhar, **pré-preenchido no ponto médio** (`r500((valor+preço)/2)`) | "Valor da contraproposta (R$)" vazio, sem máscara | média | idem l.50 e l.40 (`setAmount('')`) |

### 4.3 Vendas (lista) e Venda (detalhe) — template l.150–158 e 841–866, script l.432–457

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Lista | linha compacta: miniatura, título, "Helena Vaz · 18/10", valor, barra de **6 segmentos**, etapa + pill de ação ("Confirmar", "Embalar", "Agendar coleta", "Acompanhar", "Aguardando comprador", "Concluída") | cada negócio vira um cartão grande `DealTimeline` expandido (barra %, timeline completa) | alta | `app/(panel)/sales/page.tsx:47-49`, `components/deals/DealTimeline.tsx` |
| Detalhe "Venda · 18/10" | painel lateral: obra › · comprador (avatar, "Colecionadora · Rio de Janeiro · entrega em Rua das Flores, 120", botão chat) · status · timeline · **Financeiro** · botão de ação + "Conversar com Helena" | não existe tela de detalhe; o cartão não tem comprador detalhado nem conversar | alta | criar painel/rota de venda (`app/(panel)/sales/[dealId]` ou painel lateral) |
| Etapas | Pago em garantia · Embalar e condition report · Agendar coleta · Em trânsito · Entregue · Repasse liberado (`VE`) | Oferta aceita · Pagamento em garantia · Documentação e assinatura · Retirada e transporte · Entrega e leitura da etiqueta · Escritura emitida (fases do Web App) | média | `lib/deals/domain.ts:8-15` (rótulos de exibição) |
| Embalagem | "Registrar embalagem e condition report" (fotos) | ausente; há "Registrar envio" com 3 inputs (transportadora/rastreio/seguradora) | média | `components/deals/DealTimeline.tsx:52-59` |
| Agendar coleta | seletor de 5 dias (qui 22 manhã…) + "Agendar coleta · qui 22/10" | ausente | média | idem |
| Financeiro | Valor da venda · "Comissão HouseArt · 12%" · "Repasse a Joana · 50% do líquido" · **"Galeria recebe"** | "Repartição dos valores" com rótulos do split (`HouseArt · 12%`) | baixa | idem l.47-48 |
| Concluída | "Baixar comprovante e nota" | ausente | média | idem |
| Aba quando `FLAG_DEALS` desligada | — | lista vazia "Nenhuma venda em andamento." | baixa | `app/(panel)/sales/page.tsx:32` |

### 4.4 Regras de ofertas — template l.159–168, script l.425–431

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Texto, itens, chips 60/70/80 %, 24/48/72 h | idênticos | idênticos | — | `components/gallery/OfferRulesScreen.tsx` |
| "Avisar a equipe de vendas" · sub | "Caio recebe as ofertas junto com você" | "Quem tem o papel Vendas recebe…" (genérico, aceitável) | baixa | idem l.53 |
| Contexto | aba dentro de Negócios | página própria "Regras de ofertas" com abas copiadas sem contagem | baixa | `app/(panel)/sales/rules/page.tsx:21-22` |
| "Você pode mudar obra a obra na página dela" | promessa do texto | a Gestão do anúncio só tem o toggle "Aceita ofertas" (não há regra por obra) | baixa | `components/gallery/ListingManager.tsx` |

## 5. Mensagens e Conversa — template l.357–378 e 1022–1057

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Lista + conversa | lista na área principal; conversa em painel lateral 600 px | lista + conversa à direita a partir de 1024 px (ok, padrão equivalente) | — | `components/messaging/MessagesScreen.tsx` |
| Estado vazio | "Nenhuma conversa encontrada." | para a galeria aparece o texto do colecionador: 'Toque em "Falar com a galeria" na página de uma obra…' | média | `components/messaging/MessagesScreen.tsx:79` |
| Cabeçalho da conversa | botão `flag` "Denunciar" | ausente | baixa | `components/messaging/ConversationPane.tsx` |
| Cartão da obra | "Sua obra · R$ 38.000" | verificar texto (sem "Sua obra") | baixa | idem |
| Respostas rápidas da galeria | "Sim, segue disponível" · "Quinta às 15h funciona?" · "Envio o condition report" · "Frete grátis em Salvador" | `QUICK_REPLIES[role]` existe (conferir textos) | baixa | `components/messaging/ConversationPane.tsx:120-121` |
| Enviar foto | botão `photo_camera` no compositor | ausente | baixa | idem l.~125 |

## 6. Comunidade e eventos — template l.269–355

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Abas | Para você · Seguindo · Eventos | + Notícias · Salvos (5 abas) | baixa | `components/community/community-core.ts:8-12` |
| Prompt | "Publique uma obra, abertura ou novidade…" | igual para galeria/consultor | — | `app/(panel)/community/page.tsx:31` |
| Compartilhar post | folha Compartilhar | copia o link ("Copiado") | baixa | `components/community/CommunityScreen.tsx:77-80` |
| Post para Instagram | toggle Instagram no composer com prévia | ausente (Instagram pendente) | média | `components/community/Composer.tsx` |

## 7. Equipe — script l.458–464

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Subtítulo | "Cada pessoa vê só o que o papel permite. Ofertas acima de R$ 50 mil pedem aprovação da diretora." | só a 1ª frase (regra de aprovação não existe) | baixa | `components/gallery/TeamScreen.tsx:65` |
| Linhas, tags (Admin/Vendas/Acervo/Pendente), "Convidar pessoa" | iguais | iguais, com folha de papel e revogar (a mais) | — | — |
| Contêiner | painel lateral sobre a Conta | página cheia | média | `app/(panel)/gallery/team/page.tsx` |

## 8. Artistas representados — script l.458–464

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Sub e "Convidar artista" | "A divisão de cada venda sai automática pelo contrato…" | igual | — | `components/gallery/ArtistsScreen.tsx:72,89` |
| Linha | "3 obras no acervo · contrato até 12/2027" + tag "Representado"/"Consignação" | sub do servidor + tag do tipo de contrato | baixa | idem l.80-82 |
| Clique | abre o **perfil público do artista** | abre o modal do contrato (não há caminho para o perfil) | média | idem l.76 |

## 9. Conta, equipe e repasses — template l.798–839, script l.751–790

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Acesso | botão da conta no topo e engrenagem do painel abrem o painel "Galeria" | item "Conta da galeria" na sidebar | média | `components/layout/AppShell.tsx`, `lib/profiles/nav.ts:54` |
| Cabeçalho | nome da **galeria** + e-mail + "CNPJ, e-mail e celular verificados" (verified_user) | nome do **usuário** + e-mail; sem selo de verificação | média | `app/(panel)/gallery/account/page.tsx:48`, `components/gallery/AccountScreen.tsx:20-27` |
| Galeria › Dados da galeria | formulário (nome/CNPJ travados, e-mail, celular com máscara, cidade, bio, "Salvar alterações") | **ausente** | alta | `components/gallery/AccountScreen.tsx` + rota de dados |
| Galeria › Endereço e horários | "Rua Direita de Santo Antônio, 88 · ter a sáb, 10h–19h" | ausente (talvez em `/gallery/public`) | média | `app/(panel)/gallery/account/page.tsx:24-28` |
| Recebimentos | Pix para repasses · **Divisão com artistas** · **Notas fiscais** | só Pix | média | idem l.29-31 |
| Plano | "Plano Galeria Pro · R$ 899/mês · 18 de 40 certificações usadas" | "Plano e cobrança · Plano, uso do mês e faturas" (sem o dado) | baixa | idem l.33 |
| Redes sociais › Instagram | item com estado conectado | ausente | média | idem |
| Segurança | Alterar senha · Face ID · Aparelhos conectados | só Alterar senha (→ `/recover-password`) | baixa | idem l.37-38 |
| Notificações | "Ofertas e mensagens" e "Resumo diário por e-mail" (toggles) | ausente | média | idem |
| Ajuda | Gerente de conta · Central de ajuda | só Central (→ `/e/how-it-works`) | baixa | idem l.40 |
| Sair / Excluir | "Sair da conta" com confirmação; "Excluir minha conta" (bloqueio com negociações, digitar EXCLUIR) | Sair sem confirmação; **sem Excluir** | média | `components/gallery/AccountScreen.tsx:43` |

## 10. Cadastrar obra (galeria) — template l.626–797, script l.640–740 · catraca: `null`

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Fluxo | 5 passos: **"De onde vem esta obra?"** (Consignação de artista · Acervo próprio da galeria · Revenda para colecionador · Outro) → Fotos guiadas → Ajuste → Ficha → Serviços (certificação, laudo, condition…) → Revisão → "Obra cadastrada" | wizard do Web App em 6 passos (Ficha técnica, Mídia, Condition report, Histórico, Preço, Revisão), sem origem nem serviços | alta | `components/artworks/ArtworkWizard.tsx`, `lib/artworks/domain.ts:101`; registro pendente em `lib/architecture/handoff-screens.ts:33` |

## 11. Instagram · conectar e postar — template l.885–913, script l.830–858 · catraca: `null`

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Tela | benefícios, "Conectar", preferências (ligado por padrão, Saiba mais, marcar artista), posts enviados com alcance/cliques, desconectar | inexistente (depende de provedor) | média | `lib/architecture/handoff-screens.ts:34` |

## 12. Navegação: alvos quebrados ou errados

| Origem | Alvo | Problema | Severidade |
|---|---|---|---|
| `components/layout/AppShell.tsx:61` | `/settings` | rota não existe | alta |
| `components/layout/AppShell.tsx:62` | `/help` | rota não existe | alta |
| `components/gallery/ListingManager.tsx:74` | `/transfer?artworkId=` | pode abrir outra obra (fallback `held[0]`) ou recusar para a equipe da galeria | alta (verificar) |
| `components/gallery/ListingManager.tsx:72` | `/sales` | não filtra pela obra | média |
| `lib/gallery/panel-server.ts:38-39` | `/sales?tab=deals` | não abre a venda específica | média |
| `components/gallery/DayPanel.tsx:55` | `/e/marketplace` | sai do sistema logado | baixa |

---

## As 12 correções de maior valor (priorizadas)

1. **Navegação móvel/estreita**: hoje abaixo de 900 px a galeria fica sem menu. Adicionar tab bar de 5 (ou gaveta) espelhando o App Galeria. `app/ds/cells.css:210`, `components/layout/AppShell.tsx`.
2. **Links quebrados do rodapé** (`/settings`, `/help`): apontar para `/gallery/account` e `/e/how-it-works` (ou remover). `components/layout/AppShell.tsx:60-63`.
3. **Sidebar da galeria/consultor com as 5 entradas do desenho** (Acervo · Negócios · Comunidade · Mensagens · Galeria), rótulos idênticos, badge de ofertas pendentes em Negócios; mover Equipe, Artistas, Pix, Cobrança, Certificação para dentro da Conta. `lib/profiles/nav.ts:40-55`, `app/(panel)/layout.tsx:22`.
4. **Cartão de oferta fiel**: comprador com perfil, mensagem (`rounds[].message`), "% do preço" colorido, "outras ofertas nesta obra", insight no topo, ordem Aceitar · Contrapropor · Recusar, "Conversar com X"; contraproposta pré-preenchida no ponto médio com máscara. `components/offers/OffersTable.tsx`.
5. **Painel lateral de detalhe** (componente único, 600 px, Esc fecha, 240 ms) e usá-lo para obra/gestão, venda, equipe, artistas e conta. Novo `components/ds/SidePanel.tsx` + páginas acima.
6. **Vendas até o repasse**: lista compacta com barra de 6 segmentos e ação; detalhe "Venda · data" com comprador, conversar, agendar coleta, embalagem/condition report, Financeiro ("Galeria recebe") e "Baixar comprovante e nota". `app/(panel)/sales/page.tsx`, `components/deals/DealTimeline.tsx`.
7. **"Vendida fora"** não pode cair no `/transfer` do titular pessoa física: tratar a obra da galeria explicitamente (e nunca abrir outra obra no fallback). `components/gallery/ListingManager.tsx:74`, `app/(panel)/transfer/page.tsx:12-16`.
8. **Obra da galeria = página da obra + Gestão**: foto, ficha, certificado público, proveniência, e o clique da linha do Acervo abrindo a obra (não o wizard); stats de salvos/curtidas reais. `app/(panel)/artworks/[id]/listing/page.tsx`, `components/gallery/InventoryList.tsx:32`, `components/gallery/listing-manager-core.ts:68-75`.
9. **Painel do dia completo**: Agenda, botões busca/avisos/configurações, 4 atalhos (Publicar post, Criar evento), itens "mensagens sem resposta" e "obras sem certificado", links diretos para a venda. `components/gallery/DayPanel.tsx`, `lib/gallery/panel-server.ts`.
10. **Conta da galeria**: cabeçalho com o nome da galeria e selo de verificação, "Dados da galeria" editável, Divisão com artistas, Notas fiscais, Notificações, Excluir conta, Sair com confirmação. `app/(panel)/gallery/account/page.tsx`, `components/gallery/AccountScreen.tsx`.
11. **Cadastrar obra da galeria** com o passo "De onde vem esta obra?" (consignação/acervo próprio/revenda/outro) e o passo de Serviços — hoje pendente na catraca. `components/artworks/ArtworkWizard.tsx`, `lib/architecture/handoff-screens.ts:33`.
12. **Textos e estados**: título "Negócios" e abas "Ofertas · N / Vendas · N / Regras", "Acervo" no nav e no `<title>`, vazio de Mensagens específico da galeria ("Nenhuma conversa encontrada."), textos das linhas do Acervo ("Vendida para … · etapa", "Aguardando assinatura da artista") e `loading.tsx`/`error.tsx` no painel. `app/(panel)/sales/page.tsx:40-41`, `app/(panel)/artworks/page.tsx:12`, `components/messaging/MessagesScreen.tsx:79`, `components/gallery/inventory-core.ts:78-90`.
