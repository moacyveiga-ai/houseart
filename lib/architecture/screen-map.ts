// Design screens (`data-screen-label` in houseart-design/screens.html) → the
// page that implements each one. `null` = not yet built (the ratchet
// design-screens.test.ts only lets this list SHRINK). Paths are repo-relative.
export const SCREEN_MAP: Record<string, string | null> = {
  'Login': 'app/login/page.tsx',
  'Escolha de perfil': 'app/profiles/page.tsx',
  'Dashboard': 'app/(panel)/page.tsx',
  'Minhas obras': 'app/(panel)/artworks/page.tsx',
  'Cadastro de obra': 'app/(panel)/artworks/[id]/edit/page.tsx',
  'Certificação': 'app/(panel)/certification/page.tsx',
  'Vendas e ofertas': 'app/(panel)/sales/page.tsx',
  'Direito de sequência': 'app/(panel)/royalty/page.tsx',
  'Cobrança': 'app/(panel)/billing/page.tsx',
  'CRM de colecionadores': 'app/(panel)/crm/page.tsx',
  'Carteira de escrituras': 'app/(panel)/wallet/page.tsx',
  'Compras': 'app/(panel)/purchases/page.tsx',
  'Transferência fora da plataforma': 'app/(panel)/transfer/page.tsx',
  'Marketplace': 'app/(panel)/marketplace/page.tsx',
  'Laudo de opinião de valor': 'app/(panel)/appraisals/page.tsx',
  'Admin · Obras e certificados': 'app/(panel)/admin/review/page.tsx',
  'Admin · Etiquetas': 'app/(panel)/admin/markers/page.tsx',
}
