-- Public content for the demo (runs AFTER scenario.mjs, because it reuses the public derivatives
-- of the demo artworks as covers, portraits and photos). Idempotent: only fills what is empty.
-- The media URLs below are the ones produced by the production run of 2026-10-22; on another
-- environment, replace them by `SELECT "publicUrl" FROM "ArtworkMedia" WHERE kind='FRONT_COLOR_CARD'`.

UPDATE "GalleryPublicProfile" SET "coverUrl"=(SELECT m."publicUrl" FROM "ArtworkMedia" m JOIN "Artwork" a ON a.id=m."artworkId" WHERE a.title='Retábulo do Rio Vermelho' AND m.kind='FRONT_COLOR_CARD' LIMIT 1), "updatedAt"=now()
 WHERE slug='galeria-ladeira-demo' AND "coverUrl" IS NULL;

UPDATE "NewsArticle" n SET "imageUrl"=x.url FROM (VALUES
  ('colecionadores-jovens-demo','Voo baixo'),('direito-de-sequencia-demo','Maré cheia'),('como-transportar-tela-grande-demo','Duas luas')) AS v(slug,title)
 JOIN LATERAL (SELECT m."publicUrl" url FROM "ArtworkMedia" m JOIN "Artwork" a ON a.id=m."artworkId" WHERE a.title=v.title AND m.kind='FRONT_COLOR_CARD' LIMIT 1) x ON true
 WHERE n.slug=v.slug AND n."imageUrl" IS NULL;

UPDATE "Post" p SET "imageUrl"=m."publicUrl" FROM "ArtworkMedia" m
 WHERE p."imageUrl" IS NULL AND p."artworkId"=m."artworkId" AND m.kind='FRONT_COLOR_CARD' AND m."publicUrl" IS NOT NULL;
UPDATE "Post" p SET "imageUrl"=(SELECT m."publicUrl" FROM "ArtworkMedia" m JOIN "Artwork" a ON a.id=m."artworkId" WHERE a.title='Retábulo do Rio Vermelho' AND m.kind='MACRO_TL' LIMIT 1)
 WHERE p."imageUrl" IS NULL AND p.kind IN ('EVENT','TEXT');

-- Artist portraits = a detail (MACRO_TL) of one of the artist's own works; bios and trajectory.
INSERT INTO "ArtistProfile" ("artistId","fullName","birthPlace","livesIn","nationality","representation","languagesJson","quote","bio","photoUrl","photoCredit","royaltyBps","createdAt","updatedAt")
SELECT ar.id, v.full_name, v.birth, v.lives, 'Brasileira', v.rep, v.langs, v.quote, v.bio,
       (SELECT m."publicUrl" FROM "ArtworkMedia" m JOIN "Artwork" a ON a.id=m."artworkId" WHERE a."artistId"=ar.id AND m.kind='MACRO_TL' AND m."publicUrl" IS NOT NULL ORDER BY a.id LIMIT 1),
       'Detalhe de obra', 500, now(), now()
FROM (VALUES
  ('joana-teixeira-demo','Joana Teixeira','Salvador/BA','Salvador/BA','Galeria Ladeira','["Pintura","Acrílica sobre tela"]','Pinto a cidade que sobe e desce ladeira: o que ela esconde atrás dos muros.',E'Joana Teixeira nasceu em Salvador em 1988 e mantém ateliê em Santo Antônio Além do Carmo.\n\nA série Construções (2024–2026) parte de fachadas e andaimes do Centro Histórico para chegar a composições quase abstratas, de cor cheia e geometria solta.'),
  ('marta-okoye-demo','Marta Okoye','Recife/PE','Recife/PE',NULL,'["Fotografia","Pintura"]','O litoral muda de cor duas vezes por dia; eu só anoto.','Fotógrafa e artista visual nascida em Recife em 1991. Trabalha com o litoral de Pernambuco, entre a fotografia de longa exposição e a pintura.'),
  ('tomas-barreto-demo','Tomás Barreto','Cachoeira/BA','Salvador/BA','Galeria Ladeira','["Pintura","Óleo sobre linho"]','Quem pinta o Recôncavo pinta água e barro.',E'Tomás Barreto (Cachoeira, 1952) é um dos nomes da pintura baiana da virada do século. Retábulos, marés e luas atravessam cinco décadas de trabalho.\n\nRepresentado pela Galeria Ladeira desde 2011.'),
  ('lia-mendes-demo','Lia Mendes','Ilhéus/BA','Salvador/BA','Galeria Ladeira','["Pintura","Têmpera"]',NULL,'Lia Mendes (Ilhéus, 1979) pinta a orla de Salvador em têmpera, em séries curtas sobre a maré.')
) AS v(slug,full_name,birth,lives,rep,langs,quote,bio) JOIN "Artist" ar ON ar.slug=v.slug
ON CONFLICT ("artistId") DO NOTHING;

INSERT INTO "ArtistEntry" ("artistId",kind,year,title,venue,city,"sortOrder")
SELECT ar.id, v.kind, v.year, v.title, v.venue, v.city, v.ord FROM (VALUES
  ('joana-teixeira-demo','SOLO','2026','Construções','Galeria Ladeira','Salvador/BA',1),
  ('joana-teixeira-demo','GROUP','2025','Novos nomes da Bahia','MAM-BA','Salvador/BA',2),
  ('joana-teixeira-demo','EDUCATION','2011','Bacharelado em Artes Plásticas','EBA-UFBA','Salvador/BA',3),
  ('marta-okoye-demo','SOLO','2024','Duas marés','Caixa Cultural','Recife/PE',1),
  ('marta-okoye-demo','AWARD','2022','Prêmio Fotografia Contemporânea','Funcultura','Recife/PE',2),
  ('tomas-barreto-demo','SOLO','2019','Retábulos','Galeria Ladeira','Salvador/BA',1),
  ('tomas-barreto-demo','COLLECTION','2008','Acervo do MAM-BA','MAM-BA','Salvador/BA',2),
  ('tomas-barreto-demo','GROUP','1996','Bienal da Bahia','Bienal da Bahia','Salvador/BA',3),
  ('lia-mendes-demo','SOLO','2023','Itapuã, seis horas','Galeria Ladeira','Salvador/BA',1)
) AS v(slug,kind,year,title,venue,city,ord) JOIN "Artist" ar ON ar.slug=v.slug
WHERE NOT EXISTS (SELECT 1 FROM "ArtistEntry" e WHERE e."artistId"=ar.id);

-- Gallery page: photos of the space, virtual-tour rooms, team and milestones.
INSERT INTO "GalleryItem" ("tenantId",kind,title,subtitle,url,"sortOrder")
SELECT t.id, v.kind, v.title, v.subtitle,
       CASE WHEN v.work IS NULL THEN NULL ELSE (SELECT m."publicUrl" FROM "ArtworkMedia" m JOIN "Artwork" a ON a.id=m."artworkId" WHERE a.title=v.work AND m.kind=v.mkind LIMIT 1) END, v.ord
FROM "Tenant" t, (VALUES
  ('PHOTO','Sala principal','Montagem de Construções','Retábulo do Rio Vermelho','FRONT_COLOR_CARD',1),
  ('PHOTO','Sala 2','Tomás Barreto, Duas luas','Duas luas','FRONT_COLOR_CARD',2),
  ('PHOTO','Reserva técnica','Obras em trânsito','Maré baixa, Itapuã','FRONT_COLOR_CARD',3),
  ('ROOM','Sala principal',NULL,'Retábulo do Rio Vermelho','MACRO_BR',1),
  ('ROOM','Sala 2',NULL,'Duas luas','MACRO_BR',2),
  ('TEAM','Ana Ladeira','Sócia-fundadora','Duas luas','MACRO_TL',1),
  ('TEAM','Caio Lemos','Vendas','Maré baixa, Itapuã','MACRO_BR',2),
  ('MILESTONE','Abertura do sobrado em Santo Antônio Além do Carmo','2009',NULL,NULL,1),
  ('MILESTONE','Primeira participação em feira','2014',NULL,NULL,2),
  ('MILESTONE','Programa de residências','2021',NULL,NULL,3)
) AS v(kind,title,subtitle,work,mkind,ord)
WHERE t.slug='galeria-ladeira-demo' AND NOT EXISTS (SELECT 1 FROM "GalleryItem" g WHERE g."tenantId"=t.id);

INSERT INTO "Publication" ("artistId","tenantId",kind,title,meta,"priceCents",action,"coverUrl","sortOrder","createdAt")
SELECT (SELECT id FROM "Artist" WHERE slug=v.artist), (SELECT id FROM "Tenant" WHERE slug=v.tenant), v.kind, v.title, v.meta, v.price, v.action,
       (SELECT m."publicUrl" FROM "ArtworkMedia" m JOIN "Artwork" a ON a.id=m."artworkId" WHERE a.title=v.work AND m.kind='FRONT_COLOR_CARD' LIMIT 1), 1, now()
FROM (VALUES
  ('joana-teixeira-demo',NULL,'CATALOGUE','Construções · catálogo da exposição','64 páginas · PDF',NULL::bigint,'READ','Estudo em vermelho'),
  ('tomas-barreto-demo',NULL,'ESSAY','Tomás Barreto, cinco décadas','Ensaio · 12 páginas',NULL::bigint,'READ','Duas luas'),
  (NULL,'galeria-ladeira-demo','EBOOK','Ladeira · quinze anos','96 páginas · PDF e ePub',4900::bigint,'BUY','Retábulo do Rio Vermelho')
) AS v(artist,tenant,kind,title,meta,price,action,work)
WHERE NOT EXISTS (SELECT 1 FROM "Publication");
