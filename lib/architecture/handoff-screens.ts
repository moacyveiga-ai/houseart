// Screens of the design handoff of 2026-10-21 (houseart-design/handoff/designs)
// → the page that implements each one. `null` = not yet built. The ratchet
// handoff-screens.test.ts reads the prototypes and only lets the pending
// count SHRINK. The 17 screens of `HouseArt Web App` live in screen-map.ts.
export const HANDOFF_SCREENS: Record<string, Record<string, string | null>> = {
  // `HouseArt Web App` (17 screens) is screen-map.ts, all built.
  'HouseArt Web App': {},
  // Public pages (one .dc.html each)
  'HouseArt Home': { Home: 'app/e/page.tsx' },
  'HouseArt Site': { Site: 'app/e/how-it-works/page.tsx' },
  'HouseArt Marketplace': { Marketplace: 'app/e/marketplace/page.tsx' },
  'HouseArt Obra': { Obra: 'app/e/artwork/[publicId]/page.tsx' },
  'HouseArt Oferta': { Oferta: 'app/e/offer/[code]/page.tsx' },
  'HouseArt Artista': { Artista: 'app/e/artist/[slug]/page.tsx' },
  'HouseArt Galeria': { Galeria: 'app/e/gallery/[slug]/page.tsx' },
  'HouseArt Galerias': { Galerias: 'app/e/galleries/page.tsx' },
  'HouseArt Verificar': { Verificar: 'app/verify/page.tsx' },
  'HouseArt Verificacao': { Verificacao: 'app/verify/[publicId]/page.tsx' },
  'HouseArt Entrar': { Entrar: 'app/login/page.tsx' },
  'HouseArt Cadastro': { Cadastro: 'app/signup/page.tsx' },
  // Mobile apps (shortcut list `out.atalhos` of each prototype)
  'HouseArt App Colecionador': {
    Splash: null, 'Tela inicial': 'app/e/page.tsx', 'Entrar · login social': 'app/login/page.tsx', Cadastro: 'app/signup/page.tsx',
    'Explorar · feed': 'app/(panel)/explore/page.tsx', 'Explorar · descobrir': 'app/(panel)/explore/page.tsx', 'Página da obra': 'app/e/artwork/[publicId]/page.tsx', 'Fazer oferta': 'app/e/artwork/[publicId]/offer/page.tsx',
    'Comprar direto': 'app/e/artwork/[publicId]/buy/page.tsx', 'Contraproposta recebida': 'app/e/offer/[code]/page.tsx', Comunidade: 'app/(panel)/community/page.tsx', Comentários: 'components/community/CommentsSheet.tsx',
    Mensagens: 'app/(panel)/messages/page.tsx', 'Conversa com galeria': 'app/(panel)/messages/[id]/page.tsx', 'Minha coleção': 'app/(panel)/wallet/page.tsx', 'Favoritos e curtidos': 'app/(panel)/favorites/page.tsx',
    'Vendas · oferta recebida': null, 'Vender uma obra': null, 'Carteira e cartões': 'app/(panel)/wallet/cards/page.tsx', 'Adicionar cartão': 'app/(panel)/wallet/cards/page.tsx',
    'Cadastrar Pix para receber': 'app/(panel)/sales/payout/page.tsx', 'Cadastrar obra': null, 'Serviços para uma obra': null, 'Perfil · minha conta': 'app/(panel)/account/page.tsx',
    'Instagram · conectar e postar': null, 'Compartilhar obra': 'components/public/ShareSheet.tsx', 'Ler notícia': 'app/e/news/[slug]/page.tsx', 'Guia de educação': 'app/e/guide/page.tsx', Busca: 'app/(panel)/search/page.tsx',
  },
  'HouseArt App Galeria': {
    Splash: null, 'Tela inicial e login': 'app/login/page.tsx', 'Cadastro da galeria': 'app/signup/page.tsx', 'Galeria · painel do dia': 'app/(panel)/page.tsx', Acervo: 'app/(panel)/artworks/page.tsx',
    'Cadastrar obra': null, 'Gestão do anúncio': 'app/(panel)/artworks/[id]/listing/page.tsx', 'Ofertas recebidas': 'app/(panel)/sales/page.tsx', 'Vendas até o repasse': 'app/(panel)/sales/page.tsx', 'Regras de ofertas': 'app/(panel)/sales/rules/page.tsx',
    Mensagens: 'app/(panel)/messages/page.tsx', 'Conversa com compradora': 'app/(panel)/messages/[id]/page.tsx', 'Comunidade e eventos': 'app/(panel)/community/page.tsx', 'Instagram · conectar e postar': null,
    'Compartilhar obra': 'components/public/ShareSheet.tsx', 'Ler notícia': 'app/e/news/[slug]/page.tsx', 'Guia de educação': 'app/e/guide/page.tsx', Equipe: 'app/(panel)/gallery/team/page.tsx', 'Artistas representados': 'app/(panel)/gallery/artists/page.tsx', 'Conta, equipe e repasses': 'app/(panel)/gallery/account/page.tsx',
  },
  'HouseArt App Artista': {
    Onboarding: null, Login: 'app/login/page.tsx', 'Início do artista': 'app/(panel)/page.tsx', 'Nova obra · câmera guiada': 'components/artworks/GuidedCapture.tsx', 'Vincular etiqueta': 'app/(panel)/certification/link/[artworkId]/page.tsx',
    'Verificar obra': 'app/verify/page.tsx', 'Carteira de escrituras': 'app/(panel)/certification/page.tsx', 'Confirmar recebimento': 'app/(panel)/purchases/page.tsx', Avisos: 'app/(panel)/notifications/page.tsx',
  },
  // Desktop versions of the apps: same screens, side panel of detail (handoff §5)
  'HouseArt Web Colecionador': { 'Web Colecionador': 'app/(panel)/explore/page.tsx' },
  'HouseArt Web Galeria': { 'Web Galeria': 'app/(panel)/page.tsx' },
}

export const handoffPending = () =>
  Object.values(HANDOFF_SCREENS).flatMap((m) => Object.values(m)).filter((p) => p === null).length
