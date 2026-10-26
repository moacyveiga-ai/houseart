// Splash and onboarding — PURE (handoff "App Colecionador"/"App Galeria" › Splash; "App Artista" ›
// Onboarding). The texts are the prototype's; the pictures are artworks on sale on the platform.

/** How long the splash stays when nothing is tapped (the prototype's `later(2000, …)`). */
export const SPLASH_MS = 2000

export interface Slide { title: string; text: string }
export const ONBOARDING_SLIDES: readonly Slide[] = [
  { title: 'Certifique', text: 'Cada obra recebe uma etiqueta no verso e um certificado assinado que dura a vida inteira.' },
  { title: 'Venda', text: 'Pagamento em garantia, frete e seguro no checkout. A escritura muda de nome na entrega.' },
  { title: 'Verifique', text: 'Encoste o celular no verso de qualquer obra HouseArt e veja quem fez, quando e se é autêntica.' },
]

/** "Continuar" on the first slides, "Começar" on the last. */
export function ctaOf(index: number): string {
  return index >= ONBOARDING_SLIDES.length - 1 ? 'Começar' : 'Continuar'
}

/** The picture of each slide: the covers of artworks on sale, cycled; null when there is none. */
export function pictureFor(index: number, covers: (string | null)[]): string | null {
  const ok = covers.filter((c): c is string => !!c)
  return ok.length ? (ok[index % ok.length] ?? null) : null
}
