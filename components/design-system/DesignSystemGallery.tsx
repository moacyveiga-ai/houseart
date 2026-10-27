// Gallery of the DS, section by section as the prototype (Princípios · Marca ·
// Cores · Tipografia · Espaço e forma · Herdados · Componentes HouseArt).
// Sample data = the prototype's examples; images = designs/img (placeholders).
import { HouseArtLogo, LanguageMark, type BrandVersion, type Language } from '@/components/layout/HouseArtLogo'
import { ArtworkFrame, FrameWall } from '@/components/ds/ArtworkFrame'
import { ArtworkGrid, ArtworkList, type ArtworkCardData } from '@/components/ds/ArtworkCard'
import { ArtworkId } from '@/components/ds/ArtworkId'
import { Button } from '@/components/ds/Button'
import { CertificateSheet } from '@/components/ds/CertificateSheet'
import { Chip } from '@/components/ds/Chip'
import { Field } from '@/components/ds/Field'
import { IndexTicker } from '@/components/ds/IndexTicker'
import { PriceBox } from '@/components/ds/PriceBox'
import { ProvenanceChain } from '@/components/ds/ProvenanceChain'
import { SplitSummary } from '@/components/ds/SplitSummary'
import { StatusBadge, type ArtworkStatus } from '@/components/ds/StatusBadge'
import { TagReader } from '@/components/ds/TagReader'
import { ValuationGauge } from '@/components/ds/ValuationGauge'
import { WalletItem } from '@/components/ds/WalletItem'
import { ToggleDemo } from './ToggleDemo'
import './gallery.css'

const IMG = { mSup: '/design-system/ha-mSup.png', k8: '/design-system/ha-k8.png', mAir: '/design-system/ha-mAir.png', mAbs: '/design-system/ha-mAbs.png', hAlt: '/design-system/ha-hAlt.png', hSvan: '/design-system/ha-hSvan.png' }

const BRANDS: [BrandVersion, string, string][] = [
  ['full_horiz', 'Completa horizontal', 'Principal · top bar, site'], ['full_vert', 'Completa vertical', 'Capa, splash, redes'],
  ['full_45_horiz', 'Completa 45° horizontal', 'Peças editoriais'], ['full_45_vert', 'Completa 45° vertical', 'Cartazes, convites'],
  ['simples_horiz', 'Logotipo horizontal', 'Espaços estreitos, rodapé'], ['simples_vert', 'Logotipo vertical', 'Assinatura, documentos'],
]
const LANGUAGES: [Language, string, string][] = [['pintura', 'Pintura', '#F0A050'], ['escultura', 'Escultura', '#F07860'], ['fotografia', 'Fotografia', '#D84870'], ['literatura', 'Literatura', '#B04898']]
const COLORS: [string, string, string][] = [
  ['--ha-paper-50', '#FBFAF7', 'Fundo principal claro'], ['--ha-paper-100', '#F6F3EE', 'Seções e cards'], ['--ha-paper-200', '#ECE7DF', 'Divisores, bordas'],
  ['--ha-ink-900', '#111111', 'Fundo escuro, títulos'], ['--ha-ink-700', '#2B2B2B', 'Texto corrido'], ['--ha-ink-500', '#6B6760', 'Secundário, legendas'], ['--ha-ink-300', '#B5B0A6', 'Placeholder, desabilitado'],
  ['--ha-sand-500', '#D9A441', 'Acento: primário, foco'], ['--ha-sand-600', '#B9872F', 'Hover do acento'], ['--ha-sand-100', '#F5E7C8', 'Badge e realce'],
  ['--ha-verified-500', '#2E7D5B', 'Autenticada, concluída'], ['--ha-pending-500', '#C77A1E', 'Em análise, aguardando'], ['--ha-alert-500', '#B23A2F', 'Contestada, roubada, erro'], ['--ha-info-500', '#3A5F8A', 'Links, informação'],
]
const TYPE: [string, string, string][] = [
  ['display · 48/56', 'ha-display', 'A escritura da obra de arte'], ['h1 · 36/44', 'ha-h1', 'Construção para um dia claro'], ['h2 · 28/36', 'ha-h2', 'Cadeia de titularidade'], ['h3 · 22/30', 'ha-h3', 'Joana Teixeira'],
  ['body-lg · 18/28', 'ha-body-lg', 'Sua obra recebe um certificado que muda de titular a cada venda.'], ['body · 16/24', '', 'Óleo sobre linho, 100 × 80 cm. Assinada no verso.'],
  ['body-sm · 14/20', 'ha-sm', 'Certificada em 12 de março de 2026'], ['label · 14/20 · 600', 'ha-sm ha-strong', 'Confirmar recebimento'], ['caption · 12/16', 'ha-caption', 'Colecionador particular, Salvador/BA'],
  ['id · caption 600 · tabular', 'ha-id', 'HA-2026-7K3F-9Q2M · R$ 38.000,00 · 12/03/2026'],
]
const SPACES = [1, 2, 3, 4, 6, 8, 10, 12, 14, 16]
const STATUSES: ArtworkStatus[] = ['verified', 'pending', 'contested', 'stolen', 'transferred', 'for-sale', 'sold']
const WORKS: ArtworkCardData[] = [
  { href: '#artwork-card', src: IMG.mSup, artist: 'Joana Teixeira', title: 'Construção para um dia claro', year: 2025, technique: 'Óleo sobre linho', dimensions: '100 × 80 cm', price: 'R$ 38.000', verified: true },
  { href: '#artwork-card-2', src: IMG.hSvan, artist: 'Clara Bittencourt', title: 'Duas luas', year: 2024, technique: 'Têmpera sobre tela', dimensions: '90 × 90 cm', price: 'R$ 24.500', verified: true },
  { href: '#artwork-card-3', src: IMG.mAir, artist: 'Joana Teixeira', title: 'Voo baixo', year: 2024, technique: 'Óleo sobre linho', dimensions: '120 × 100 cm', price: 'Sob consulta', verified: true },
  { href: '#artwork-card-4', src: IMG.hAlt, artist: 'Tomás Rezende', title: 'Retábulo do Rio Vermelho', year: 2023, technique: 'Acrílica e folha de ouro', dimensions: '140 × 105 cm', price: 'R$ 46.000', verified: true },
]
const WORKS_LIST: ArtworkCardData[] = [
  { href: '#artwork-row', src: IMG.mAbs, artist: 'Joana Teixeira', title: 'Estudo em vermelho', year: 2025, technique: 'Óleo sobre papel', dimensions: '50 × 50 cm', price: 'R$ 9.800' },
  { href: '#artwork-row-2', src: IMG.k8, artist: 'Rafael Moura', title: 'Partitura para Itapuã', year: 2023, technique: 'Óleo sobre tela', dimensions: '140 × 200 cm', price: 'Vendida' },
]
const brl = (cents: bigint) => 'R$ ' + (Number(cents) / 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })

const Tag = ({ children }: { children: string }) => <span className="dsg-tag">{children}</span>
const H3 = ({ name, kind, note }: { name: string; kind: string; note?: string }) => (
  <div className="dsg-h3"><h3 className="ha-h2">{name}</h3><Tag>{kind}</Tag>{note ? <span className="ha-caption">{note}</span> : null}</div>
)

export function DesignSystemGallery() {
  return (
    <div className="dsg">
      <header className="dsg-header">
        <div className="dsg-header__inner">
          <div className="dsg-header__brand"><HouseArtLogo version="full_horiz" tone="color" height={28} /><span className="ha-eyebrow">Design System · v0.1</span></div>
          <nav className="dsg-nav">
            <a href="#principios">Princípios</a><a href="#marca">Marca</a><a href="#cores">Cores</a><a href="#tipo">Tipografia</a><a href="#base">Espaço e forma</a><a href="#herdados">Herdados</a><a href="#novos">Componentes HouseArt</a>
          </nav>
        </div>
      </header>

      <main className="dsg-main">
        <section className="dsg-hero">
          <div>
            <div className="ha-eyebrow">Família House</div>
            <h1 className="dsg-hero__title">A interface recua para a obra aparecer.</h1>
          </div>
          <p className="ha-body-lg dsg-hero__lead">Tokens <code className="ha-sm">--ha-*</code>, escala de 4 px, Atomic Design e estados completos. Estrutura herdada das plataformas House; identidade de galeria. Todas as telas HouseArt usam apenas as peças desta página.</p>
        </section>

        <section id="principios" className="dsg-section">
          <h2 className="ha-h1 dsg-section__title">Princípios</h2>
          <div className="dsg-grid dsg-grid--240">
            {[['Permanência', 'O certificado é um documento que dura décadas. Nada de modismo visual.'], ['Silêncio', 'Fundos neutros, molduras finas, imagem grande, pouca interface em volta.'], ['Precisão', 'Números, datas, IDs e status sempre tabulares, legíveis e verificáveis.'], ['Continuidade', 'Mesma top bar, sidebar e lógica das plataformas House; identidade própria.']].map(([t, d]) => (
              <div key={t} className="ha-stack"><div className="ha-h3">{t}</div><p className="ha-muted" style={{ margin: 0 }}>{d}</p></div>
            ))}
          </div>
        </section>

        <section id="marca" className="dsg-section">
          <h2 className="ha-h1 dsg-section__title">Marca</h2>
          <div className="dsg-grid dsg-grid--300 dsg-mb-12">
            <div className="dsg-swatch dsg-swatch--paper"><HouseArtLogo version="full_horiz" tone="color" height={100} /></div>
            <div className="dsg-swatch dsg-swatch--ink"><HouseArtLogo version="full_horiz" tone="negativo" height={100} /></div>
            <div className="dsg-rules">
              <div className="ha-strong">Regras</div>
              <div>Grafia no texto corrido: HouseArt. Na marca: houseArt, com “Art” em destaque.</div>
              <div>Símbolo: losango de quatro módulos, um por linguagem (pintura, escultura, fotografia, literatura).</div>
              <div>Colorida sobre claro, negativo sobre ink-900, mono quando só houver uma cor. Nunca sobre foto de obra.</div>
              <div>Área de proteção: a altura de um módulo do símbolo em volta da marca. Largura mínima da horizontal: 120 px.</div>
              <div>Top bar: horizontal simples ou completa, 28–32 px de altura, mesma posição das plataformas House.</div>
            </div>
          </div>
          <h3 className="ha-h2 dsg-mb-4">Aplicação por tela</h3>
          <div className="dsg-apply dsg-mb-12">
            {[['Top bar pública, apps, sistemas web', 'Completa horiz. colorida · 30 / 26 px'], ['Home sobre foto, Entrar, Cadastro, Verificar', 'Completa horiz. negativo'], ['Rodapés', 'Completa vertical negativo · 64 px'], ['Splash dos apps', 'Completa 45° vertical colorida · fundo paper'], ['Cartão da carteira', 'Logotipo horiz. negativo · 14 px'], ['Certificado', 'Completa horiz. colorida · 28 px'], ['Ícone e favicon', 'Símbolo colorido'], ['Linguagens', 'Filtros, capas da Home, selo da obra, posts']].map(([a, b]) => (
              <div key={a} className="dsg-apply__row"><span>{a}</span><span className="ha-muted">{b}</span></div>
            ))}
          </div>
          <div className="dsg-h3"><h3 className="ha-h2">Versões</h3><span className="ha-caption">colorida · mono · negativo</span></div>
          <div className="ha-stack dsg-mb-12">
            {BRANDS.map(([v, name, use]) => (
              <div key={v} className="dsg-brand-row">
                <div><div className="ha-sm ha-strong">{name}</div><div className="ha-caption">{use}</div></div>
                <div className="dsg-swatch dsg-swatch--paper dsg-swatch--180"><HouseArtLogo version={v} tone="color" height={v.includes('vert') || v.includes('45') ? 120 : 44} /></div>
                <div className="dsg-swatch dsg-swatch--paper dsg-swatch--180"><HouseArtLogo version={v} tone="mono" height={v.includes('vert') || v.includes('45') ? 120 : 44} /></div>
                <div className="dsg-swatch dsg-swatch--ink dsg-swatch--180"><HouseArtLogo version={v} tone="negativo" height={v.includes('vert') || v.includes('45') ? 120 : 44} /></div>
              </div>
            ))}
          </div>
          <div className="dsg-h3"><h3 className="ha-h2">Linguagens</h3><span className="ha-caption">submarcas por categoria</span></div>
          <p className="ha-muted dsg-mb-6" style={{ margin: 0, maxWidth: 720 }}>Cada módulo do símbolo vira a marca de uma linguagem. Use em filtros, capas de categoria, curadoria e comunidade, nunca junto com o símbolo completo.</p>
          <div className="dsg-grid dsg-grid--260 dsg-mb-12">
            {LANGUAGES.map(([k, name, hex]) => (
              <div key={k} className="dsg-lang">
                <div className="dsg-swatch dsg-swatch--paper dsg-swatch--200"><LanguageMark language={k} tone="color" height={140} /></div>
                <div className="dsg-lang__pair">
                  <div className="dsg-swatch dsg-swatch--paper dsg-swatch--100"><LanguageMark language={k} tone="mono" height={72} /></div>
                  <div className="dsg-swatch dsg-swatch--ink dsg-swatch--100"><LanguageMark language={k} tone="negativo" height={72} /></div>
                </div>
                <div className="dsg-lang__foot"><span className="dsg-lang__hex" style={{ background: `var(--ha-brand-${k})` }} /><div><div className="ha-sm ha-strong">{name}</div><code className="ha-caption">--ha-brand-{k} · {hex}</code></div></div>
              </div>
            ))}
          </div>
          <div className="ha-row ha-caption"><span className="dsg-lang__hex" style={{ background: 'var(--ha-brand-grafite)' }} /><code>--ha-brand-grafite · #484848</code> · logotipo “house” e textos da marca</div>
        </section>

        <section id="cores" className="dsg-section">
          <h2 className="ha-h1" style={{ marginBottom: 'var(--ha-space-2)' }}>Cores</h2>
          <p className="ha-muted dsg-mb-8" style={{ margin: 0, maxWidth: 720 }}>Um único acento por tela (sand). Status só com os três tokens de status. Texto sobre paper em ink-700 ou ink-900.</p>
          <div className="dsg-grid dsg-grid--180">
            {COLORS.map(([t, hex, use]) => (
              <div key={t} className="dsg-color"><div className="dsg-color__chip" style={{ background: `var(${t})` }} /><div className="dsg-color__body"><code className="ha-caption ha-strong">{t}</code><span className="ha-caption ha-num">{hex}</span><span className="ha-caption" style={{ color: 'var(--ha-fg-body)' }}>{use}</span></div></div>
            ))}
          </div>
        </section>

        <section id="tipo" className="dsg-section">
          <h2 className="ha-h1 dsg-section__title">Tipografia</h2>
          <div>
            {TYPE.map(([k, cls, text]) => (
              <div key={k} className="dsg-type-row"><code className="ha-caption">{k}</code><div className={cls}>{text}</div></div>
            ))}
          </div>
        </section>

        <section id="base" className="dsg-section">
          <h2 className="ha-h1 dsg-section__title">Espaço, raio, sombra, movimento</h2>
          <div className="dsg-grid dsg-grid--340" style={{ gap: 'var(--ha-space-12)' }}>
            <div className="ha-stack" style={{ gap: 'var(--ha-space-2)' }}>
              <div className="ha-strong dsg-mb-2">Escala de 4 px</div>
              {SPACES.map((n) => <div key={n} className="dsg-space"><code className="ha-caption">--ha-space-{n}</code><span className="ha-num">{n * 4}px</span><div style={{ height: 12, width: n * 4, background: 'var(--ha-ink-700)' }} /></div>)}
            </div>
            <div className="ha-stack" style={{ gap: 'var(--ha-space-8)' }}>
              <div className="ha-stack">
                <div className="ha-strong">Raio</div>
                <div className="ha-row" style={{ gap: 'var(--ha-space-4)', flexWrap: 'wrap' }}>
                  {[['0', '0 · obras'], ['sm', 'sm 4 · inputs'], ['md', 'md 8 · cards'], ['lg', 'lg 16 · modais']].map(([r, l]) => <div key={r} className="dsg-radius"><div style={{ borderRadius: `var(--ha-radius-${r})` }} />{l}</div>)}
                </div>
              </div>
              <div className="ha-stack">
                <div className="ha-strong">Sombra (nunca em repouso)</div>
                <div className="ha-row" style={{ gap: 'var(--ha-space-6)', flexWrap: 'wrap' }}>
                  <div className="dsg-shadow" style={{ borderRadius: 'var(--ha-radius-md)', boxShadow: 'var(--ha-shadow-sm)' }}>shadow-sm · hover</div>
                  <div className="dsg-shadow" style={{ borderRadius: 'var(--ha-radius-md)', boxShadow: 'var(--ha-shadow-lg)' }}>shadow-lg · modal</div>
                  <div className="dsg-shadow" style={{ boxShadow: 'var(--ha-shadow-wall)' }}>shadow-wall · obra</div>
                </div>
              </div>
              <div className="ha-stack ha-sm" style={{ gap: 'var(--ha-space-2)' }}>
                <div className="ha-strong">Movimento</div>
                <div><code>--ha-dur-fast</code> 160 ms · hover e foco</div>
                <div><code>--ha-dur-panel</code> 240 ms · painéis e folhas</div>
                <div><code>--ha-dur-tap</code> 600 ms · leitura da etiqueta (anel sand que fecha em verified)</div>
                <div>Grid 12 col · gutter 24 · máx. 1280 · tablet 8 · mobile 4 com margem 16</div>
              </div>
            </div>
          </div>
        </section>

        <section id="herdados" className="dsg-section">
          <h2 className="ha-h1" style={{ marginBottom: 'var(--ha-space-2)' }}>Herdados da Housebroker</h2>
          <p className="ha-muted dsg-mb-8" style={{ margin: 0, maxWidth: 720 }}>Mesmos componentes, revestidos com tokens <code>--ha-*</code>. Um botão primário (color · sand) por tela; foco sempre com anel sand de 2 px.</p>
          <div className="ha-strong dsg-mb-4">Button · Átomo <span className="ha-muted" style={{ fontWeight: 400 }}>— passe o mouse nas linhas “interativo”</span></div>
          <div className="dsg-table-wrap">
            <div className="dsg-btn-table">
              <div /><div>interativo</div><div>default</div><div>hover</div><div>active</div><div>focus</div><div>disabled</div><div>loading</div>
              {([['color', 'primary', 'Comprar', 'Processando'], ['fill', 'ink', 'Salvar ficha', 'Salvando'], ['bord', 'outline', 'Voltar', 'Carregando'], ['empty', 'ghost', 'Ver ficha', 'Abrindo']] as const).map(([name, v, text, busy]) => (
                <div key={name} className="dsg-btn-table__row">
                  <div className="ha-strong">{name}</div>
                  <div><Button variant={v} size="sm">{text}</Button></div>
                  <div><Button variant={v} size="sm" tabIndex={-1}>{text}</Button></div>
                  <div><Button variant={v} size="sm" className="dsg-force-hover" tabIndex={-1}>{text}</Button></div>
                  <div><Button variant={v} size="sm" className="dsg-force-hover dsg-force-active" tabIndex={-1}>{text}</Button></div>
                  <div><Button variant={v} size="sm" className="dsg-force-focus" tabIndex={-1}>{text}</Button></div>
                  <div><Button variant={v} size="sm" disabled>{text}</Button></div>
                  <div><Button variant={v} size="sm" loading>{busy}</Button></div>
                </div>
              ))}
            </div>
          </div>
          <div className="ha-row ha-caption dsg-sizes">Tamanhos: <Button variant="ink" size="xs">sm · 32</Button><Button variant="ink" size="sm">md · 40</Button><Button variant="ink" size="md">lg · 48</Button></div>

          <div className="dsg-grid dsg-grid--280">
            <div className="ha-stack" style={{ gap: 'var(--ha-space-4)' }}>
              <div className="ha-strong">Input · Átomo</div>
              <Field label="Título da obra" defaultValue="Construção para um dia claro" />
              <Field label="ID da obra" placeholder="HA-0000-0000-0000" id />
              <Field label="Dimensões (cm)" defaultValue="100 x 80 x" error="Informe altura × largura × profundidade." />
              <Field label="Tiragem" defaultValue="Obra única" disabled />
            </div>
            <div className="ha-stack" style={{ gap: 'var(--ha-space-4)' }}>
              <div className="ha-strong">Tabs · Toggle · Chip</div>
              <div className="ha-tabs"><span className="ha-tab ha-tab--on">Ficha</span><span className="ha-tab">Proveniência</span><span className="ha-tab">Certificado</span><span className="ha-tab">Laudos</span></div>
              <ToggleDemo label="Seguro de trânsito" />
              <div className="ha-row ha-sm" style={{ flexWrap: 'wrap' }}><Chip on>Pintura</Chip><Chip>Escultura</Chip><Chip>Fotografia</Chip><Chip>Até R$ 50 mil</Chip></div>
            </div>
            <div className="ha-stack" style={{ gap: 'var(--ha-space-4)' }}>
              <div className="ha-strong">index-ticker · Molécula</div>
              <IndexTicker align="left" items={[{ label: 'Índice HouseArt', value: '112,4', delta: '+0,8%' }, { label: 'Dólar', value: 'R$ 5,42' }, { label: 'Euro', value: 'R$ 6,11' }]} />
              <div className="ha-caption">Substitui IPCA/INCC do cabeçalho das plataformas House. Valores ilustrativos.</div>
            </div>
          </div>
        </section>

        <section id="novos" className="dsg-section">
          <h2 className="ha-h1" style={{ marginBottom: 'var(--ha-space-2)' }}>Componentes HouseArt</h2>
          <p className="ha-muted dsg-mb-12" style={{ margin: 0, maxWidth: 720 }}>O núcleo novo: a obra, sua identidade e sua escritura.</p>

          <H3 name="artwork-frame" kind="Átomo" />
          <div className="dsg-grid dsg-grid--260 dsg-mb-16">
            <div className="ha-stack"><FrameWall><div style={{ width: 180 }}><ArtworkFrame src={IMG.mSup} mode="passepartout" /></div></FrameWall><div className="ha-caption">Moldura + passe-partout 12 · sem sombra</div></div>
            <div className="ha-stack"><FrameWall><div style={{ width: 180 }}><ArtworkFrame src={IMG.mSup} mode="canvas" /></div></FrameWall><div className="ha-caption">Tela sem moldura · sombra de parede</div></div>
            <div className="ha-stack"><FrameWall dark><div style={{ width: 180 }}><ArtworkFrame src={IMG.mSup} mode="dark" /></div></FrameWall><div className="ha-caption">Escuro · viewing room</div></div>
          </div>

          <div className="dsg-grid dsg-grid--320 dsg-mb-16" style={{ gap: 'var(--ha-space-12)' }}>
            <div className="ha-stack" style={{ gap: 'var(--ha-space-6)' }}>
              <H3 name="status-badge" kind="Átomo" />
              <div className="ha-row" style={{ flexWrap: 'wrap', gap: 'var(--ha-space-2)' }}>{STATUSES.map((s) => <StatusBadge key={s} status={s} />)}</div>
            </div>
            <div className="ha-stack" style={{ gap: 'var(--ha-space-6)' }}>
              <H3 name="artwork-id" kind="Átomo" />
              <div><ArtworkId id="HA-2026-7K3F-9Q2M" /></div>
            </div>
          </div>

          <H3 name="artwork-card" kind="Molécula" note="grid · lista" />
          <div className="dsg-mb-8"><ArtworkGrid items={WORKS} /></div>
          <div className="dsg-mb-16"><ArtworkList items={WORKS_LIST} /></div>

          <div className="dsg-grid dsg-grid--340 dsg-mb-16" style={{ gap: 'var(--ha-space-12)' }}>
            <div className="ha-stack" style={{ gap: 'var(--ha-space-6)' }}>
              <H3 name="provenance-chain" kind="Molécula" />
              <ProvenanceChain events={[
                { icon: 'brush', event: 'Obra criada', party: 'Ateliê da artista, Salvador/BA', date: '2025' },
                { icon: 'verified', event: 'Certificada', party: 'Assinada pela artista · etiqueta vinculada', date: '12/03/2026' },
                { icon: 'museum', event: 'Exposta', party: 'Galeria Ladeira, “Dia claro”', date: '04/2026' },
                { icon: 'swap_horiz', event: 'Transferida', party: 'Colecionador particular, Salvador/BA', date: '22/05/2026' },
              ]} />
            </div>
            <div className="ha-stack" style={{ gap: 'var(--ha-space-6)' }}>
              <H3 name="certificate-sheet" kind="Organismo" />
              <CertificateSheet c={{ number: 'HA-2026-7K3F-9Q2M', src: IMG.mSup, work: 'Construção para um dia claro', artist: 'Joana Teixeira', technique: 'Óleo sobre linho · 100 × 80 cm · 2025', holder: 'Colecionador particular, Salvador/BA', marker: 'Vinculada em 12/03/2026', signedBy: 'digitalmente pela artista', timestamp: 'Carimbo do tempo ICP-Brasil · 12/03/2026 14:32', holders: '2 titulares desde a emissão' }} />
            </div>
          </div>

          <div className="dsg-grid dsg-grid--320 dsg-mb-16" style={{ gap: 'var(--ha-space-12)' }}>
            <div className="ha-stack" style={{ gap: 'var(--ha-space-6)' }}>
              <H3 name="price-box" kind="Molécula" />
              <PriceBox value="R$ 38.000" note="ou 10× de R$ 3.800 sem juros" shippingLabel="Frete e seguro para 40140-110" shippingValue="R$ 1.240">
                <Button variant="primary" size="md">Comprar a preço fixo</Button>
                <Button variant="outline" size="md">Fazer oferta</Button>
              </PriceBox>
            </div>
            <div className="ha-stack" style={{ gap: 'var(--ha-space-6)' }}>
              <H3 name="split-summary" kind="Molécula" />
              <SplitSummary format={brl} total={3800000n} parts={[{ label: 'Artista', cents: 1801200n, tone: 'ink' }, { label: 'Galeria Ladeira', cents: 1542800n, tone: 'muted' }, { label: 'HouseArt · 12%', cents: 456000n, tone: 'sand' }]} />
            </div>
            <div className="ha-stack" style={{ gap: 'var(--ha-space-6)' }}>
              <H3 name="valuation-gauge" kind="Molécula" />
              <ValuationGauge min={32000} suggested={38000} max={45000} format={(v) => `R$ ${v / 1000} mil`} />
            </div>
          </div>

          <H3 name="tag-reader · tap-confirm" kind="Organismo · mobile" />
          <div className="dsg-grid dsg-grid--220 dsg-mb-16">
            <TagReader state="reading" title="Encoste o celular no verso da obra" subtitle="Lendo a etiqueta de autenticação…" />
            <TagReader state="valid" title="Etiqueta válida" subtitle="HA-2026-7K3F-9Q2M" />
            <TagReader state="removed" title="Etiqueta removida" subtitle="A etiqueta foi descolada da obra. Fale com o suporte." />
            <TagReader state="confirm" title="Recebeu a obra?"><Button variant="primary" size="sm">Confirmar recebimento</Button></TagReader>
          </div>

          <H3 name="ownership-wallet-item" kind="Molécula" />
          <div style={{ maxWidth: 640 }}>
            <WalletItem src={IMG.k8} title="Partitura para Itapuã" year={2023} meta={<>Rafael Moura · adquirida em 04/08/2025 · valor registrado <b>R$ 46.500</b></>} actions={<><Button variant="outline" size="xs">Vender</Button><Button variant="outline" size="xs">Transferir</Button><Button variant="outline" size="xs">Segurar</Button><Button variant="outline" size="xs">Avaliar</Button></>} />
          </div>
        </section>
      </main>
    </div>
  )
}
