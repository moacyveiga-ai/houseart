-- "Faixa sugerida" da folha de venda: negócios concluídos de um artista (Deal → Artwork).
CREATE INDEX IF NOT EXISTS "Deal_artworkId_idx" ON "Deal"("artworkId");
