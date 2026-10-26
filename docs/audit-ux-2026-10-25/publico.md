# Auditoria de fidelidade — site público e acesso (HouseArt)

Data: 2026-10-25 · Escopo: Home, Site (Como funciona), Marketplace, Obra, Oferta, Artista, Galeria, Galerias, Verificar, Verificação, Entrar, Cadastro.
Método: leitura integral dos `.dc.html` (marcação e `<script type="text/x-dc">`), capturas de `handoff/screenshots/` e leitura do código (`app/e/**`, `app/verify/**`, `app/login`, `app/signup/**`, `components/public/**`, `components/auth/**`, `components/offers/**`, `app/ds/*.css`). Não foi possível renderizar a implementação: sem banco/servidor (proibido nesta auditoria) e o proxy bloqueia a produção (403). As conclusões sobre a implementação vêm do código. Não conto como lacuna o que o dono já decidiu: só Google e Apple no social, Van Gogh no painel do Entrar, gov.br fora, marca de 56 px no Entrar e de 48 px no Cadastro. Divergências registradas em `docs/HANDOFF-2026-10-21.md` §5 aparecem marcadas como "(assumida)". Mesmo assim, algumas valem rever.

## Resumo

- Os textos estão quase todos idênticos aos protótipos, em pt-BR. Estrutura e ordem das seções batem em todas as páginas. Os estados vazio, contestada, roubada, contraproposta e expirada existem.
- **Principais quebras:**
  1. No celular, o header público some sem oferecer menu (`display:none` abaixo de 900 px). Ninguém navega para Marketplace, Artistas ou Galerias pelo topo.
  2. Há links quebrados: `/collector/access` (404) e `/e/how-it-works#suporte` (âncora inexistente), que é o "Falar com o suporte" de obra roubada.
  3. As notícias da Home não são links.
  4. Taxonomia de técnica: "Literatura" filtra "Obra sobre papel", e a página da obra em papel recebe o selo Literatura.
  5. Fraunces sem itálico real e sem eixo `opsz`. Todo título em itálico do design sai em itálico sintético.
  6. O header escuro está em todas as páginas, quando o desenho pede o header claro com `full_horiz_color` 30 px em Marketplace, Obra, Artista, Galeria e Galerias.
- **Funcionalidade desligada que já tem backend:**
  - "Seguir galeria" e "Seguir artista": a reação `FOLLOW` existe.
  - "Salvar" da agenda: a reação `SAVE` em `EVENT` existe.
  - "Compartilhar" do artista: o `ShareSheet` existe.
  - Fotos reais de detalhe na página da obra: as mídias `DETAIL` são carregadas e ignoradas.
- **SEO e OG:** não há `metadataBase` nem imagem OG fora da página da obra. As páginas de artista e de galeria não levam imagem OG.

---

## Casca pública (header e rodapé, todas as páginas `/e`)

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Navegação no celular | A nav rola na horizontal (`overflow-x:auto`) em qualquer largura. As seis entradas ficam sempre acessíveis | `.hp-nav { display:none }` abaixo de 900 px, sem sanduíche nem gaveta. No celular sobram só o logo, "Verificar" e "Entrar". O rodapé também não tem Marketplace, Artistas nem Galerias | **alta** | `app/ds/public.css:28`, `components/public/PublicHeader.tsx:87-89` |
| Cor e marca do header nas páginas de catálogo | Marketplace, Obra, Oferta, Artista, Galeria e Galerias usam header **paper-50** com borda paper-200 e `full_horiz_color` **30 px**. O ativo tem sublinhado ink. Só Site e Verificar usam ink-900, e a Home é transparente | Header ink-900 com `full_horiz_negativo` 44 px em todas, ativo sublinhado em sand. Isso contraria a tabela §4.5 ("Top bar das páginas públicas (fundo claro) · full_horiz_color · 30 px") | média (assumida em §5 Fase 7) | `app/ds/public.css:8-18`, `components/public/PublicHeader.tsx:86` (variante por rota) |
| Busca no header | "Obra, artista ou ID" com ícone `search` em Obra e Artista | Ausente | média | `components/public/PublicHeader.tsx` (link para `/search` ou `/verify`) |
| Faixa de índices | "Índice HouseArt 112,4 +0,8% · Dólar · Euro" acima do header na Obra | Ausente | baixa (assumida) | `components/public/PublicHeader.tsx` (o `IndexTicker` do DS já existe) |
| Sessão nas páginas `/verify` | Header coerente com quem está logado | `/verify` e `/verify/[id]` chamam `<PublicHeader />` sem `account`, então o visitante logado vê "Entrar" | média | `app/verify/page.tsx:23`, `app/verify/[publicId]/page.tsx:34` (repetir a lógica de `app/e/layout.tsx:11-13`) |
| Rodapé por página | Marketplace: "Anunciar uma obra". Galerias: "Sua galeria na HouseArt" (`?plano=galeria`). Site: `full_vert_negativo` 72 px + "by House · Viby Tecnologia" | Um rodapé único com Para artistas e galerias · Preços · Sobre · Privacidade. A variante `tall` existe, mas nunca é usada | baixa | `components/public/PublicFooter.tsx`, `app/e/layout.tsx:18` |
| Header na Home sobre obra | A Home tem a marca negativa sobre a **foto de uma sala** de exposição | O hero usa a capa de uma **obra** à venda (`pick(works,0)`), então a marca fica sobre a foto de uma obra. Isso contraria §4.5 ("Nunca sobre foto de obra") | média | `components/public/Home.tsx:47-57` (usar foto de sala ou ambiente, ou só o gradiente) |

## Home (`/e`)

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Nav transparente → sólida | Fixa, transparente, sólida `rgba(20,18,15,.92)` após 80 % da viewport, com blur | Igual (`useSyncExternalStore`) | ok | `components/public/PublicHeader.tsx:80-81` |
| Parallax, zoom, fade-out e fade-in | `data-speed`, `data-zoom`, `data-out` e `data-fade` | Portado 1:1, e ainda respeita `prefers-reduced-motion` | ok | `components/public/HomeMotion.tsx` |
| Legenda do hero | "Sala de exposição · foto ilustrativa" | "Foto ilustrativa", sobre a capa de uma obra à venda | baixa | `components/public/Home.tsx:68` |
| Notícias clicáveis | A manchete e cada item são `<a>` | São `<article>` sem link, embora `/e/news/[slug]` exista | **alta** | `components/public/Home.tsx:155-171` (envolver em `Link href={/e/news/${slug}}`) |
| Agenda "Salvar" | Botão ativo | `aria-disabled` com "Em breve", embora a reação `SAVE` em `EVENT` exista | média | `components/public/HomeAgenda.tsx:48`, `lib/community/domain.ts:22-27` |
| Linguagens → filtro | Os quatro tiles levam ao Marketplace | Levam com `?category=`. "Literatura" vira `WORK_ON_PAPER` ("Obra sobre papel") | **alta** (ver Marketplace) | `components/public/Home.tsx:24-29` |
| Cartões "destaques" | O `sc-for destaques` do protótipo é vazio | 4 cartões reais sob o bloco (acréscimo) | baixa | `components/public/Home.tsx:99-110` |
| Notícias vazias | A seção aparece sempre | Some sem notícia | baixa (assumida) | `components/public/Home.tsx:148` |
| Itálico Fraunces | "*uma história.*", "*da arte certificada.*", "*à sua obra.*" em Fraunces itálico, `opsz` 9..144 | A fonte só carrega o romano (`weight:['400','500']`, sem `style:['italic']` nem `axes:['opsz']`), então o itálico é sintético. Afeta todo o site | **alta** | `app/layout.tsx:10` |
| SEO | Título e descrição | Título e descrição presentes. Faltam OG image e `metadataBase` | média | `app/e/page.tsx:33-36`, `app/layout.tsx:15-18` |

## Site — Como funciona (`/e/how-it-works`)

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Textos | Hero, pilares, números, 3 passos, Para quem, Preços, Taxas avulsas, Verificar, Quem já usa | Idênticos, salvo "como a escritura de um bem registrado" (vocabulário, assumida) | ok | `components/public/Site.tsx` |
| CTA "Abrir minha carteira" (Colecionadores) | Leva ao app | `href: '/collector/access'`, rota **inexistente** (404). Só existe na allowlist de `lib/public-routes.ts:15` | **alta** | `components/public/SiteAudienceTabs.tsx:13` (`/login?next=/wallet` ou `/signup`) |
| CTA "Falar com a equipe" (Galerias) | Contato com a equipe | Vai a `/signup`: o rótulo promete contato e entrega um cadastro | média | `components/public/SiteAudienceTabs.tsx:12` |
| Planos | 5 planos com `?plano=` | Vêm do banco (`/signup?plan=CODE`). Sem plano ativo, a seção some | ok | `components/public/Site.tsx:133-184` |
| "Quem já usa" | Cartões de depoimento | Lista galerias e artistas reais com ícone de aspas. Não são depoimentos | baixa | `app/e/how-it-works/page.tsx` (users), `components/public/Site.tsx:199-212` |
| Âncora `#suporte` | — | Usada por Verificação, mas não existe nesta página (ids: topo, como, para, precos, verificar, sobre) | **alta** (ver Verificação) | `components/public/Site.tsx` |
| Rodapé | `full_vert_negativo` 72 px + "by House · Viby Tecnologia" | O rodapé padrão, 64 px | baixa | `app/e/layout.tsx:18` |

## Marketplace (`/e/marketplace`)

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Tiles de linguagem | 4 tiles 120 px, mono inativo e color ativo, alternam "Técnica" | Iguais (Link com toggle na URL) | ok | `components/public/Marketplace.tsx:101-112` |
| Taxonomia de técnica | Técnica: Pintura, Escultura, Fotografia, Gravura, Desenho (handoff §5: + Literatura, Técnica mista) | Pintura, Escultura, **Obra sobre papel**, Fotografia, Digital, Outro. O tile "Literatura" ativa o chip "Obra sobre papel". Gravura e Desenho não existem | **alta** | `lib/artworks/domain.ts:22-25`, `components/public/Marketplace.tsx:47-52,63` |
| Filtros, contagens, chips e limpar | Multiseleção por grupo, contagem por opção, chips removíveis, "Limpar" e estado vazio | Equivalentes, server-side por URL | ok | `components/public/Marketplace.tsx:114-163` |
| Busca | Filtra ao digitar | Só no Enter (GET), sem botão visível | baixa | `components/public/Marketplace.tsx:92-97` |
| "Obras em destaque" | "Seleção da curadoria", **"Atualizada toda segunda-feira"** e a **nota curatorial** por obra ("Um dos 14 retábulos…") | São só as 3 mais recentes por `updatedAt`: sem a nota, sem a linha "Atualizada…", sem curadoria | média | `components/public/Marketplace.tsx:55,166-191` |
| Card | Selo "Certificada", coração, vendedor com ícone e tipo | Igual. O coração é real (curtir) | ok | `components/public/MarketCard.tsx` |
| Filtros no celular | O aside empilha (flex-wrap) | Igual, mas com 6 grupos e cerca de 25 opções antes do primeiro resultado | baixa (melhoria: gaveta "Filtros") | `components/public/marketplace.css:110-113` |
| Desempenho | — | Carrega `marketItems(500)` e `listPublicArtworks({},500)` só para mapear ids de curtida. Sem paginação | baixa | `app/e/marketplace/page.tsx:20-24` |
| SEO | — | Só `title`, sem descrição nem OG | baixa | `app/e/marketplace/page.tsx:9` |

## Obra (`/e/artwork/[publicId]`)

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Mídias | Frente · Verso e etiqueta · Detalhe 1 · Detalhe 2 · Ver em parede · lightbox com Esc | Iguais, mas os "Detalhes" são sempre a frente com zoom de 2,4×. As fotos `DETAIL` (e `SIGNATURE`/`IN_SITU`) do cadastro são carregadas pela consulta e ignoradas | média | `components/public/Artwork.tsx:27-33,83`, `lib/marketplace/public-server.ts:59` |
| Selo de linguagem 56 px | Logo da submarca acima do título | Presente. Obra `WORK_ON_PAPER` ganha o selo **Literatura** | **alta** (taxonomia) | `components/public/Artwork.tsx:35,120` |
| "Sobre a obra" | Texto narrativo do artista ou galeria + "Exposta em…" | Frase sintetizada ("Técnica, materiais, dimensões. Da série…"). O modelo `Artwork` não tem campo de descrição | média | `components/public/Artwork.tsx:95,176-184`, `prisma/schema.prisma` (model Artwork) |
| Ficha técnica | Inclui "Moldura" ("Sem moldura · chassi de pinho") | Sem Moldura (não há campo). Acrescenta "Materiais" | baixa | `components/public/Artwork.tsx:88-92` |
| Caixa de preço | Preço, 10× sem juros, frete (3 transportadoras), toggle de seguro, total, "Comprar a preço fixo" (sand), "Fazer oferta", 2 garantias | Igual (cotação estimada por CEP). Estados vendida, roubada, contestada, em negociação e não à venda bem cobertos | ok | `components/public/Artwork.tsx:132-157` |
| Vendedor | "Falar com a galeria" | Real (`TalkToSellerButton`) | ok | `components/public/Artwork.tsx:159-172` |
| Relacionadas | O cartão tem a linha do vendedor (ícone + tipo) e o selo Autenticada | Usa o `ArtworkGrid` do DS, que não tem a linha do vendedor | baixa | `components/public/Artwork.tsx:77-79,222` |
| Breadcrumb | Marketplace / Pintura / Artista | Igual, mas mostra "Obra sobre papel" no caso de papel | baixa | `components/public/Artwork.tsx:107-111` |
| SEO/OG | — | `generateMetadata` com OG image. Falta `metadataBase` para a URL absoluta da capa (`/api/public/media/...` é relativa enquanto não existe store público) | média | `app/e/artwork/[publicId]/page.tsx:14-22`, `app/layout.tsx:15` |

## Oferta (`/e/artwork/[publicId]/offer` e `/e/offer/[code]`)

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Barra própria | ← Voltar à obra · marca color 30 · "Ambiente seguro"; sem header nem rodapé do site | Igual. O header e o rodapé do site são escondidos por `:has(.hp-offer)` | ok | `components/offers/OfferFrame.tsx:18-28`, `components/offers/offer-wizard.css:3` |
| Passos | Valor · Identidade · Garantia · Revisão + Enviada | Iguais. Atalhos −5…−20 %, slider de R$ 500, faixa de chance, validade 24/48/72, mensagem, revisão com "Editar" e aceite vinculante | ok | `components/offers/OfferWizard.tsx`, `components/offers/offer-wizard-core.ts` |
| Identidade sem login | Três verificações inline | Pede login ou cadastro antes. O rascunho fica em `sessionStorage` | baixa (assumida) | `components/offers/OfferWizard.tsx:212-230` |
| Pré-autorização Pix/transferência | Três métodos | Três métodos + CEP de entrega neste passo (acréscimo) | ok | `components/offers/OfferWizard.tsx:234-259` |
| Aside "4% para a artista" | "4% do valor vai para a artista como direito de sequência" | "5% da valorização…" (regra do domínio, assumida) | ok | `components/offers/OfferFrame.tsx:69-72` |
| Ações finais (Enviada) | Aceitar contraproposta · Fazer nova oferta (volta ao passo 1) · Recusar | Aceitar, nova oferta inline e Recusar = retratação com `window.confirm` nativo (fora do DS) | baixa | `components/offers/OfferSent.tsx:68-72,92` |

## Artista (`/e/artist/[slug]`)

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Perfil, âncoras e seções | Foto com crédito, status (Em atividade / In memoriam com p&b), identidade verificada, fatos, linguagens, citação, Biografia + Trajetória, Obras com filtros, Exposições (abas), Prêmios, E-books, Mais informações | Tudo presente. As seções sem dado somem | ok | `components/public/Artist.tsx` |
| "Seguir e receber novas obras" | Botão funcional (toast "Seguindo Joana Teixeira", §7) | `aria-disabled` "Em breve". A reação `FOLLOW` existe, mas só para `MEMBER` | média | `components/public/Artist.tsx:85`, `lib/community/domain.ts:26` |
| Compartilhar | Botão `ios_share` | Desabilitado, embora o `ShareSheet` exista | média | `components/public/Artist.tsx:87`, `components/public/ShareSheet.tsx` |
| E-books (Comprar, Baixar, Ler) | Ações | "Em breve" | baixa | `components/public/Publications.tsx:38` |
| Mais informações | + "Imprensa e contato", "Links", "Catálogo raisonné" | Só Formação, Acervos, Representação ou Espólio e Direito de sequência (falta dado) | baixa | `components/public/Artist.tsx:40-45` |
| SEO/OG | — | Sem imagem OG (há `photoUrl`) | baixa | `app/e/artist/[slug]/page.tsx:11-14` |

## Galeria (`/e/gallery/[slug]`)

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Capa, cartão, âncoras e seções | Capa, marca, verificada, tags, contagens, Seguir · Agendar visita · Falar, História + Marcos, Obras com filtro por artista, Artistas, Tour 360, Fotos/Vídeos, E-books, Responsáveis, Localização | Presentes (mapa OSM, assumida) | ok | `components/public/Gallery.tsx` |
| "Seguir galeria" | Funcional | "Em breve", embora a reação `FOLLOW` em `MEMBER` exista | média | `components/public/Gallery.tsx:77` |
| "Falar com a galeria" | Contato | Âncora `#equipe` ou `#local`. Na obra já existe o `TalkToSellerButton` (mensagem real) | média | `components/public/Gallery.tsx:79` |
| Responsáveis | Foto, nome, cargo, **bio, e-mail, telefone** | Só foto, nome e cargo (o tipo `team` não traz o resto) | média | `components/public/Gallery.tsx:171-182`, `lib/public-content/server.ts:95,116` |
| Horário | Lista por dia ("Terça a sexta · 10h às 19h"…) + acessibilidade + estacionamento | Texto livre único. Sem os ícones `accessible` e `local_parking` | baixa | `components/public/Gallery.tsx:200-205` |
| SEO/OG | — | Sem imagem OG (há `coverUrl`) | baixa | `app/e/gallery/[slug]/page.tsx` |

## Galerias (`/e/galleries`)

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Lista, busca, especialidades, UF e total | Iguais | Iguais. Especialidades derivadas do banco | ok | `components/public/Galleries.tsx` |
| Card | 3 capas, marca, nome com verificada, cidade · desde, descrição, tags, 2 contagens | Igual | ok | `components/public/Galleries.tsx:51-76` |
| "Toda obra mostra quem está vendendo" | Bloco | Igual | ok | `components/public/Galleries.tsx:82-91` |
| CTA de rodapé "Sua galeria na HouseArt" | → Cadastro com plano galeria | Ausente | baixa | `components/public/Galleries.tsx` (link `/signup?plan=GALLERY`) |

## Verificar (`/verify`)

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Header | ink-900, `full_horiz_negativo` **30 px**, só a nav | ink-900, negativo **44 px**, + Verificar/Entrar | baixa | `components/public/PublicHeader.tsx:86` |
| Modos, formulário, resultados, vazio e ajuda | Textos e estados | Idênticos, por GET no servidor | ok | `components/public/Verify.tsx` |
| Sessão | — | Mostra "Entrar" ao logado | média | `app/verify/page.tsx:23` |

## Verificação pública (`/verify/[publicId]`)

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Moldura da página | Cartão móvel **isolado** (abre pelo toque): header próprio `full_horiz_color` 30 + "Verificação pública", sem nav do site | Cartão dentro do header escuro e do rodapé do site: duas marcas na mesma tela (negativa 44 + color 30) | média | `app/verify/[publicId]/page.tsx:32-38` |
| Leitura da etiqueta | Overlay em tela cheia: "Lendo a etiqueta" (1,6 s) → "Etiqueta válida" / "Atenção" (anel fecha) → some e mostra a página | Bloco inline no topo do cartão: 600 ms e fica para sempre. Há também o estado "removida" (bom) | média | `components/public/VerificationReader.tsx:11-17`, `components/public/verification.css:5-6` |
| "Falar com o suporte" / "Reportar problema" | Ações (essenciais em contestada e roubada) | `href="/e/how-it-works#suporte"`: a âncora não existe, então cai no topo do Site | **alta** | `components/public/Verification.tsx:123-124` |
| Seção "Certificado" (CertificateSheet) e parágrafo "API pública de contestação" | Não existem | Acréscimos. O texto da API é jargão para o público | baixa | `components/public/Verification.tsx:99-108,134` |
| Copiar ID | Botão com ícone que vira `check` | `ArtworkId` do DS (equivalente) | ok | `components/public/Verification.tsx:92` |
| SEO | — | Título "Verificação HA-… — HouseArt", sem descrição nem OG, e a página é indexável | baixa | `app/verify/[publicId]/page.tsx:24-27` |
| Laudo `HA-L-…` | (sem protótipo) | Usa classes `ha-*` antigas, fora do visual da Verificação | baixa | `app/verify/[publicId]/page.tsx:50-75` |

## Entrar (`/login`)

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Painel escuro | Marca, "Sua coleção, *com escritura.*" e a frase | Iguais, sobre o Van Gogh (decisão do dono), com crédito | ok | `components/auth/AuthShell.tsx:71-76` |
| Marca sobre a obra | §4.5: "Nunca sobre foto de obra" | Com a decisão do Van Gogh, a marca fica sobre a pintura. Sugestão: faixa ou scrim sob a marca, ou marca fora da área da obra | baixa (decorre de decisão) | `components/auth/AuthShell.tsx:69-70`, `app/ds/cells.css:244` |
| Social | Google, Apple | Google e Apple. Sem chave: "Em breve" | ok | `components/auth/LoginForm.tsx:118-133` |
| Formulário | E-mail ou CPF, senha com olho, "Esqueci minha senha" inline, erro, aviso, "Manter conectado", submit ink 52 px com spinner, termos | Iguais. Acrescenta "Entrar com código por e-mail" | ok | `components/auth/LoginForm.tsx:135-174` |
| Validação | Borda alert no campo vazio | `aria-invalid` (confirmar o estilo em `.ha-input[aria-invalid]`) | baixa | `components/auth/LoginForm.tsx:139,147` |

## Cadastro (`/signup`)

| Item | Protótipo | Hoje | Severidade | Onde mexer |
|---|---|---|---|---|
| Painel | Marca, quadro com o Cisne, "Plano escolhido", chips de troca e nota | Iguais. Planos vêm do banco | ok | `components/auth/SignupPlanAside.tsx`, `app/signup/page.tsx:22` |
| Parâmetro do plano | `?plano=gratis\|atelie\|galeria…` | `?plan=CODE` (o Site é coerente; links externos com `plano=` caem no padrão) | baixa | `app/signup/page.tsx:14,19` |
| Formulário | "Eu sou" (Artista, Galeria, Colecionador, Consultor), nome, e-mail, senha, aceite, CTA do plano | Presentes, seguidos de passos (código, celular, interesses), assumidos em §5 Fase 2 | ok | `components/auth/SignupForm.tsx` |

---

## Os 12 consertos de maior valor (em ordem)

1. **Navegação pública no celular.** Trocar o `display:none` da nav por rolagem horizontal, como no protótipo, ou por uma gaveta com as seis entradas. Hoje o visitante de celular não chega ao Marketplace pelo topo. `app/ds/public.css:28`, `components/public/PublicHeader.tsx`.
2. **Links quebrados de suporte e carteira.** "Falar com o suporte" e "Reportar problema" da Verificação apontam para `#suporte`, que não existe (crítico em obra roubada ou contestada). "Abrir minha carteira" aponta para `/collector/access`, que dá 404. Criar a seção ou rota de suporte e trocar o destino do CTA. `components/public/Verification.tsx:123-124`, `components/public/SiteAudienceTabs.tsx:13`.
3. **Notícias da Home viram links** para `/e/news/[slug]`. `components/public/Home.tsx:155-171`.
4. **Taxonomia de técnica.** Alinhar ao handoff §5 (Pintura, Escultura, Fotografia, Literatura, Gravura, Desenho, Técnica mista) ou, no mínimo, parar de mapear `WORK_ON_PAPER` para o selo e o tile **Literatura**. Hoje o tile filtra "Obra sobre papel" e a obra em papel recebe o selo errado. `lib/artworks/domain.ts:22-25`, `components/public/{Home,Marketplace,Artwork}.tsx`.
5. **Fraunces com itálico real e `opsz`**: `style: ['normal','italic'], axes: ['opsz']`. Afeta todos os títulos do site. `app/layout.tsx:10`.
6. **Header claro nas páginas de catálogo** (Marketplace, Obra, Artista, Galeria, Galerias): paper-50, `full_horiz_color` 30 px e sublinhado ink, conforme a tabela §4.5. Manter o escuro só em Home (rolada), Site e Verificar. `components/public/PublicHeader.tsx`, `app/ds/public.css`.
7. **Seguir galeria e Seguir artista, Salvar evento, Compartilhar artista**: ligar o que já tem backend (`FOLLOW`/`MEMBER`, `SAVE`/`EVENT`, `ShareSheet`) e tirar os "Em breve". `components/public/{Gallery.tsx:77,Artist.tsx:85-87,HomeAgenda.tsx:48}`.
8. **Verificação como página isolada de toque**: sem a casca do site e com o overlay de leitura que some (1,6 s → resultado → página). `app/verify/[publicId]/page.tsx`, `components/public/VerificationReader.tsx`.
9. **Hero da Home sem obra atrás da marca**: usar foto de ambiente ou sala, ou só o gradiente, conforme a regra §4.5 "nunca sobre foto de obra". `components/public/Home.tsx:47-57`.
10. **Mídias reais na página da obra**: usar `DETAIL`, `SIGNATURE` e `IN_SITU` já carregados em vez de duplicar a frente com zoom. `components/public/Artwork.tsx:27-33`.
11. **SEO/OG**: `metadataBase` a partir de `APP_URL` no root layout, e OG image para Home, Marketplace, Artista (foto) e Galeria (capa); `noindex` ou descrição na Verificação. `app/layout.tsx:15`, `app/e/**/page.tsx`.
12. **Curadoria e conteúdo que faltam**: nota curatorial e "Atualizada toda segunda-feira" nos destaques do Marketplace; "Sobre a obra" com texto próprio (campo de descrição no `Artwork`); bio, e-mail e telefone dos responsáveis da galeria; header com sessão em `/verify`. `components/public/Marketplace.tsx:166-191`, `prisma/schema.prisma`, `lib/public-content/server.ts:95`, `app/verify/page.tsx:23`.
