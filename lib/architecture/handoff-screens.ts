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
    Splash: null, 'Tela inicial': null, 'Entrar · login social': null, Cadastro: null,
    'Explorar · feed': null, 'Explorar · descobrir': null, 'Página da obra': null, 'Fazer oferta': null,
    'Comprar direto': null, 'Contraproposta recebida': null, Comunidade: null, Comentários: null,
    Mensagens: null, 'Conversa com galeria': null, 'Minha coleção': null, 'Favoritos e curtidos': null,
    'Vendas · oferta recebida': null, 'Vender uma obra': null, 'Carteira e cartões': null, 'Adicionar cartão': null,
    'Cadastrar Pix para receber': null, 'Cadastrar obra': null, 'Serviços para uma obra': null, 'Perfil · minha conta': null,
    'Instagram · conectar e postar': null, 'Compartilhar obra': null, 'Ler notícia': null, 'Guia de educação': null, Busca: null,
  },
  'HouseArt App Galeria': {
    Splash: null, 'Tela inicial e login': null, 'Cadastro da galeria': null, 'Galeria · painel do dia': null, Acervo: null,
    'Cadastrar obra': null, 'Gestão do anúncio': null, 'Ofertas recebidas': null, 'Vendas até o repasse': null, 'Regras de ofertas': null,
    Mensagens: null, 'Conversa com compradora': null, 'Comunidade e eventos': null, 'Instagram · conectar e postar': null,
    'Compartilhar obra': null, 'Ler notícia': null, 'Guia de educação': null, Equipe: null, 'Artistas representados': null, 'Conta, equipe e repasses': null,
  },
  'HouseArt App Artista': {
    Onboarding: null, Login: null, 'Início do artista': null, 'Nova obra · câmera guiada': null, 'Vincular etiqueta': null,
    'Verificar obra': null, 'Carteira de escrituras': null, 'Confirmar recebimento': null, Avisos: null,
  },
  // Desktop versions of the apps: same screens, side panel of detail (handoff §5)
  'HouseArt Web Colecionador': { 'Web Colecionador': null },
  'HouseArt Web Galeria': { 'Web Galeria': null },
}

export const handoffPending = () =>
  Object.values(HANDOFF_SCREENS).flatMap((m) => Object.values(m)).filter((p) => p === null).length
