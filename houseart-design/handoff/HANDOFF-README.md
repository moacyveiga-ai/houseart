# Handoff: HouseArt — ecossistema completo (site, marketplace, apps, sistemas web, design system)

> Documento para o Claude Code. Leia inteiro antes de escrever código. A ordem das fases (seção 6) é a ordem de implementação.

---

## 1. Visão geral

HouseArt é a "escritura da obra de arte": registro, autenticação (etiqueta NFC + certificado digital), cadeia de titularidade e mercado (venda direta, ofertas, contrapropostas) para arte brasileira. Três perfis de usuário principais, mais operação interna:

| Perfil | Superfícies |
|---|---|
| **Colecionador** | App mobile, Web Colecionador, site público |
| **Galeria** | App mobile, Web Galeria |
| **Artista** | App mobile (parcial), Web App (perfil artista) |
| **Avaliador / Admin** | Web App (perfis avaliador e admin) |
| **Público sem login** | Site, Home, Marketplace, Obra, Artista, Galeria(s), Verificar, Verificação pública |

Lógica compartilhada por todas as superfícies logadas: marketplace, ofertas/contrapropostas, mensagens, compras com status, comunidade (feed único com notícias + agenda + posts, publicação também no Instagram), notificações, compartilhamento público de obras, carteira (cartões + Pix para receber).

Autenticação: **e-mail + celular com código** (SMS/e-mail), login social (Apple, Google, Facebook), biometria no app. **gov.br foi removido** — não implementar.

---

## 2. Sobre os arquivos de design

Os arquivos em `designs/` são **referências de design em HTML** — protótipos navegáveis que mostram aparência e comportamento pretendidos. **Não são código de produção para copiar.** A tarefa é **recriar estas telas no ambiente do codebase** (padrões, bibliotecas e arquitetura existentes). Se ainda não houver codebase, recomendação na seção 5.

Como abrir: sirva a pasta `designs/` com qualquer servidor estático (`npx serve designs`) e abra os `.dc.html` no navegador. Cada arquivo carrega `support.js` (runtime do protótipo). A lógica de cada tela fica no `<script type="text/x-dc">` ao final do arquivo — **é a melhor fonte para estados, regras e dados de exemplo**. Os apps mobile têm, à esquerda do celular, uma lista de atalhos que leva direto a cada tela/estado.

## 3. Fidelidade

**Alta fidelidade (hi-fi).** Cores, tipografia, espaçamento, raios, estados e textos são finais. Recrie pixel a pixel usando os tokens da seção 4. Todos os textos estão em português do Brasil e devem ser mantidos. Os dados (obras, artistas, valores, nomes) são **exemplos** — substituir por dados reais da API.

---

## 4. Design system (fonte única)

Arquivo de referência: `designs/HouseArt Design System.dc.html` + `designs/houseart/ha-tokens.css`.
**Regra:** nenhuma tela usa valor solto. Tudo sai de token `--ha-*`. Comece portando `ha-tokens.css` literalmente (CSS variables, ou tema do framework — Tailwind `theme.extend`, tokens do React Native etc.).

### 4.1 Cores
| Token | Hex | Uso |
|---|---|---|
| `--ha-paper-50` | `#FBFAF7` | Fundo principal claro |
| `--ha-paper-100` | `#F6F3EE` | Seções e cards |
| `--ha-paper-200` | `#ECE7DF` | Divisores, bordas |
| `--ha-wall` | `#EEEAE3` (escuro `#1A1A1A`) | "Parede" atrás de obras |
| `--ha-ink-900` | `#111111` | Fundo escuro, títulos |
| `--ha-ink-700` | `#2B2B2B` | Texto corrido |
| `--ha-ink-500` | `#6B6760` | Secundário, legendas |
| `--ha-ink-300` | `#B5B0A6` | Placeholder, desabilitado |
| `--ha-sand-500` | `#D9A441` | **Acento único**: botão primário, foco |
| `--ha-sand-600` | `#B9872F` | Hover do acento |
| `--ha-sand-100` | `#F5E7C8` | Badge e realce |
| `--ha-verified-500` / `-100` | `#2E7D5B` / `#E3F0E9` | Autenticada, concluída |
| `--ha-pending-500` / `-100` | `#C77A1E` / `#F7EAD9` | Em análise, aguardando |
| `--ha-alert-500` / `-100` | `#B23A2F` / `#F5E1DE` | Contestada, roubada, erro |
| `--ha-info-500` | `#3A5F8A` | Links, informação |
| `--ha-brand-pintura` | `#F0A050` | Submarca Pintura |
| `--ha-brand-escultura` | `#F07860` | Submarca Escultura |
| `--ha-brand-fotografia` | `#D84870` | Submarca Fotografia |
| `--ha-brand-literatura` | `#B04898` | Submarca Literatura |
| `--ha-brand-grafite` | `#484848` | Texto da marca |

Semânticos (trocam com `[data-ha-theme="dark"]`): `--ha-bg`, `--ha-surface`, `--ha-border`, `--ha-fg`, `--ha-fg-body`, `--ha-fg-muted`, `--ha-fg-disabled`.

Regras: **um** botão primário (sand) por tela. Status só com os tokens de status. Cores de submarca **só** nas marcas de linguagem, nunca em UI (botões, links, fundos).

### 4.2 Tipografia
- Display: **Fraunces** 400 (títulos, títulos de obra em itálico). UI: **Inter** 400/500/600.
- Escala (size/line-height): display 48/56 · hero 72/76 · h1 36/44 · h2 28/36 · h3 22/30 · body-lg 18/28 · body 16/24 · body-sm 14/20 · caption 12/16.
- Label = body-sm 600. IDs, valores e datas: caption 600, `letter-spacing:.04em`, `font-variant-numeric: tabular-nums` (ex.: `HA-2026-7K3F-9Q2M`).
- Título de obra: Fraunces itálico; ano em estilo normal.
- Ícones: **Material Symbols Rounded** (opsz 24, wght 400, FILL 0; `verified` usa FILL 1).

### 4.3 Espaço, forma, sombra, movimento
- Escala 4 px: `--ha-space-1…24` = 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 48, 56, 64, 80, 96.
- Raio: 0 (obras, molduras) · sm 4 (inputs, badges) · md 8 (botões, cards) · lg 16 (modais, folhas) · full (chips, toggles).
- Borda 1 px; foco = outline 2 px sand com offset 2 px — **sempre visível**.
- Sombras **nunca em repouso**: `shadow-sm` (hover), `shadow-lg` (modal), `shadow-wall` (obra pendurada).
- Movimento: `--ha-dur-fast` 160 ms (hover/foco), `--ha-dur-panel` 240 ms (painéis/folhas), `--ha-dur-tap` 600 ms (leitura NFC), easing `cubic-bezier(.2,.7,.2,1)`. Keyframes: `ha-pulse`, `ha-close`, `ha-spin`, `ha-fade`.
- Grid: 12 col, gutter 24, máx. 1280 · tablet 8 col · mobile 4 col, margem 16.

### 4.4 Componentes (inventário — implementar nesta ordem)
**Átomos herdados (Housebroker):** Button (`color`=sand · `fill`=ink · `bord`=contorno · `empty`=texto; tamanhos sm 32 / md 40 / lg 48; estados default, hover, active `translateY(1px)`, focus, disabled paper-200/ink-300, loading com spinner), Input (padding 12, raio 4, borda ink-300 → hover ink-500 → focus ink-900 + anel sand; erro alert-500 + mensagem caption), Tabs (sublinhado 2 px ink-900), Toggle (44×24), Chip (pill; ativo ink-900).
**Átomos HouseArt:** `artwork-frame` (moldura + passe-partout 12 / tela com sombra de parede / modo escuro), `status-badge` (Autenticada, Em certificação, Contestada, Roubada, Transferida, À venda, Vendida), `artwork-id` (QR + ID + copiar).
**Moléculas:** `artwork-card` (grid e lista), `provenance-chain`, `price-box`, `split-summary` (artista / galeria / HouseArt 12%), `valuation-gauge`, `ownership-wallet-item`, `index-ticker`.
**Organismos:** `certificate-sheet`, `tag-reader` / `tap-confirm` (lendo, válida, removida, confirmar recebimento).

### 4.5 Marca
Arquivos em `designs/houseart/marca/` (PNG transparente). Versões: `full_horiz`, `full_vert`, `full_45_horiz`, `full_45_vert`, `simples_horiz` (só logotipo), `simples_vert` — cada uma em `_color`, `_mono`, `_negativo`. Submarcas: `logo_{pintura,escultura,fotografia,literatura}_{color,mono,negativo}`. Símbolo isolado: `simbolo_color.png` (ícone de app / favicon).

> Peça ao time de marca os **SVGs** originais antes de produção; os PNGs são de referência. Os arquivos originais enviados tinham nomes trocados (pintura↔literatura; mono↔negativo em 3 linguagens) — os desta pasta já estão corrigidos.

**Aplicação por superfície (decidida):**
| Local | Versão | Altura |
|---|---|---|
| Top bar das páginas públicas (fundo claro) | `full_horiz_color` | 30 px (Site 44, Home 48) |
| Home sobre a foto do hero / nav escura | `full_horiz_negativo` | 48 px |
| Entrar, Cadastro, Verificar (fundo escuro) | `full_horiz_negativo` | 30 px |
| Rodapés (ink-900) | `full_vert_negativo` | 64–72 px |
| Top bar dos sistemas web logados | `full_vert_color` | 48 px (barra de 64) |
| Header do App Colecionador | `simples_horiz_mono` | 24 px |
| Header do App Galeria | `full_vert_color` | 40 px |
| Splash dos apps (fundo paper-50) | `full_45_vert_color` | 180 px de largura |
| Login do Web App (painel escuro) | `full_horiz_negativo` | 48 px |
| Cartão da carteira | `simples_horiz_negativo` | 14 px (app) / 20 px (web) |
| Certificado | `full_horiz_color` | 28–36 px |
| Ícone de app e favicon | `simbolo_color` | — |

Regras: colorida sobre claro, negativo sobre ink-900, mono quando só houver uma cor. Nunca sobre foto de obra. Área de proteção = altura de um módulo do símbolo. Largura mínima da horizontal: 120 px. No texto corrido a grafia é "HouseArt"; na marca, "houseArt".

**Submarcas de linguagem** (só nestes 4 lugares): filtros de técnica do Marketplace (tiles; mono = inativo, color = ativo) · seção "Explore por linguagem" na Home · selo acima do título na página da obra (56 px) · tag no post da comunidade quando o post cita uma obra (56 px).

---

## 5. Arquitetura recomendada (se não houver codebase)

- **Monorepo** (pnpm + Turborepo): `packages/tokens` (gerado de `ha-tokens.css`), `packages/ui` (componentes da 4.4), `packages/domain` (tipos, regras de oferta, split, status), `apps/web` (Next.js: site público + Web Colecionador + Web Galeria + Web App/admin por rota e papel), `apps/mobile` (Expo/React Native: um app com três perfis, ou três builds com o mesmo código).
- Os apps mobile e os sistemas web **compartilham a mesma lógica**: os arquivos Web Colecionador/Web Galeria são as versões desktop dos apps (mesmas telas, com painel lateral de detalhe). Implemente o domínio uma vez.
- Pagamentos: Stripe (cartão) + Pix (recebimento do vendedor, chave cadastrada). Retenção em garantia até confirmar o recebimento (tap-confirm na etiqueta).
- Certificado: assinatura digital + carimbo do tempo ICP-Brasil; etiqueta NFC/QR vinculada ao ID `HA-AAAA-XXXX-XXXX`.

### Modelo de dados mínimo
`User` (papéis: colecionador, galeria, artista, avaliador, admin; e-mail e celular verificados) · `Gallery` (equipe, artistas representados, regras de split) · `Artist` · `Artwork` (ID HA, técnica ∈ {Pintura, Escultura, Fotografia, Literatura, Gravura, Desenho, Técnica mista}, dimensões, edição, fotos, status de certificação, status de venda) · `Certificate` · `Tag` (NFC, estado: vinculada/removida) · `OwnershipEvent` (criada, certificada, exposta, transferida, vendida — alimenta `provenance-chain`) · `Listing` (preço fixo / aceita ofertas / regras automáticas da galeria) · `Offer` (valor, validade, contraproposta encadeada, estado) · `Order` (pagamento, frete+seguro, status de envio, garantia, repasse) · `Payout` (split artista/galeria/HouseArt 12%) · `Wallet` (cartões, chave Pix) · `Conversation`/`Message` · `Post` (texto, foto, obra citada, enquete, evento; flag Instagram) · `Comment` · `Event` (agenda) · `News` · `Notification` · `ServiceRequest` (certificação, fotografia, transporte, restauro).

---

## 6. Sequência de implementação (ordem de maior ganho e precisão)

Cada fase termina utilizável e testável. Não pule a fase 1 — ela garante fidelidade em todas as outras.

**Fase 0 — Fundação (1 sprint)**
1. Repositório, CI, lint, Storybook.
2. Portar `ha-tokens.css` → `packages/tokens` (light + dark). Fontes Fraunces, Inter, Material Symbols.
3. Assets de marca + favicon + ícone de app.

**Fase 1 — Design system em código**
4. Átomos herdados com **todos** os estados (tabela do Button no Design System).
5. Átomos e moléculas HouseArt (4.4), cada um com story comparada ao `HouseArt Design System.dc.html`.
6. Layout base: top bar 64 px, container 1280, grid, rodapé; app shell mobile (header, tab bar, folhas/bottom sheets 240 ms).

**Fase 2 — Identidade e acesso**
7. Cadastro e login: e-mail/celular + código de 6 dígitos, login social, biometria, "Esqueci a senha". Ref.: `Entrar`, `Cadastro`, telas de acesso dos apps (splash → tela inicial → entrar/cadastro em 6 passos).
8. Papéis e "Escolha de perfil" (`Web App` › Escolha de perfil).

**Fase 3 — Núcleo da obra (o diferencial do produto)**
9. Cadastro de obra com captura guiada de fotos e editor (corte, luz, cor, remoção de reflexo), leitura assistida dos dados. Ref.: apps › Cadastrar obra; `Web App` › Cadastro de obra.
10. Certificação + vínculo de etiqueta NFC/QR + `certificate-sheet`. Ref.: `Web App` › Certificação, Admin › Etiquetas.
11. Página pública da obra e verificação pública. Ref.: `Obra`, `Verificar`, `Verificacao`.
12. Carteira de escrituras / Minha coleção e `provenance-chain`.

**Fase 4 — Mercado**
13. Marketplace: busca, filtros (técnica com tiles de submarca, preço, vendedor, mercado, UF, tamanho), chips, destaques, artistas. Ref.: `Marketplace`.
14. Ofertas: fazer oferta, contraproposta, aceitar/recusar, validade, regras automáticas da galeria. Ref.: `Oferta`, apps › Fazer oferta / Contraproposta / Ofertas recebidas / Regras de ofertas.
15. Checkout: compra direta, cartão (Stripe), frete e seguro por CEP, status multi-etapa, confirmação de recebimento por toque na etiqueta.
16. Carteira e cartões, cadastro de Pix, repasses e `split-summary`. Ref.: apps › Carteira, Vendas até o repasse, Conta, equipe e repasses.

**Fase 5 — Relacionamento**
17. Mensagens (conversa vinculada a obra/oferta).
18. Comunidade: feed único (posts, notícias, agenda), comentários, curtidas, enquete, eventos ("vou"), tag de linguagem, publicação no Instagram, compartilhamento público com UTM.
19. Notificações in-app e push.

**Fase 6 — Galeria e operação**
20. Painel do dia, acervo, gestão de anúncio, equipe, artistas representados. Ref.: `App Galeria` / `Web Galeria`.
21. Web App: dashboard do artista, direito de sequência, cobrança, CRM de colecionadores, transferência fora da plataforma, laudo de opinião de valor (avaliador), admin de obras/certificados/etiquetas.

**Fase 7 — Público e conteúdo**
22. Home (hero com nav transparente → sólida ao rolar, manifesto, destaque marketplace, linguagens, pilares, notícias, agenda), Site institucional (como funciona, para quem, preços), páginas de Artista, Galeria, Galerias.
23. SEO, Open Graph das obras compartilhadas, performance de imagens.

**Fase 8 — Lacunas a desenhar antes de lançar** (não existem nos arquivos; não inventar sem design):
- Backoffice financeiro: retenção em garantia, repasses, estornos, conciliação.
- Disputa, cancelamento e devolução (obra danificada, comprador não confirma).
- Central de notificações e e-mails transacionais (oferta, pagamento, envio, códigos).
- Estados de erro, vazio, carregamento, offline e recuperação de senha em **todas** as telas (alguns já existem — reaproveitar o padrão).
- Moderação da comunidade, denúncia, CMS de notícias/agenda.
- App Artista ainda não tem comunidade, mensagens novas, ofertas, Instagram, carteira e Pix — reutilizar as telas do App Colecionador/Galeria.

---

## 7. Interações e comportamento (regras globais)

- Hover: 160 ms; botões primários escurecem para sand-600; contornos ganham paper-100.
- Painéis laterais e bottom sheets: 240 ms, easing padrão; fecham com Esc / gesto.
- Leitura NFC: anel sand pulsando (`ha-pulse` 1200 ms, dois anéis defasados 600 ms) → círculo verified com `check` (válida) ou alert com `link_off` (removida).
- Loading: spinner 14 px no botão + texto no gerúndio ("Processando", "Salvando"); overlays de carregamento com mensagem ("Lendo as fotos…", "Criando sua conta…").
- Toasts curtos de confirmação ("Seguindo Joana Teixeira", "Copiado").
- Validação: erro só depois da tentativa de envio; borda alert-500 + mensagem caption abaixo do campo; botão de avançar fica paper-200 até o passo ser válido.
- Celular com máscara `(00) 00000-0000`; código de verificação 6 dígitos.
- Home: nav fixa, transparente sobre o hero e sólida após rolar.
- Responsivo: web logado com painel lateral de detalhe no desktop; abaixo de ~1024 px vira tela cheia empilhada. Textos nunca com altura fixa.
- Acessibilidade: foco visível, alvos ≥ 44 px no mobile, contraste ≥ 4.5:1, `aria-label` em botões só com ícone.

## 8. Estado (por domínio)
Sessão/auth (etapa do cadastro, verificações), usuário e papel ativo, coleção, favoritos/curtidas/salvos, filtros do marketplace (por grupo, multiseleção), oferta em edição e histórico de contrapropostas, carrinho/pedido e etapa do checkout, carteira (cartões, cartão padrão, Pix), conversas, feed (aba: Para você / Seguindo / Eventos; curtidas, votos, "vou"), notificações, preferências (push, e-mail, Instagram). Os nomes dos estados no `state` dos protótipos são um bom ponto de partida.

## 9. Assets
- Marca: `designs/houseart/marca/*` (fornecidos pelo cliente).
- Imagens de obras de exemplo: `designs/img/ha-*.png` e URLs do Wikimedia Commons (domínio público) — **apenas placeholder**.
- Ícones: Material Symbols Rounded (Google Fonts).
- Fontes: Fraunces e Inter (Google Fonts, OFL).

## 10. Screenshots
`screenshots/` traz capturas de referência rápida, numeradas por superfície: `00` design system · `10–21` páginas públicas · `30–32` apps · `40–42` sistemas web. Obras vindas do Wikimedia aparecem em branco nas capturas — abra o `.dc.html` para ver a tela completa. **A fonte de verdade é sempre o HTML.**

## 11. Arquivos
| Arquivo | Conteúdo |
|---|---|
| `HouseArt Design System.dc.html` | Tokens, marca, componentes e estados — **referência mestre** |
| `houseart/ha-tokens.css` | Tokens em CSS |
| `HouseArt Site.dc.html` | Site institucional (como funciona, para quem, preços) |
| `HouseArt Home.dc.html` | Home pública |
| `HouseArt Marketplace.dc.html` | Busca, filtros, catálogo |
| `HouseArt Obra.dc.html` | Página da obra |
| `HouseArt Oferta.dc.html` | Fluxo de oferta |
| `HouseArt Artista.dc.html` / `Galeria` / `Galerias` | Perfis públicos |
| `HouseArt Verificar.dc.html` / `Verificacao.dc.html` | Verificação de obra (busca e página pública) |
| `HouseArt Entrar.dc.html` / `Cadastro.dc.html` | Acesso web |
| `HouseArt App Colecionador.dc.html` | App mobile colecionador (~30 telas; atalhos à esquerda) |
| `HouseArt App Galeria.dc.html` | App mobile galeria |
| `HouseArt App Artista.dc.html` | App mobile artista (versão anterior) |
| `HouseArt Web Colecionador.dc.html` / `Web Galeria.dc.html` | Versões desktop dos apps |
| `HouseArt Web App.dc.html` | Artista, avaliador e admin |
| `HouseArt Pitch.dc.html` | Apresentação do produto (contexto de negócio, não é tela) |
| `support.js`, `ios-frame.jsx`, `image-slot.js` | Runtime dos protótipos — não portar |
