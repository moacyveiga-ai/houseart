# Auditoria de fidelidade — Design System e casca logada

Escopo: `HouseArt Design System.dc.html` + `ha-tokens.css` × `app/ds/*.css`, `components/ds/**`, `components/layout/**`, `components/design-system/**`, `app/globals.css`, `app/layout.tsx`. A casca foi comparada com `HouseArt Web App.dc.html`, `HouseArt Web Galeria.dc.html` e `HouseArt Web Colecionador.dc.html`. Também foram conferidos os padrões globais do §7 do `HANDOFF-README.md` em todo `app/` e `components/`.

Método: só leitura do código. Nada foi renderizado: o app precisa de banco para subir, e o protótipo do DS foi lido no próprio markup. Os contrastes foram calculados pela fórmula WCAG sobre os hex dos tokens.

Severidade:
- **Alta**: quebra a regra do handoff ou a usabilidade.
- **Média**: diferença visível.
- **Baixa**: polimento.

---

## 1. Tokens

**`app/ds/tokens.css` ≡ `ha-tokens.css` valor por valor, no claro e no escuro.** Batem as 26 cores, os semânticos, a escala de tipo (com hero 72/76), os espaços 1…24, os raios, a borda, o foco, o passe-partout, as três sombras, as durações, o easing, `--ha-max`, `--ha-gutter` e os 4 keyframes. O bloco `[data-ha-theme="dark"]` é idêntico, linha a linha.

Acréscimos do código, todos legítimos:

| Acréscimo | Onde |
|---|---|
| `--ha-scrim` | `tokens.css:16` |
| `--ha-font-icons` | `tokens.css:20` |
| `--ha-font-*` encadeando `var(--font-fraunces/--font-inter)` do next/font | `tokens.css:18-19` |
| `prefers-reduced-motion` | `tokens.css:52`, bom |

Divergências fora do arquivo de tokens:

| Item | Protótipo | Hoje | Sev. | Onde mexer |
|---|---|---|---|---|
| Fraunces: eixo óptico | `Fraunces:opsz,wght@9..144,400;9..144,600` (eixo `opsz` carregado) | `Fraunces({ weight: ['400','500'] })` sem `axes: ['opsz']`. Display 48 e hero 72 saem sem o desenho de tamanho óptico, e o peso 600 não existe. | Média | `app/layout.tsx:10` (passar `axes: ['opsz']`, sem `weight` fixo; ou incluir 600) |
| Material Symbols | `opsz 24, wght 400, FILL 0, GRAD 0`, `display=block` | Faixa variável `20..48,300..600,0..1` com `display=swap`, que mostra o nome do ícone em texto antes da fonte chegar (FOUT de "notifications", "search"…). | Baixa | `app/layout.tsx:29` (usar `display=block`) |
| Tema escuro sem chave na tela | No protótipo o escuro é um *prop* de demonstração. Os sistemas web logados são desenhados só no claro (Web App, Galeria e Colecionador usam `paper-50`). | O painel segue o **escuro do sistema operacional por padrão** (`lib/theme.ts`, default `'system'`; `lib/theme-routes.ts:16` só força o claro em `/e`, `/login`…). Não há nenhum controle de tema na interface: nenhum componente importa `@/lib/theme`. Com o SO escuro, o usuário cai num painel escuro que o design não previu e não consegue voltar. | **Alta** | Decidir: forçar o claro no `(panel)` até o escuro ser desenhado (adicionar `/` às rotas claras) ou expor o seletor em "Minha conta". |
| Tokens claros fixos que não trocam no escuro | Semânticos `--ha-fg/--ha-surface/--ha-border` | `cells.css` usa a paleta crua 149 vezes (58× `ink-900`, 27× `paper-50`, 22× `ink-300`…). Exemplos: `.ha-nav-item{color:ink-700}` e o hover idem (`cells.css:200-201`, texto escuro sobre `ink-700` no escuro, contraste 1,0); `.ha-switcher__item:hover{paper-100}` (`:191`); `.ha-avatar` (`:197`); `.ha-input{background:paper-50}` (`:57`); `.ha-btn--outline{border-color:ink-900}` (`:31`, borda invisível sobre `ink-900`); `.ha-status--for-sale` (`:344`). | Média (Alta enquanto o painel seguir o SO) | `app/ds/cells.css`: trocar por `--ha-fg-body`, `--ha-surface`, `--ha-border`, `--ha-fg` onde o papel é semântico |

---

## 2. Componentes (§4.4)

### Button (`components/ds/Button.tsx`, `app/ds/cells.css:25-50`)

| Estado/Item | Protótipo | Hoje | Sev. | Onde mexer |
|---|---|---|---|---|
| **loading** | Mantém a cor da variante (sand, ink…) e põe um spinner de 14 px na cor do texto antes do gerúndio ("Processando", "Salvando") | `Button` passa `disabled={rest.disabled \|\| loading}` (`Button.tsx:21`). A regra `.ha-btn--primary[disabled]` (`cells.css:47`) casa, e o botão em loading fica **cinza paper-200/ink-300**, igual ao disabled. Na galeria `/design-system` a coluna "loading" sai idêntica à "disabled". | **Alta** | `cells.css:47-49`: excluir `.ha-btn--loading` (`:not(.ha-btn--loading)`); ou usar `aria-disabled` em vez de `disabled` no loading |
| Tamanhos | sm 32 (caption, 4/12) · md 40 (body-sm, 8/16) · lg 48 (body, 12/24); preenchidos com `border:0` | Os nomes estão deslocados: `xs`=32, `sm`=40, `md`=48 e `lg`=`md`. O padrão do componente é `md` (48). Toda variante tem `border:1px solid transparent` (`:25`), então as alturas reais são **34 / 42 / 50**, 2 px acima do protótipo. Sem modificador, `.ha-btn` = 12/20 + borda = 50 px. | Média | `cells.css:25,39-42`: alturas explícitas (`height:32/40/48`, padding só horizontal) ou borda via `box-shadow: inset`; alinhar os nomes `sm/md/lg` ao handoff (e migrar os 73 usos de `md` e 47 de `sm`) |
| hover | Primário → sand-600; fill → ink-700; bord → paper-100; empty → sublinhado. Transição `background 160ms var(--ha-ease)` | As cores batem (`:28-36`). A transição está sem o easing (`transition: background var(--ha-dur-fast)`). | Baixa | `cells.css:25` (+ `var(--ha-ease)`) |
| active | `translateY(1px)`; bord → paper-200; empty → ink-500 | Bate (`:43-45`), mas sem `transition: transform`. | Baixa | — |
| focus | Outline 2 px sand, offset 2 | Bate (`:26`) | — | — |
| disabled | paper-200/ink-300; bord com borda ink-300 | Bate (`:47-49`) | — | — |
| Variantes extras | — | `outline-paper` e `paper` (`:33-34`) não têm hover nem focus próprio | Baixa | `cells.css:33-34` |
| Uso fora do componente | — | 94 `className="ha-btn …"` crus contra 69 `<Button>`. A maioria faz `disabled={busy}` + texto trocado **sem spinner** (ex.: `components/sales/ConnectAccountCard.tsx:75`, `components/collector/SellSheet.tsx:156`, `components/sales/PayoutAccountScreen.tsx:120`), o que reforça o cinza do item acima. | Média | Migrar para `<Button loading>` |
| Sistema paralelo | — | `app/ds/public.css:10-47` define `hp-btn-sand/-paper/-ink` com `transition 240ms ease` (o hover pede 160) e sem `:focus-visible` | Média | `app/ds/public.css` → reusar `.ha-btn` |

### Input / Field (`components/ds/Field.tsx`, `cells.css:55-67`)

| Estado | Protótipo | Hoje | Sev. | Onde mexer |
|---|---|---|---|---|
| default / hover / focus | Padding 12, raio 4, ink-300 → ink-500 → ink-900 + anel sand de 2 px | Bate (`:57-60`) | — | — |
| erro | Borda alert-500 + mensagem caption | Bate (`:61,67`). A mensagem não está ligada ao campo (sem `aria-describedby`/`id`), então o leitor de tela não a lê. | Média (a11y) | `Field.tsx:12-13` |
| disabled | Borda paper-200, fundo paper-100, texto ink-300; label ink-300 | Bate (`:62-63`) | — | — |
| placeholder | ink-300 | Só no `.ha-input` (`:65`): `textarea` e `select` herdam a cor do navegador | Baixa | `cells.css:65` |
| ID tabular | `.04em` + tabular | Bate (`:64`) | — | — |

### Tabs (`components/ds/Tabs.tsx`, `cells.css:134-136`)

| Estado | Protótipo | Hoje | Sev. | Onde mexer |
|---|---|---|---|---|
| ativo | Sublinhado 2 px ink-900 (inset shadow) | Bate | — | — |
| hover / focus | O protótipo não desenha hover; o foco é regra global ("sempre visível") | `.ha-tab` sem `:focus-visible` (fica o anel padrão do navegador, não o sand), sem hover e sem transição | Média | `cells.css:135` |

### Toggle (`components/ds/Toggle.tsx`, `cells.css:222-226`)

| Estado | Protótipo | Hoje | Sev. | Onde mexer |
|---|---|---|---|---|
| 44×24, knob 18 em 3/23, on ink-900 / off ink-300, transição 160 + ease | Igual | Bate. Tem `role="switch"`, `aria-checked` e foco sand. | — | — |
| disabled | (não desenhado) | Sem estilo: só o cursor muda | Baixa | `cells.css:222` |
| Contraste do "off" | — | ink-300 sobre paper-50 = 2,07:1, abaixo dos 3:1 exigidos para elemento não textual (herdado do protótipo) | Baixa | Decisão de design |

### Chip (`components/ds/Chip.tsx`, `cells.css:72-74`)

| Estado | Protótipo | Hoje | Sev. | Onde mexer |
|---|---|---|---|---|
| default / ativo | Pill, borda ink-300; ativo ink-900/paper-50 | Bate | — | — |
| focus / hover | Foco global obrigatório; hover "contornos ganham paper-100" (§7) | Sem `:focus-visible`, sem hover e sem transição | **Alta** (a regra "foco sempre visível" é do handoff) | `cells.css:72` |
| Alvo no mobile | ≥ 44 px | ~32 px (4 + 24 + 4) | Média | Media query mobile com `min-height:44px` |

### Toast (`components/ds/Toast.tsx`, `cells.css:216-217`)

| Item | Protótipo | Hoje | Sev. |
|---|---|---|---|
| Toast curto de confirmação | "Seguindo…", "Copiado" | Componente existe (ink-900, `ha-fade` 160, `role=status`); é usado em 28 arquivos | — |
| Variantes | (não desenhadas) | Uma variante só: erro e sucesso iguais; sem ícone por padrão | Baixa |

### Modal (`components/ds/Modal.tsx`, `cells.css:214-215`)

| Item | Protótipo / §7 | Hoje | Sev. | Onde mexer |
|---|---|---|---|---|
| Abertura | 240 ms, shadow-lg, raio lg, fecha com Esc | Bate (Esc presente) | — | — |
| Foco | Foco visível, a11y | Sem foco inicial, sem trap e sem devolver o foco ao gatilho. O mesmo vale nas folhas `SellSheet`, `ServicesSheet` e `ShareSheet`; `GuidedCapture` (dialog) não fecha nem com Esc. | Média | `Modal.tsx` + as três folhas |
| Botão fechar | Alvo de 44 px | `ha-btn--ghost ha-btn--xs` ≈ 34 px | Baixa | — |

### Átomos, moléculas e organismos HouseArt

Todos conferidos contra o markup do protótipo, propriedade a propriedade:
- `artwork-frame`: moldura com passe-partout 12, tela com `shadow-wall`, versão escura.
- `status-badge`: 7 estados, ícones, `FILL 1` no `verified`.
- `artwork-id`: QR 32, ID tabular, Copiar → Copiado.
- `artwork-card`: grid e lista.
- `provenance-chain`, `certificate-sheet`, `price-box`, `split-summary` (12 px, swatches 8), `valuation-gauge` (40/4/24).
- `tag-reader`: anel duplo `ha-pulse` 1200 ms + 600 ms, 112 px, borda 4, ícones 48/44.
- `ownership-wallet-item`, `index-ticker`.

**A fidelidade é alta.** O que difere:

| Componente | Item | Protótipo | Hoje | Sev. | Onde mexer |
|---|---|---|---|---|---|
| status-badge | Contraste de "Autenticada" | verified-500 sobre verified-100 | 4,26:1 em texto de 12 px, abaixo de AA (herdado do protótipo) | Média | Decisão de design (escurecer o 500 ou usar ink-900 no texto) |
| artwork-card | Hover | `transition: box-shadow` declarada, sem alvo (o protótipo também não tem) | Idem: sem hover nenhum no cartão. O §7 pede retorno de hover. | Baixa | `cells.css:359` (ex.: `shadow-sm` no hover, permitido) |
| artwork-id | Foco do "Copiar" | Outline sand | Sem `outline-offset` | Baixa | `cells.css:354` |
| tag-reader | a11y | — | `role="status" aria-live` no cartão inteiro, inclusive o botão "Confirmar recebimento" (o leitor reanuncia tudo) | Baixa | `TagReader.tsx`: `aria-live` só no título |
| index-ticker | Semântica | — | `aria-label` num `<div>` sem `role` (ignorado pelos leitores) | Baixa | `IndexTicker.tsx` (`role="region"` ou `<aside>`) |
| `.ha-deed` | Sombra | `shadow-sm` só no certificado | `.ha-deed` também tem sombra em repouso (`cells.css:257`) | Baixa | — |

### Galeria `/design-system` (`components/design-system/DesignSystemGallery.tsx`)

- As seções correspondem ao protótipo: Princípios · Marca · Cores · Tipografia · Espaço e forma · Herdados · Componentes. Há estados forçados de hover, active e focus (`gallery.css:57-66`).
- A tabela de botões mostra o loading cinza, por causa do defeito do Button acima.
- Os tamanhos aparecem rotulados "sm · 32 / md · 40 / lg · 48", mas renderizam com `xs/sm/md` e, na prática, 34/42/50.
- O protótipo tem o *prop* "tema" para ver o escuro; a galeria não oferece essa alternância.
- O título "Herdados das plataformas House" diverge do "Herdados da Housebroker" do protótipo (cópia).

---

## 3. Casca logada (`components/layout/AppShell.tsx`, `app/(panel)/layout.tsx`, `cells.css:169-211`)

| Item | Protótipo (Web App / Web Galeria / Web Colecionador) | Hoje | Sev. | Onde mexer |
|---|---|---|---|---|
| **Index ticker** | Faixa ink-900 acima da top bar (Web App): "Índice HouseArt 112,4 +0,8% · Dólar · Euro", alinhada à direita, padding 4/24 | `AppShell` aceita `ticker`, mas `app/(panel)/layout.tsx:22` nunca passa nada, e `IndexTicker` devolve `null` com a lista vazia. **A faixa não aparece em nenhuma tela logada.** | **Alta** | `app/(panel)/layout.tsx:22` + fonte dos índices (`lib/…`). Nas Web Galeria/Colecionador o protótipo não tem a faixa: decidir por perfil. |
| Altura da sidebar | `calc(100vh - 88px)` = 64 da top bar + ~24 do ticker | Mesmo cálculo (`cells.css:199`), mas sem ticker. Com o ticker, a faixa mede ~32 px (line-height 24 + 4 + 4), não 24. Sobra ou falta espaço no fim da sidebar. | Baixa | `cells.css:170,199` (`line-height: var(--ha-lh-caption)` na faixa) |
| Top bar | 64 px, borda paper-200, sticky, padding 0 24, gap 24 | Bate (`cells.css:173`) | — | — |
| Logo | `full_vert_color` 48 px em bloco de 192 | Bate (`AppShell.tsx:35`, `HouseArtLogo version="full_vert" height={48}`). Mas `tone="auto"` troca para o negativo no escuro, e o §4.5 diz "Top bar dos sistemas web logados → color". | Baixa | — |
| Rótulo do sistema | Galeria/Colecionador: "Galeria" ou "Colecionador" em caption ink-500 ao lado do logo | Ausente | Média | `AppShell.tsx:35` |
| Busca | Web App: caixa 420 px, borda paper-200, raio 4, ícone 20, placeholder "Buscar obras, artistas, galerias ou IDs". Galeria/Colecionador: **botão** de 40 px que abre a busca, texto "Buscar obras, artistas ou certificados" | Input real dentro de `form` (bate com o Web App, `AppShell.tsx:36-39`). **Sem foco visível**: `.ha-topbar__input{outline:none}` (`cells.css:285`) e o contêiner não tem `:focus-within`. Some abaixo de 900 px sem nenhuma alternativa (nem ícone). | **Alta** (foco), Média (mobile) | `cells.css:175,285` (`.ha-topbar__search:focus-within{outline…sand}`); ícone de busca no mobile |
| Sino | Ícone 24 ink-900 com ponto sand de 8 px | Bate visualmente. `aria-label` com a contagem: bom. Alvo de ~32 px (`ha-btn--xs`), menor que 44 no mobile; o protótipo Galeria usa 40×40. | Média | `AppShell.tsx:41` |
| Botão de perfil | Pill: avatar 28 paper-200, rótulo do perfil, `swap_horiz` 18 ink-500, hover borda ink-900 | Bate (`cells.css:180-184`, `ProfileSwitcher.tsx:43-48`). No protótipo Galeria/Colecionador: avatar 30, **nome da pessoa** em vez do perfil, e chip extra "Ver como colecionador". Menu do switcher com `shadow-lg` e `ha-fade` 160 (ok). | Baixa | `ProfileSwitcher.tsx` |
| Sidebar: itens | 240 px; item 8/12, raio md, ícone 20, body-sm 500; ativo paper-200 + 600 + ink-900; hover paper-100; badge sand-100 (Web App) ou **sand-500 com altura 20** (Galeria/Colecionador); Galeria com `min-height:44` e ícone 22 | Bate com o Web App (`cells.css:200-205,84`). Hover usa `--ha-surface` (= paper-100 no claro). Altura ~40 px, sem os 44 do protótipo Galeria. | Baixa | `cells.css:200` |
| **Rodapé da sidebar** | Links de outros sistemas + "Sair" (caption ink-500) | "Configurações" → `/settings` e "Ajuda" → `/help` (`AppShell.tsx:61-62`). **Nenhuma das duas rotas existe** em `app/`: todo usuário logado tem dois links que dão 404, e o 404 é o padrão do Next, fora da marca. | **Alta** | `AppShell.tsx:61-62` (apontar para `/account` ou criar as páginas) |
| Main | Padding 32/32/64; **wrapper `max-width:1280; margin:0 auto`** (Web App). Galeria: `max-width:1180` | Padding bate (`cells.css:208`). `.ha-main__inner` existe (`:209`), mas **nenhum arquivo usa**: o conteúdo estica sem limite em telas largas. | **Alta** | `AppShell.tsx:66`: `<main className="ha-main"><div className="ha-main__inner">` |
| Responsivo | §7: abaixo de ~1024 px o painel lateral vira tela cheia empilhada; alvos ≥ 44 | A 900 px a sidebar some (`display:none`, `cells.css:210`) **sem substituto**: não há menu, gaveta nem barra inferior. No celular e no tablet de 768–900 px o usuário logado perde toda a navegação (só sobram o logo → home, o sino e o menu de conta). `.ha-split` empilha em 900 (`:269`), não em ~1024. | **Alta** | `AppShell.tsx` + `cells.css:210` (botão menu na top bar → gaveta 240 ms com Esc, ou barra inferior como os apps) |
| Breakpoints | ~1024 (§7); 4/8/12 colunas | 15 valores distintos no código: 720 (33×), 1023/1024 (10×), 900 (8×), 480 (7×), 640, 600, 560, 420, 1100, 1200… | Média | Tokens de breakpoint ou um mapa comentado em `tokens.css` |

---

## 4. Padrões globais (§7)

| Regra | Estado no código | Sev. | Onde |
|---|---|---|---|
| Hover 160 ms | Só 35 `transition:` em todo o código; a maioria dos `:hover` muda sem transição. Fora de token: `public.css:10` (240 ms), `site.css:91` e `galleries.css:24` (`160ms ease` literal), `news.css:14` (120 ms), `reading-panel.css:18` (600 ms). | Média | CSS listados |
| Sombras nunca em repouso | Em repouso fora do previsto: `.ha-deed` (`cells.css:257`), `payout.css:14` (rgba solta), `cards.css:101`, `checkout.css:77`, `explore.css:11` e `signup.css:67` (segmentado ativo com `shadow-sm`). No site público, ~14 sombras rgba soltas em `home.css`, `marketplace.css`, `gallery.css` e `artist.css` em vez de `--ha-shadow-wall`. | Média | Arquivos citados |
| Foco sempre visível | Ausente em `.ha-chip`, `.ha-tab`, `.ha-link`, `.ha-iconbtn`, `.ha-list__btn`, nos links do rodapé da sidebar, na busca da top bar e na busca do inventário (`.ha-inv__input{outline:none}`, `components/gallery/inventory-list.css:12`). `app/ds/public.css` tem 7 hovers e 0 focos. Campos com `outline:none` que só trocam a borda (sem anel sand): `payout.css:15,22`, `cards.css:103`, `checkout.css:79`, `verify.css:21`, `site.css:133`; `messages.css:83` usa anel sand-100, e não sand-500. Não existe regra global de `:focus-visible`. | **Alta** | `app/globals.css` (regra base `:where(a,button,[tabindex]):focus-visible{outline:var(--ha-focus-w) solid var(--ha-sand-500);outline-offset:2px}`) + os casos citados |
| Loading = spinner 14 + gerúndio | O spinner existe (`.ha-spinner`, `cells.css:218`, 14 px, 700 ms, igual ao protótipo), mas: <br>• só 4 usos de `ha-spinner` e 24 de `loading=`; <br>• 49 `disabled={busy…}` trocam o texto ("Publicando…", "Enviando…") e deixam o botão cinza, sem spinner; <br>• o próprio `<Button loading>` fica cinza (defeito do item 2). <br>Overlays de carregamento com mensagem só na leitura de fotos e no cadastro. | **Alta** | `Button.tsx`, `cells.css:47` e os chamadores |
| Estados de tela | **Zero** `loading.tsx`, `error.tsx`, `not-found.tsx` ou `global-error.tsx` em `app/`. Sem skeleton durante a navegação (os layouts com `await` congelam a tela), erro de servidor na tela crua do Next e 404 sem marca. A catraca `estados-de-tela` citada no CLAUDE.md não existe em `lib/architecture/`. | **Alta** | `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx`, `app/(panel)/loading.tsx` (+ `error.tsx`) |
| Vazios | Feitos por módulo, sem componente do DS: `ha-ce__empty`, `hp-empty`, `ha-cm-empty`, `ha-fav__empty`, `ha-cards-empty`, `hp-market-empty`… | Baixa | Criar `.ha-empty` no DS |
| Toasts | Componente presente e usado | — | — |
| Validação só após o envio | Só `SignupForm.tsx` e `CheckoutScreen.tsx` guardam "tentou enviar"; os demais mostram o erro da resposta. A regra "avançar fica paper-200 até o passo ser válido" depende do disabled, que hoje é cinza também no loading (conflito visual). | Média | Formulários de obra, oferta, venda |
| Máscara de celular | `formatPhoneInput` (`lib/sms/core.ts:19`) existe, mas só o Cadastro usa. "Telefone" da galeria sem máscara (`components/content-editor/GalleryProfileEditor.tsx:83`). | Baixa | — |
| Painéis 240 ms + Esc | `ha-fade var(--ha-dur-panel)` nas folhas; Esc em Modal, SellSheet, ServicesSheet e ShareSheet; **sem Esc em GuidedCapture**. Nenhum dialog gerencia o foco. | Média | `components/artworks/GuidedCapture.tsx` + folhas |
| aria-label em botões só com ícone | Varredura heurística (`<button>`, `<Link>` ou `<a>` cujo único conteúdo é `<Icon>`): **nenhum sem `aria-label`**. Bom. | — | — |
| Alvos ≥ 44 no mobile | Sino (~32), chips (~32), fechar do modal (~34), itens da sidebar (~40), ações do wallet-item (`cells.css:467`, ~28) | Média | Media query mobile no DS |
| Contraste ≥ 4,5 | Falham: verified-500 sobre verified-100 = **4,26**; fg-disabled no escuro (ink-500 sobre ink-900) = 3,36; ink-500 sobre ink-700 = 2,52 (`--ha-fg-muted` em superfície escura se algum componente fixar ink-500). Passam: muted no claro (5,39), info (6,32), sand + ink (8,4). | Média | Decisão de design no token |

---

## 5. Valores soltos (fora de token)

| Tipo | Quantidade | Principais arquivos | Observação |
|---|---|---|---|
| `font-size` em px | 225 | 48× 11 px, 45× 13 px, 12× 10 px e 10× 15 px, fora da escala 12/14/16/18. Maiores focos: `community.css` (16), `news.css` (13), `cards.css` (11), `messages.css` (9), `explore.css` (7) | Muitos vêm dos protótipos de app (que usam 11/13/15). Decidir se a escala ganha `--ha-text-micro`/`-xs` ou se as telas voltam ao caption 12 / body-sm 14. Os tamanhos de ícone (16/18/20/24) mereciam `--ha-icon-sm/md/lg`. |
| padding/margin/gap em px | 209 | `community.css` 20, `news.css` 19, `explore.css` 16, `payout.css` 14, `search.css` 12, `capture.css` 12, `cards.css` 11 | Trocar por `--ha-space-*` |
| `border-radius` em px | 17 | 14 px em `cards.css:34`, `checkout.css:64` e `messages.css:67,70`; 6 px em `explore.css:10` e `capture.css:69,143,148`; 5 px em `cards.css:38,69` e `checkout.css:51`; 2 px em `news.css:21` e `offer-wizard.css:20` | Fora de 0/4/8/16/full |
| hex | `capture.css:10-16` | — | Repete exatamente alert/verified/info/ink-900/ink-500 como hex: devia apontar para os tokens (`--ha-cap-swatch-red: var(--ha-alert-500)`). `login.css:14-17` e `signup.css:51-52` (marcas Google, Apple, Facebook, LinkedIn) e `cards.css:4-18` (bandeiras de cartão) são marcas de terceiros: aceitável, já isolado em variáveis locais. |
| rgba | 34 | `home.css` 14, `capture.css` 4, `cards.css` 3, `public.css` 2… | Sombras e véus deveriam ser `--ha-shadow-*` ou `--ha-scrim` |
| Inline `style` em TSX | 92 | Quase todos `margin:0` e `--ha-cols` (tabela) | Baixo risco; `maxWidth: 720/640` em `app/verify/[publicId]/page.tsx:54` e `app/transfer/[token]/page.tsx:14` deviam ser classe/token |
| Durações | `cells.css:218` | Spinner 700 ms (= protótipo); `reading-panel.css:12` 900 ms; `signup.css:128-129` 700/500/400 ms; `site.css:56` pulse 1400 ms (o protótipo diz 1200) | — |

---

## 6. As 12 correções de maior valor

1. **Navegação logada no mobile e tablet**: a sidebar some abaixo de 900 px sem substituto. Adicionar botão de menu na top bar com gaveta de 240 ms (Esc, foco preso) ou barra inferior, e mover o corte para ~1024 conforme o §7 (`AppShell.tsx`, `cells.css:210`).
2. **Loading do Button**: hoje fica cinza como o disabled. Excluir `.ha-btn--loading` das regras `[disabled]` (`cells.css:47-49`) ou usar `aria-disabled`, e migrar os 49 `disabled={busy}` para `<Button loading>` com gerúndio.
3. **Estados de tela**: criar `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx` e `app/(panel)/{loading,error}.tsx` no visual do DS, e criar a catraca `estados-de-tela` prometida.
4. **Links quebrados no rodapé da sidebar**: `/settings` e `/help` não existem (`AppShell.tsx:61-62`).
5. **Foco global**: regra base de `:focus-visible` com sand 2 px / offset 2 em `globals.css`, mais `:focus-within` na busca da top bar (`cells.css:175,285`), no inventário, em payout, checkout e cards; chip e tab com foco explícito.
6. **Largura máxima do conteúdo**: envolver `{children}` em `.ha-main__inner` (1280) em `AppShell.tsx:66`.
7. **Index ticker na casca**: alimentar `ticker` em `app/(panel)/layout.tsx:22`, ou registrar a decisão de tirá-lo por perfil (o protótipo da Galeria e do Colecionador não tem a faixa). Corrigir a altura da faixa (`lh-caption`) para o `calc(100vh-88px)` da sidebar bater.
8. **Tema escuro**: o painel segue o SO sem controle na tela e com 149 cores cruas que não trocam. Forçar o claro no painel até haver desenho e controle, depois semantizar `cells.css` (nav-item, switcher, avatar, input, outline, for-sale).
9. **Alturas e nomes dos botões**: tirar a borda transparente de +2 px (alturas exatas 32/40/48) e alinhar `sm/md/lg` aos nomes do handoff.
10. **Alvos ≥ 44 px no mobile**: sino, chips, fechar do modal, itens da sidebar, ações do wallet-item e Toggle.
11. **Fraunces com eixo `opsz`** (e peso 600) em `app/layout.tsx:10`; Material Symbols com `display=block`.
12. **Valores soltos**:
    - escala tipográfica: resolver 11/13/15/10 px (225 ocorrências);
    - sombras em repouso e rgba soltas → `--ha-shadow-*`;
    - hex duplicados em `capture.css` → tokens;
    - raios 5/6/14 px → `--ha-radius-*`;
    - um mapa de breakpoints.
