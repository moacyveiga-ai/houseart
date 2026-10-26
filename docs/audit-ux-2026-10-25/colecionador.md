# Auditoria UX/UI: Colecionador na web (perfil `collector`, logado)

**Referência:** `houseart-design/handoff/designs/HouseArt Web Colecionador.dc.html` (abreviado **WC**, linhas do arquivo original) e, para o App, a cópia nova `houseart-design/handoff/designs/HouseArt App Colecionador.dc.html` (**AC**). O protótipo WC foi renderizado localmente (React/Babel servidos do npm, imagens da Wikimedia bloqueadas) e percorrido com Playwright em 1440×900. As capturas e os dumps de texto estão em `(captura local da auditoria)`.
**Implementação:** só leitura de código. Não subi app nem banco.

## Resumo

O colecionador web tem as **funções** do protótipo quase todas, mas **não a arquitetura do Web Colecionador**:

1. **Navegação.** O protótipo tem 5 entradas: Explorar · Coleção · Comunidade · Mensagens · Perfil (WC:1570). O app tem 11 (`lib/profiles/nav.ts:67-79`). Coleção, Favoritos, Compras e Vendas viraram páginas soltas.
2. **Painel lateral de detalhe.** A regra global do README §7 ("web logado com painel lateral de detalhe no desktop") não existe. Obra, perfil, compra e conta abrem como página cheia. A obra sai do shell para o site público `/e/artwork/…`, que perde o menu e as ações de dono.
3. **"Minha coleção" não existe.** Faltam o cabeçalho com resumo, os 4 KPIs, as abas Obras · Favoritos · Curtidos · Compras · Vendas e a grade de obras com status. Hoje `/wallet` é a "Carteira de escrituras" do desenho antigo (Web App).
4. **Faltam fluxos:**
   - a lista das **próprias ofertas** na web (a API `offersOfUser` existe só para o mobile);
   - os **Anúncios ativos** em Vendas;
   - a **conversa a partir da oferta recebida**;
   - o **cadastro de obra** com fotos guiadas e ficha (hoje são 3 passos sem foto);
   - o **checkout** com Pix, Boleto e parcelas.
5. **Links quebrados.** O rodapé da sidebar aponta para `/settings` e `/help`, que não existem (404). Não há `loading.tsx` nem `error.tsx` em nenhuma rota.

Textos que já batem bem: o feed do Explorar, o deck Descobrir, a Comunidade, a lista de Mensagens com o filtro de contato, o Pix para receber, a Busca e a jornada de compra.

---

## 1. Shell (topo + sidebar)

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Itens do menu | 5: Explorar, Coleção, Comunidade, Mensagens (badge), Perfil (WC:1570) | 11: Explorar, Carteira de escrituras, Carteira e cartões, Compras, Vendas, Transferir obra, Marketplace, Mensagens, Comunidade, Favoritos, Minha conta | alta | `lib/profiles/nav.ts:67-79` |
| Rótulo "Perfil" | "Perfil" | "Minha conta" (no menu); o h1 diz "Perfil" | baixa | `lib/profiles/nav.ts:78` |
| Ícone de Comunidade | SVG próprio dentro de uma caixa 38px `sand-500` (`t.isCustom`) | `forum` do Material | baixa | `lib/profiles/nav.ts`, `components/layout/AppShell.tsx:53` |
| Topo, ao lado da marca | Marca + rótulo "Colecionador" | Marca 48px, sem rótulo (o perfil aparece no switcher) | baixa | `components/layout/AppShell.tsx:35` |
| Busca do topo | Botão "Buscar obras, artistas ou certificados" que abre a tela Busca | Input com placeholder "Buscar obras, artistas, galerias ou IDs" (texto diferente) | baixa | `AppShell.tsx:38` |
| Ações à direita | "Ver como galeria" (pílula swap_horiz) + chip com iniciais e **nome** "Marina Lopes" que abre Perfil | Sino + ProfileSwitcher (iniciais + "Colecionador"). O nome não aparece e o chip não leva ao Perfil | média | `AppShell.tsx:41-42`, `components/layout/ProfileSwitcher.tsx` |
| Rodapé da sidebar | (links de demo entre protótipos, não vão para produção) | "Configurações" → `/settings` e "Ajuda" → `/help`, **as duas rotas não existem (404)** | **alta** | `AppShell.tsx:61-62` |
| Estados de carregamento e erro | README §7: spinner + texto no gerúndio, overlays | Não há `loading.tsx`/`error.tsx` em `app/` | média | `app/(panel)/*` |

## 2. Explorar · Feed (`/explore`)

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Cabeçalho | Sem título. Só os ícones search/bookmark à direita, segmentado Feed/Descobrir e chips | h1 "Explorar" + ícones | baixa | `components/collector/ExploreScreen.tsx:53-57` |
| Chips | `Tudo, Pintura, Fotografia, Desenho, Até R$ 10 mil, Aceita ofertas` (WC:1577) | `Tudo, Pintura, Fotografia, Obra sobre papel, Escultura, Até R$ 10 mil, Aceita ofertas` (falta "Desenho") | média | `components/collector/explore-core.ts:10-18` |
| Cabeçalho do cartão | Avatar clicável → perfil do vendedor. Sub "Galeria · Salvador, BA" / "Colecionador · Salvador, BA" | Avatar e nome não clicáveis. Sub "Galeria/Particular · UF" (sem cidade; "Particular" no lugar de "Colecionador") | média | `ExploreScreen.tsx:73-76` |
| Pílula de mercado | "Primário" / **"Revenda"** (WC `merc`) | "Primário" / **"Secundário"** | média | `ExploreScreen.tsx:22` |
| Linha de ações | ♥ **com contagem** · 💬 **com contagem (abre Comentários)** · enviar · salvar | ♥ sem contagem · enviar · salvar. **Não há comentário** | média | `ExploreScreen.tsx:86-91`, `explore-core.ts:3-8` (falta `likes`/`comments`) |
| Legenda | artista / *título* / "2025 · Acrílica sobre tela · 100 × 80 cm" (o ano dentro da ficha) | *título, ano* / "técnica · dimensões" | baixa | `ExploreScreen.tsx:94-95`, `explore-core.ts:51` |
| Botões de preço | `Ofertar` (se aceita) + `Comprar`, que abrem folhas no próprio painel | Ganhou "Ver obra" (fora do desenho). Ofertar e Comprar navegam para `/e/artwork/…/offer` e `/buy` (site público, fora do shell) | alta (navegação) / baixa (botão a mais) | `ExploreScreen.tsx:97-102` |
| Clique na obra | Abre o **painel lateral** "obra" sobre o feed (WC:1705) | Vai para `/e/artwork/[publicId]` (página pública, sem sidebar) | **alta** | `ExploreScreen.tsx:78,92` |
| Vazio | "Nenhuma obra nesta categoria agora." | igual | ok | — |
| Rodapé | "Todas as obras têm certificado assinado e etiqueta no verso." | igual | ok | — |

## 3. Explorar · Descobrir (`/explore?view=discover`)

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Botões | 4: Passar · Salvar · Curtir · Ver obra | 5: + Compartilhar | baixa | `ExploreScreen.tsx:176-182` |
| Contador | "1 de 6 · arraste para a direita para curtir" | igual (`deckCounter`) | ok | — |
| Vazio | "As curtidas e as salvas estão **na sua coleção**." + Ver salvas / Recomeçar | "…estão **nos seus favoritos**." | baixa | `ExploreScreen.tsx:153` |
| Ver obra | Painel lateral | Página pública | alta (mesma causa do §2) | `ExploreScreen.tsx:180` |
| Ordenação | "Artistas das obras curtidas aparecem primeiro no Descobrir" (`curtTxt`) | O deck sai na ordem do marketplace. Não há reordenação por curtidas | média | `app/(panel)/explore/page.tsx:10-25` |

## 4. Página / painel da obra

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Contêiner | Painel lateral à direita (arrow_back, ios_share, bookmark, favorite). Feed visível atrás | Página pública "HouseArt Obra" com header público | **alta** | novo `components/collector/ArtworkPanel.tsx`; hoje `components/public/Artwork.tsx` |
| Visualizador | Frente / Detalhe / Verso + "Toque no ponto para ampliar" (zoom no ponto) | Galeria pública (Verso e etiqueta, Detalhe 1/2). Zoom no ponto: conferir | média | `components/public/ArtworkMedia.tsx` |
| Bloco de preço | "Preço pedido · aceita ofertas" / "Preço fixo" + parcela; ♥ e 💬 com contagem | Preço sem contagens sociais nem comentários | média | `components/public/Artwork.tsx:144-160` |
| Certificado | Card "Certificado HouseArt" + texto + `HA-…` + "Ver certificado público →" | Existe ("Ver certificado público →") | ok | — |
| Vendedor | Avatar, "Galeria · Salvador, BA · responde em ~2 h", botão **Conversar** | "Vendido por …", "Falar com a galeria/vendedor" (aproximado) | baixa | `Artwork.tsx:100-101,161` |
| **Obra própria** | "Valor registrado", "Titular desde 02/03/2026", "Titular atual · você", botões **Serviços** e **Vender esta obra** (ou "Certificar e outros serviços" se sem certificado) | Não existe na página da obra. As ações ficam só no painel da escritura em `/wallet` | **alta** | `components/public/Artwork.tsx`, `components/wallet/WalletScreen.tsx:85-92` |
| CTA rodapé | "Fazer oferta" (contorno) + "Comprar agora" (sand) | Conferir rótulos em `ArtworkOffer.tsx` | baixa | `components/public/ArtworkOffer.tsx` |

## 5. Fazer oferta

| Item | Protótipo (folha "Fazer oferta", WC ~2073) | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Forma | Uma folha lateral: obra, "Preço pedido R$ 38.000 · Galeria Ladeira", campo "Sua oferta", chips **−5% · −10% · −15%**, "Validade da oferta" 24/48/72 h, "Mensagem para o vendedor · opcional", 2 notas, CTA "Enviar oferta de R$ 34.000" | Wizard de 5 passos do site público ("HouseArt Oferta") em `/e/artwork/…/offer`, fora do shell. Inclui identidade, garantia com cartão e OTP por e-mail | média (o design do site é legítimo, mas o logado devia ficar no painel; a regra dos 70 % está no back) | `app/e/artwork/[publicId]/offer/page.tsx`, `components/offers/OfferWizard.tsx` |
| Valor inicial | 90 % do preço, arredondado a 500 | conferir `offer-wizard-core.ts` | baixa | `components/offers/offer-wizard-core.ts` |
| Depois de enviar | Push da tela "Sua oferta" com status e contraproposta | `/e/offer/[code]` (OfferSent), fora do shell | média | `app/e/offer/[code]/page.tsx` |

## 6. Comprar (checkout)

| Item | Protótipo (folha "Comprar", WC ~2080) | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Endereço | Endereço salvo "Rua das Laranjeiras, 214 · ap 802 · Salvador, BA" + **Trocar** | Campo de CEP a cada compra. Não há endereço salvo nem "Endereços de entrega" | média | `components/checkout/CheckoutScreen.tsx:140-150` |
| Pagamento | **Pix** "aprovação na hora" · **Cartão** "até 10× sem juros" · **Boleto** "1 dia útil" (WC ~2086) | Só "Cartão · cobrado só agora, em garantia" | **alta** | `CheckoutScreen.tsx:162-178` |
| Parcelas | Grade 1× / 3× / 6× / 10× com o valor de cada (CTA "Pagar 10× de R$ 3.878") | Não existe | alta | `CheckoutScreen.tsx` |
| CTA | "Pagar R$ 38.784 com Pix" / "Pagar 10× de …" + "Em garantia até você confirmar a entrega" | "Em garantia até você confirmar a entrega" ok. O CTA vem de `ctaLabel` | baixa | `components/checkout/checkout-core.ts` |
| Contêiner | Folha sobre o painel | Página `/e/artwork/…/buy` fora do shell | média | `app/e/artwork/[publicId]/buy/page.tsx` |

## 7. Comunidade (`/community`)

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Abas | Para você · Seguindo · Eventos | + Notícias · Salvos | baixa | `components/community/community-core.ts:7-13` |
| Prompt | "Mostre uma obra da sua coleção…" + add_photo_alternate | igual | ok | — |
| Linha da obra no post | ícone sell · *Construção nº 7* · "Joana Teixeira · R$ 38.000" (ou "· certificada") · Ver obra | "Obra certificada · HA-2026-…" (código no lugar de artista e preço) | média | `components/community/FeedCard.tsx:54` |
| Marca de linguagem | Logo da linguagem (pintura, fotografia…) acima do texto quando há obra (`temLing`) | Ausente | baixa | `FeedCard.tsx:45` |
| Seguir | Botão só quando ainda não segue | Botão alterna "Seguindo/Seguir" | baixa | `FeedCard.tsx:38-42` |
| Compartilhar | Abre a folha "Compartilhar" (WhatsApp, Instagram…, link, opções) | Copia o URL para a área de transferência + toast "Copiado" | média | `components/community/CommunityScreen.tsx:114-117` (usar `components/public/ShareSheet.tsx`) |
| Notícia / Guia | Abre o **leitor dentro do app** (empilhado, com progresso, fonte, "Isso foi útil?") | Link para `/e/news/[slug]` (o leitor existe, mas fora do shell) | média | `FeedCard.tsx:62` |
| Avatar do autor | Clicável → perfil (seguidores, obras à venda, posts, Seguir, Mensagem) | Não clicável. Não há perfil de pessoa no painel | média | `FeedCard.tsx:33` |
| Novo post | Texto + "Marcar uma obra da sua coleção · opcional" + Instagram + "Publicar na comunidade" | Pede "**URL da imagem** (https://…)", campo fora do desenho e estranho ao usuário. Instagram ausente (pendente de decisão) | média | `components/community/Composer.tsx:59-60` |
| Vazio (Seguindo) | "Siga artistas, galerias e colecionadores para ver os posts deles aqui." | igual | ok | — |

## 8. Mensagens (`/messages`, `/messages/[id]`)

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Lista | Busca "Buscar por pessoa ou obra", foto da obra + avatar, nome/hora, *obra*, prévia, contador de não lidas | igual | ok | — |
| Vazio | "Nenhuma conversa encontrada." | igual com busca. Sem busca, texto próprio ("…Falar com a galeria…") | baixa | `components/messaging/MessagesScreen.tsx:112` |
| Cabeçalho da conversa | Nome + "Galeria · **verificado pela HouseArt**" + botão **flag (Denunciar)** | Nome + sub sem "verificado pela HouseArt". **Não há denúncia** | média | `components/messaging/ConversationPane.tsx:213-222` |
| Faixa da obra | Foto · *título* · **preço** · botão **Ofertar** (se aceita ofertas e não é minha) | Foto · título · **código público** · "Ver obra" (página pública). Sem Ofertar | média | `ConversationPane.tsx:223-230` |
| Respostas rápidas | Comprador: "Ainda disponível?", "Posso ver ao vivo?", "Como fica o frete?", "Tem o condition report?". **Obra minha (colecionador vendendo):** "Posso enviar mais fotos", "Aceito retirada na galeria", "O certificado está público" (WC:1751) | O papel vem do PERFIL (`collector` = sempre buyer), então o colecionador vendendo vê as do comprador. As de vendedor têm outro texto | média | `components/messaging/messages-core.ts:14-21` (decidir por conversa, como `sideOfDeal`) |
| Compositor | Botão **photo_camera** + input "Mensagem" + enviar | Sem botão de foto | baixa | `ConversationPane.tsx:246-249` |
| Guarda de contato | "Para manter a garantia, contatos e pagamentos só pela HouseArt. Edite a mensagem para enviar." | igual | ok | — |

## 9. Coleção (protótipo) × `/wallet` "Carteira de escrituras" (hoje)

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Título e resumo | "Minha coleção" + "2 obras · R$ 31.700 registrados" + botão **+** redondo (Adicionar nova obra) | Eyebrow com o nome + h1 "Carteira de escrituras" + "Valor registrado · N obra(s)" + botão "Cadastrar obra" + link "Cartões →" | **alta** | `components/wallet/WalletScreen.tsx:55-57` |
| KPIs | 4 cartões: obras · valor registrado ("R$ 32 mil") · **valorização** (+17,5 %, verde) · artistas + nota "Valor estimado hoje: R$ 37.240 · não substitui um laudo" (WC:1643) | Não existem | **alta** | `WalletScreen.tsx`, `lib/collector-wallet/server.ts` |
| Abas | Obras · N · Favoritos · N · Curtidos · N · Compras · N · Vendas · N nova (WC:1653) | Não há abas. Favoritos `/favorites`, Compras `/purchases` e Vendas `/sales` são páginas separadas | **alta** | `app/(panel)/wallet/page.tsx` |
| Obras | **Grade** de quadros: *título*, artista, status com ícone ("Escritura em seu nome", "À venda · R$ 9.800", "Sem certificado", "Em certificação", "Chegando · …" das compras em trânsito) + "Para vender, toque na obra e escolha \"Vender esta obra\"." | Lista de linhas (miniatura 40px) + badge "À venda/Segurada/Sem seguro" + painel da escritura à direita com 6 botões (Vender, Serviços, Transferir, Segurar, Pedir laudo, Compartilhar certificado) | alta | `WalletScreen.tsx:58-92` |
| Compras chegando na grade | "Chegando · em trânsito" com local_shipping | Ausente | média | idem |
| Vazio | (o protótipo sempre tem obras) | "Nenhuma escritura ainda…" (bom) | ok | — |

## 10. Coleção › Favoritos / Curtidos (`/favorites`)

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Lugar | Aba dentro de Coleção | Página própria "Favoritos e curtidos" | média | `components/collector/FavoritesScreen.tsx:51` |
| Linha | *título* · "**Lia Santana · Casa Tamarindo**" (artista · vendedor) · preço · Comprar/Ver | *título, ano* · só o artista · ícone de remover + Comprar/Ver | baixa | `FavoritesScreen.tsx:66-73`, `lib/community/server.ts favoritesOf` |
| Curtidos | "1 obras e 1 post curtido. Artistas das obras curtidas aparecem primeiro no Descobrir." | "N obras curtidas. …" (sem posts) | baixa | `FavoritesScreen.tsx:82` |
| Vazio Favoritos | "Toque no marcador de uma obra para guardá-la aqui." | igual + link "Explorar obras" | ok | — |

## 11. Coleção › Compras (`/purchases`) e "Sua oferta / Acompanhar compra"

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Conteúdo | Lista única de **ofertas e compras**: "Sua oferta · R$ 40.000 · Helena Vaz" + status "Contraproposta de R$ 43.000", chevron → tela | Só os negócios (`buyerDeals`). **As ofertas do colecionador não aparecem em lugar nenhum do painel web** (`offersOfUser` é só para `/api/collector/offers`) | **alta** | `app/(panel)/purchases/page.tsx:114-118`, `lib/offers/server.ts offersOfUser` |
| Vazio | "Suas ofertas e compras aparecem aqui, com o status em tempo real." | "Nenhuma compra em andamento." | baixa | `purchases/page.tsx:118` |
| Contraproposta recebida | Tela "Sua oferta": Preço pedido / Sua oferta / Contraproposta, CTA "**Aceitar e pagar R$ 43.000**", "Conversar antes", "Recusar" | `/e/offer/[code]` (OfferSent) tem responder/recusar, mas fora do shell e sem "Conversar antes" | média | `components/offers/OfferSent.tsx` |
| Etapas da compra | 5 ETAPAS: Pagamento em garantia · Embalagem museológica · Em trânsito · Entrega · toque na etiqueta · Escritura em seu nome (WC:1353), botões "Confirmar com o toque na etiqueta", "**Falar com o vendedor**", "Ver na coleção" | 6 fases do Web App (Oferta aceita, Pagamento em garantia, Documentação e assinatura, Retirada e transporte, Entrega e leitura da etiqueta, Escritura emitida). Sem "Falar com o vendedor" | média | `lib/deals/domain.ts:8-15`, `components/deals/DealTimeline.tsx` |

## 12. Coleção › Vendas (`/sales`, colecionador vendendo)

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Título | Aba "Vendas · 1 nova" na Coleção; seção "Ofertas recebidas" | Página "Vendas" com abas Ofertas recebidas / Em andamento | média | `app/(panel)/sales/page.tsx:40-41` |
| Cartão da oferta | "**Bruno Matos** ofereceu R$ 8.500 em *Estudo em vermelho*" / "Seu preço: R$ 9.800 · **87% do pedido** · expira em 31 h" + Aceitar · Contrapropor · Recusar | Tabela: título; "comprador · expira em … · código"; valor; "pedido … · diferença" | média | `components/offers/OffersTable.tsx:26-41` |
| Conversar | Botão "**Conversar com Bruno**" em cada oferta | Ausente | média | `OffersTable.tsx` |
| Pix antes de aceitar | Sem Pix: abre a folha Pix + "Cadastre o Pix para receber antes de aceitar" | Aceita sem conferir o Pix | média | `OffersTable.tsx:16-24`, `lib/offers/server.ts` |
| Contraproposta | Folha "Contraproposta": "Bruno ofereceu R$ 8.500 em Estudo em vermelho. Seu preço é R$ 9.800." com **o ponto médio já preenchido** | Modal "Contrapropor", campo vazio "Valor da contraproposta (R$)" | baixa | `OffersTable.tsx:44-47` |
| Resolvida | Status "Aceita · aguardando pagamento do comprador", "Contraproposta enviada · aguardando Bruno"… | Badge com `statusLabel` | baixa | — |
| **Anúncios ativos** | Lista com preço "· aceita ofertas / preço fixo" e "312 visualizações · 64 curtidas · 0 comentários" + "Para anunciar outra obra, abra-a em Coleção · Obras…" | **Não existe** | **alta** | `app/(panel)/sales/page.tsx` (`lib/gallery/listing-server.ts viewsSinceMany` já existe) |
| Sem obra (sem member) | — | Callout "Você ainda não tem obras à venda" com link "carteira de escrituras" (bom estado vazio) | ok | — |

## 13. Vender uma obra

| Item | Protótipo (tela empilhada "vender", WC ~1775) | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Passos | 3: "Qual obra você quer vender?" (lista com status) · "Preço e modalidade" · "Revise o anúncio" | 2 (Preço e modalidade · Revise). O passo de escolha não existe porque a folha abre a partir de uma obra | baixa | `components/collector/SellSheet.tsx:103-140` |
| Faixa sugerida | "insights · Faixa sugerida para Lia Santana: R$ 27.000 a R$ 33.000, com base em 6 vendas registradas da artista nos últimos 12 meses." | Ausente | média | `SellSheet.tsx` |
| Mínimo | "Oferta mínima · recusa automática abaixo disso" | "Mínimo que você aceita" + nota | baixa | `SellSheet.tsx:119` |
| Resumo | Preço pedido / Taxa HouseArt · 8% / Direito de sequência · 5% da valorização / Você recebe | Linhas equivalentes com `SECONDARY_SELLER_PCT` (o percentual vem do split) | ok | — |
| Pix obrigatório | Publicar sem Pix abre o cadastro de Pix e depois publica | Não confere o Pix | média | `SellSheet.tsx` |
| Destino | Publica e vai para Coleção › Vendas | — | baixa | — |

## 14. Cadastrar obra (`/wallet/register`)

| Item | Protótipo (`cadobra`, 5 passos) | Hoje (3 passos) | Severidade | Onde mexer |
|---|---|---|---|---|
| Passo 1 | "Como a obra chegou até você?" + 4 origens + "**A obra já tem etiqueta HouseArt?** Encoste o celular no verso…" | Origens. Sem a leitura de etiqueta | média | `components/collector/RegisterArtworkScreen.tsx:19-23` |
| Fotos guiadas | Passo 2: 6 fotos (Frente, Verso e chassi, Assinatura, Detalhe, Lateral, Na parede) com câmera guiada e dicas | **Não existe** (o artista tem `GuidedCapture`) | **alta** | `RegisterArtworkScreen.tsx`, reaproveitar `components/artworks/GuidedCapture.tsx` |
| Ajuste das fotos | Passo 3: Auto/Recortar/Luz/Cor/Reflexo, capa | Não existe (`PhotoEditor` existe para o artista) | alta | idem |
| Ficha | Passo 4: artista (sugestões), título, ano, Técnica, Suporte, Altura/Largura/Profundidade, Edição, Assinatura, Estado de conservação, aquisição, **documentos** (NF, certificado anterior, catálogo, foto antiga), observações, "Preencher com as fotos" | Artista; título; ano da aquisição; valor pago; de quem; observações. **Sem técnica, dimensões nem documentos** | alta | idem |
| Revisão e serviços | Passo 5 com serviços e visita (no AC novo sem "Certificação…") e "Concluir cadastro" → tela Pronto com próximos passos | "Cadastrar obra" direto | média | idem |

## 15. Serviços para uma obra

| Item | Protótipo (AC novo) | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Lista | Laudo, Condition report, Perícia, Fotografia, Seguro, Restauro, Moldura, Transporte. **"Certificação HouseArt + etiqueta NFC" saiu da lista** | Catálogo do servidor inclui `CERTIFICATION` com a tag "Necessária para vender" | média | `components/collector/ServicesSheet.tsx:74-80`, `lib/collectors/server.ts:61` |
| Visita | Local (casa / parceiro / coleta +R$ 480) e datas | Ausente | média | `ServicesSheet.tsx` |
| Revisão / pagamento | Passo 2 de 2 com o cartão padrão ("Cobrado só na confirmação da visita") e "Confirmar pedido · R$ X" | Pedido direto, "Pedir N serviços" | baixa | idem |

## 16. Perfil · minha conta (`/account`)

| Item | Protótipo (`ctSecoes`, WC:1958) | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Linha de verificação | "E-mail e celular verificados" (verified_user verde) | "Conta verificada" / "Verificação pendente" | baixa | `components/collector/CollectorAccount.tsx:132` |
| Cadastro | Dados pessoais · E-mail e celular · **Endereços de entrega** | Sem Endereços | média | `app/(panel)/account/page.tsx:28-31` |
| Pagamentos | Carteira e cartões · Pix para receber vendas · **Notas e comprovantes** | Sem Notas e comprovantes | média | `account/page.tsx:38-41` |
| Redes sociais | Instagram | Ausente (pendente de decisão) | baixa | — |
| Segurança | Alterar senha "Última troca há 4 meses" · Face ID (switch) · **Perfil público na comunidade** (switch) · Aparelhos conectados | Só Alterar senha (link para `/recover-password`) | média | `account/page.tsx:42-44` |
| Notificações | **Switches** "Avisos no celular" e "Novidades por e-mail" | "Avisos" vira link para `/notifications`. Só e-mail é switch | baixa | `account/page.tsx:45-48` |
| Ajuda | **Falar com a HouseArt** · Perguntas frequentes | Só "Perguntas frequentes" → `/e/how-it-works` | baixa | `account/page.tsx:49-51` |
| Seção extra | — | "Coleção" (Carteira de escrituras, Cadastrar obra, Favoritos, Compras) compensa o menu | baixa | — |
| Sair | Folha "**Sair da conta?**": "Suas obras, ofertas e conversas continuam salvas…", Cancelar / Sair | Sai direto, sem confirmar | média | `CollectorAccount.tsx:86-90,156` |
| Excluir conta | "Excluir minha conta" → folha com consequências, bloqueio se há negociação, digitar EXCLUIR | **Ausente** | média | `CollectorAccount.tsx` |
| Rodapé | "HouseArt 1.0 (2026.10) · Termos de uso · Privacidade" | "HouseArt · Termos de uso · Privacidade" | baixa | `CollectorAccount.tsx:157` |
| Dados pessoais | Nome, E-mail, Celular, Cidade **editáveis**; "Sobre você · aparece no seu perfil" (bio); trocar foto; salvar → código para confirmar o novo contato | Nome e Cidade editáveis; e-mail, celular e CPF só leitura; sem bio nem foto | média | `CollectorAccount.tsx:105-121` |
| Contêiner | Painel à direita de 600px (`ctW`) ou tela da aba | Página | baixa | — |

## 17. Carteira e cartões (`/wallet/cards`)

| Item | Protótipo (`carteira`, WC ~2052) | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Cartão padrão | Cartão grande com marca/titular/validade | Existe (TITULAR/VALIDADE) | ok | — |
| Saldos | "**Em garantia** R$ 0 · nenhuma compra em curso" e "**A receber** R$ 0 · nenhuma venda em curso" | Ausentes | média | `components/wallet/CardsScreen.tsx` |
| Cartões | Expansível com Tornar padrão / Remover, "vence em breve" | Existe | ok | — |
| Pix | "Recebimentos das vendas" → Cadastrar chave Pix "Obrigatório para receber o valor das suas vendas" | Existe (só com member) | ok | — |
| **Movimentações** | Lista (compras concluídas, pré-autorização estornada, vendas pagas) | Ausente | média | `CardsScreen.tsx` |
| Nota Stripe | "Pagamentos processados pela Stripe, com certificação PCI DSS…" | igual | ok | — |

## 18. Pix para receber (`/sales/payout`)

Tipos (CPF/E-mail/Celular/Aleatória), textos, "Consultando a chave no Banco Central…" e "Chave Pix confirmada no seu nome · pronta para receber" batem com o protótipo. **ok.** Não há gatilho a partir de Vendas e Vender (ver §12 e §13).

## 19. Busca (`/search`)

| Item | Protótipo (WC ~1679) | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Abertura | Tela empilhada no painel, campo com foco "Artista, obra, galeria ou certificado" | Página com h1 "Busca" + campo (placeholder igual) | baixa | `app/(panel)/search/page.tsx:17` |
| **Buscas recentes** | "Buscas recentes" com histórico e "x" para tirar | Ausente | média | `components/search/SearchScreen.tsx` |
| Em alta | Termos ("Marta Okoye", "Retábulo"…) que preenchem a busca | Categorias que levam a `/e/marketplace?category=` (sai do shell) | baixa | `SearchScreen.tsx:35-37` |
| Artistas e galerias | Avatares que abrem o perfil | Avatares → `/e/artist/…` + "Galerias" | ok | — |
| Etiqueta | "Encontrar pela etiqueta" (preenche `HA-2026-`) | → `/verify` | ok | — |
| Resultado por certificado | Cartão "Certificado encontrado" | Existe | ok | — |

## 20. Avisos (`/notifications`)

O Web Colecionador não tem sino nem tela de avisos (são do app e da Fase 8). A implementação tem os dois, e isso não conflita com o desenho. **ok / sem referência.**

---

## As 12 correções de maior valor (por prioridade)

1. **Corrigir os links mortos da sidebar** (`/settings`, `/help`, 404). Pode ser removendo-os ou apontando para `/account` e `/e/how-it-works`: `components/layout/AppShell.tsx:61-62`.
2. **Recriar "Minha coleção"** em `/wallet`:
   - título e resumo, o botão +, os 4 KPIs com a nota da valorização;
   - abas Obras · Favoritos · Curtidos · Compras · Vendas;
   - grade com status, incluindo "Chegando".

   Arquivos: `components/wallet/WalletScreen.tsx`, `app/(panel)/wallet/page.tsx`.
3. **Listar as ofertas do colecionador na web.** `offersOfUser` já existe. As ofertas entram em Compras/Coleção com o status e levam a "Sua oferta" (aceitar e pagar, conversar, recusar): `app/(panel)/purchases/page.tsx`.
4. **Painel lateral de detalhe da obra no shell** (README §7). Lá ficam as ações de dono: Valor registrado, Titular desde, Serviços, Vender esta obra. Também precisa do ♥/💬 com contagem. Feed, Descobrir, Favoritos, Mensagens e Busca passam a abrir esse painel em vez de `/e/artwork/…`.
5. **Enxugar o menu do colecionador** para as 5 entradas do protótipo, com o rótulo "Perfil": `lib/profiles/nav.ts:67-79`. Transferir e Cartões vão para a Coleção e o Perfil. Hoje o menu dispersa o fluxo.
6. **Vendas do colecionador**:
   - cartão da oferta no texto do protótipo ("ofereceu … em …", "% do pedido");
   - "Conversar com X";
   - contraproposta com o ponto médio já preenchido;
   - Pix obrigatório antes de aceitar;
   - **Anúncios ativos** com visualizações, curtidas e comentários.

   Arquivos: `app/(panel)/sales/page.tsx`, `components/offers/OffersTable.tsx`.
7. **Checkout com Pix, Boleto e parcelas** (1×/3×/6×/10×) e endereço salvo com "Trocar": `components/checkout/CheckoutScreen.tsx`. Ver se a Stripe cobre Pix e boleto.
8. **Cadastrar obra completo**: fotos guiadas e ajuste (reaproveitar `GuidedCapture` e `PhotoEditor`), ficha técnica (técnica, suporte, dimensões, assinatura, conservação), documentos, leitura da etiqueta e a tela "Pronto": `components/collector/RegisterArtworkScreen.tsx`.
9. **Explorar fiel ao protótipo**:
   - chip "Desenho";
   - "Revenda" no lugar de "Secundário";
   - sub "Tipo · Cidade, UF" e "Colecionador" no lugar de "Particular";
   - contagens de ♥/💬 e o botão de comentário (`CommentsSheet` já existe);
   - avatar clicável;
   - remover "Ver obra" e o h1.

   Arquivos: `components/collector/ExploreScreen.tsx`, `explore-core.ts`.
10. **Conversa**:
    - respostas rápidas pelo lado da conversa (obra minha → as de vendedor do protótipo);
    - "verificado pela HouseArt";
    - Denunciar (flag);
    - faixa da obra com preço e "Ofertar";
    - botão de foto.

    Arquivos: `components/messaging/messages-core.ts:14-21`, `ConversationPane.tsx`.
11. **Perfil · minha conta**:
    - folha "Sair da conta?" e fluxo "Excluir minha conta" (com o bloqueio por negociação);
    - Endereços de entrega, Notas e comprovantes, Perfil público, Falar com a HouseArt;
    - "E-mail e celular verificados";
    - Dados pessoais editáveis (e-mail e celular com código, bio).

    Arquivos: `components/collector/CollectorAccount.tsx`, `app/(panel)/account/page.tsx`.
12. **Comunidade e serviços**:
    - Comunidade: compartilhar pela `ShareSheet`; linha da obra "Artista · R$ preço"; tirar o campo "URL da imagem" do Composer.
    - Serviços: tirar "Certificação HouseArt + etiqueta NFC" da lista, como no AC novo.
    - Carteira e cartões: saldos Em garantia / A receber e Movimentações.

    Arquivos: `components/community/{CommunityScreen,FeedCard,Composer}.tsx`, `components/collector/ServicesSheet.tsx`, `components/wallet/CardsScreen.tsx`.
