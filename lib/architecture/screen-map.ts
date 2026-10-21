// Design screens (`data-screen-label` in houseart-design/screens.html) → the
// page that implements each one. `null` = not yet built (the ratchet
// design-screens.test.ts only lets this list SHRINK). Paths are repo-relative.
export const SCREEN_MAP: Record<string, string | null> = {
  'Login': 'app/login/page.tsx',
  'Escolha de perfil': 'app/profiles/page.tsx',
  'Dashboard': 'app/(panel)/page.tsx',
  'Minhas obras': 'app/(panel)/artworks/page.tsx',
  'Cadastro de obra': 'app/(panel)/artworks/[id]/edit/page.tsx',
  'Certificação': null,
  'Vendas e ofertas': null,
  'Direito de sequência': null,
  'Cobrança': null,
  'CRM de colecionadores': null,
  'Carteira de escrituras': null,
  'Compras': null,
  'Transferência fora da plataforma': null,
  'Marketplace': null,
  'Laudo de opinião de valor': null,
  'Admin · Obras e certificados': null,
  'Admin · Etiquetas': null,
}
