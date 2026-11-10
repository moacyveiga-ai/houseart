-- Apaga o cenário fictício (scripts/demo) para recriá-lo: só as contas *.demo@houseart.test, a conta
-- de teste smoke.artista@houseart.test e o que pertence a elas (tenants, membros, obras, certificados,
-- etiquetas, propostas, negócios, conversas, comunidade). Contas reais e o admin não são tocados:
-- um tenant só sai se TODOS os membros dele são de contas demo. Conteúdo da casa (notícias, agenda
-- sem tenant) fica; a imagem das notícias é zerada para o content.sql preencher com as obras novas.
-- Rode tudo de uma vez (uma transação). Depois: accounts.sql → scenario.mjs → content.sql.
BEGIN;
CREATE TEMP TABLE d_u ON COMMIT DROP AS SELECT id FROM "User" WHERE email LIKE '%.demo@houseart.test' OR email = 'smoke.artista@houseart.test';
CREATE TEMP TABLE d_t ON COMMIT DROP AS
  SELECT t.id FROM "Tenant" t
  WHERE (t.id IN (SELECT "tenantId" FROM "User" WHERE id IN (SELECT id FROM d_u)) OR t.id IN (SELECT "tenantId" FROM "Member" WHERE "userId" IN (SELECT id FROM d_u)))
    AND NOT EXISTS (SELECT 1 FROM "Member" m WHERE m."tenantId" = t.id AND (m."userId" IS NULL OR m."userId" NOT IN (SELECT id FROM d_u)))
    AND NOT EXISTS (SELECT 1 FROM "User" x WHERE x."tenantId" = t.id AND x.id NOT IN (SELECT id FROM d_u));
CREATE TEMP TABLE d_m ON COMMIT DROP AS SELECT id FROM "Member" WHERE "tenantId" IN (SELECT id FROM d_t) OR "userId" IN (SELECT id FROM d_u);
CREATE TEMP TABLE d_a ON COMMIT DROP AS SELECT id FROM "Artwork" WHERE "memberId" IN (SELECT id FROM d_m) OR "tenantId" IN (SELECT id FROM d_t);
CREATE TEMP TABLE d_o ON COMMIT DROP AS SELECT id FROM "Offer" WHERE "artworkId" IN (SELECT id FROM d_a) OR "buyerUserId" IN (SELECT id FROM d_u);
CREATE TEMP TABLE d_d ON COMMIT DROP AS SELECT id FROM "Deal" WHERE "artworkId" IN (SELECT id FROM d_a) OR "offerId" IN (SELECT id FROM d_o) OR "buyerUserId" IN (SELECT id FROM d_u);
CREATE TEMP TABLE d_c ON COMMIT DROP AS SELECT id FROM "Conversation" WHERE "artworkId" IN (SELECT id FROM d_a) OR id IN (SELECT "conversationId" FROM "ConversationParticipant" WHERE "userId" IN (SELECT id FROM d_u));
CREATE TEMP TABLE d_p ON COMMIT DROP AS SELECT id FROM "Post" WHERE "authorUserId" IN (SELECT id FROM d_u) OR "authorMemberId" IN (SELECT id FROM d_m) OR "tenantId" IN (SELECT id FROM d_t) OR "artworkId" IN (SELECT id FROM d_a);
CREATE TEMP TABLE d_mo ON COMMIT DROP AS SELECT id FROM "MarkerOrder" WHERE "memberId" IN (SELECT id FROM d_m) OR "tenantId" IN (SELECT id FROM d_t);

DELETE FROM "Conversation" WHERE id IN (SELECT id FROM d_c);
DELETE FROM "OwnershipTransfer" WHERE "artworkId" IN (SELECT id FROM d_a) OR "dealId" IN (SELECT id FROM d_d) OR "fromUserId" IN (SELECT id FROM d_u) OR "toUserId" IN (SELECT id FROM d_u);
DELETE FROM "RoyaltyPayment" WHERE "artworkId" IN (SELECT id FROM d_a) OR "dealId" IN (SELECT id FROM d_d);
DELETE FROM "Invoice" WHERE "dealId" IN (SELECT id FROM d_d) OR "userId" IN (SELECT id FROM d_u) OR "tenantId" IN (SELECT id FROM d_t);
DELETE FROM "Opportunity" WHERE "artworkId" IN (SELECT id FROM d_a) OR "offerId" IN (SELECT id FROM d_o) OR "tenantId" IN (SELECT id FROM d_t) OR "memberId" IN (SELECT id FROM d_m);
DELETE FROM "Contact" WHERE "tenantId" IN (SELECT id FROM d_t) OR "memberId" IN (SELECT id FROM d_m);
DELETE FROM "Deal" WHERE id IN (SELECT id FROM d_d);
DELETE FROM "Appraisal" WHERE "artworkId" IN (SELECT id FROM d_a) OR "appraiserUserId" IN (SELECT id FROM d_u);
DELETE FROM "AppraisalRequest" WHERE "artworkId" IN (SELECT id FROM d_a) OR "memberId" IN (SELECT id FROM d_m) OR "requestedByUserId" IN (SELECT id FROM d_u);
DELETE FROM "Order" WHERE "userId" IN (SELECT id FROM d_u) OR "tenantId" IN (SELECT id FROM d_t) OR "memberId" IN (SELECT id FROM d_m) OR "artworkId" IN (SELECT id FROM d_a) OR "dealId" IN (SELECT id FROM d_d);
DELETE FROM "Offer" WHERE id IN (SELECT id FROM d_o);
DELETE FROM "InsurancePolicy" WHERE "artworkId" IN (SELECT id FROM d_a);
DELETE FROM "Mandate" WHERE "artworkId" IN (SELECT id FROM d_a) OR "memberId" IN (SELECT id FROM d_m);
DELETE FROM "Certificate" WHERE "artworkId" IN (SELECT id FROM d_a);
DELETE FROM "PhysicalMarker" WHERE "artworkId" IN (SELECT id FROM d_a) OR ("orderId" IN (SELECT id FROM d_mo) AND ("artworkId" IS NULL OR "artworkId" IN (SELECT id FROM d_a)));
DELETE FROM "MarkerBatch" b WHERE NOT EXISTS (SELECT 1 FROM "PhysicalMarker" p WHERE p."batchId" = b.id) AND (b."tenantId" IS NULL OR b."tenantId" IN (SELECT id FROM d_t));
DELETE FROM "MarkerOrder" WHERE id IN (SELECT id FROM d_mo);
DELETE FROM "Reaction" WHERE "userId" IN (SELECT id FROM d_u) OR ("targetKind" = 'POST' AND "targetId" IN (SELECT id FROM d_p)) OR ("targetKind" = 'ARTWORK' AND "targetId" IN (SELECT id FROM d_a)) OR ("targetKind" = 'MEMBER' AND "targetId" IN (SELECT id FROM d_m));
DELETE FROM "PostComment" WHERE "userId" IN (SELECT id FROM d_u) OR ("targetKind" = 'ARTWORK' AND "targetId" IN (SELECT id FROM d_a));
DELETE FROM "PollVote" WHERE "userId" IN (SELECT id FROM d_u);
DELETE FROM "Post" WHERE id IN (SELECT id FROM d_p);
DELETE FROM "OfferRules" WHERE "tenantId" IN (SELECT id FROM d_t) OR "memberId" IN (SELECT id FROM d_m);
DELETE FROM "GalleryItem" WHERE "tenantId" IN (SELECT id FROM d_t);
DELETE FROM "AgendaEvent" WHERE "tenantId" IN (SELECT id FROM d_t);
DELETE FROM "Publication" WHERE "tenantId" IN (SELECT id FROM d_t);
DELETE FROM "Artwork" WHERE id IN (SELECT id FROM d_a);
DELETE FROM "Artist" WHERE "tenantId" IN (SELECT id FROM d_t) OR "memberId" IN (SELECT id FROM d_m);
DELETE FROM "Notification" WHERE "userId" IN (SELECT id FROM d_u);
DELETE FROM "PushSubscription" WHERE "userId" IN (SELECT id FROM d_u);
DELETE FROM "PaymentMethod" WHERE "userId" IN (SELECT id FROM d_u);
DELETE FROM "AccessCode" WHERE "userId" IN (SELECT id FROM d_u);
UPDATE "User" SET "memberId" = NULL WHERE "memberId" IN (SELECT id FROM d_m);
DELETE FROM "User" WHERE id IN (SELECT id FROM d_u);
DELETE FROM "Member" WHERE id IN (SELECT id FROM d_m);
DELETE FROM "Tenant" WHERE id IN (SELECT id FROM d_t);
UPDATE "NewsArticle" SET "imageUrl" = NULL WHERE slug LIKE '%-demo';
COMMIT;
