// "Comprar a preço fixo" / "Fazer oferta" of the price box: links to the two
// flows of the handoff — the purchase (/buy) and the five-step offer (/offer).
import { ButtonLink } from '@/components/ds/Button'

export function ArtworkOffer({ publicId, fixedOnly }: { publicId: string; priceCents?: string; fixedOnly: boolean }) {
  return (
    <div className="hp-artwork__buy">
      <ButtonLink href={`/e/artwork/${publicId}/buy`} variant="primary" size="md">Comprar a preço fixo</ButtonLink>
      {fixedOnly ? null : <ButtonLink href={`/e/artwork/${publicId}/offer`} variant="outline" size="md">Fazer oferta</ButtonLink>}
    </div>
  )
}
