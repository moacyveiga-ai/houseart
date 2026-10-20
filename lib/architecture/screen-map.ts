// Design screens (`data-screen-label` in houseart-design/screens.html) → the
// page that implements each one. `null` = not yet built (the ratchet
// design-screens.test.ts only lets this list SHRINK). Paths are repo-relative.
export const SCREEN_MAP: Record<string, string | null> = {
  'Login': null,
  'Escolha de perfil': null,
  'Dashboard': 'app/page.tsx',
  'Minhas obras': null,
  'Cadastro de obra': null,
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
