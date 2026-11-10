-- Public content for the demo (runs AFTER scenario.mjs, because it reuses the public derivatives
-- of the demo artworks as covers and photos). Idempotent: only fills what is empty.
-- Since 2026-11-10 the artists are real (public domain) and the texts are factual.

UPDATE "GalleryPublicProfile" SET "coverUrl"=(SELECT m."publicUrl" FROM "ArtworkMedia" m JOIN "Artwork" a ON a.id=m."artworkId" WHERE a.title='Impressão, nascer do sol' AND m.kind='FRONT_COLOR_CARD' LIMIT 1), "updatedAt"=now()
 WHERE slug='galeria-ladeira-demo' AND "coverUrl" IS NULL;

UPDATE "NewsArticle" n SET "imageUrl"=x.url FROM (VALUES
  ('colecionadores-jovens-demo','Girassóis'),('direito-de-sequencia-demo','A grande onda de Kanagawa'),('como-transportar-tela-grande-demo','Ninfeias')) AS v(slug,title)
 JOIN LATERAL (SELECT m."publicUrl" url FROM "ArtworkMedia" m JOIN "Artwork" a ON a.id=m."artworkId" WHERE a.title=v.title AND m.kind='FRONT_COLOR_CARD' LIMIT 1) x ON true
 WHERE n.slug=v.slug AND n."imageUrl" IS NULL;

UPDATE "Post" p SET "imageUrl"=m."publicUrl" FROM "ArtworkMedia" m
 WHERE p."imageUrl" IS NULL AND p."artworkId"=m."artworkId" AND m.kind='FRONT_COLOR_CARD' AND m."publicUrl" IS NOT NULL;
UPDATE "Post" p SET "imageUrl"=(SELECT m."publicUrl" FROM "ArtworkMedia" m JOIN "Artwork" a ON a.id=m."artworkId" WHERE a.title='Ninfeias' AND m.kind='FRONT_COLOR_CARD' LIMIT 1)
 WHERE p."imageUrl" IS NULL AND p.kind IN ('EVENT','TEXT');

-- Artist pages: the photo is a detail (MACRO_TL) of one of the artist's own works; bios and entries are factual.
INSERT INTO "ArtistProfile" ("artistId","fullName","birthPlace","livesIn","nationality","representation","languagesJson","quote","bio","photoUrl","photoCredit","royaltyBps","createdAt","updatedAt")
SELECT ar.id, v.full_name, v.birth, v.lives, v.nat, v.rep, v.langs, v.quote, v.bio,
       (SELECT m."publicUrl" FROM "ArtworkMedia" m JOIN "Artwork" a ON a.id=m."artworkId" WHERE a."artistId"=ar.id AND m.kind='MACRO_TL' AND m."publicUrl" IS NOT NULL ORDER BY a.id LIMIT 1),
       'Detalhe de obra · domínio público', 500, now(), now()
FROM (VALUES
  ('vincent-van-gogh','Vincent Willem van Gogh','Zundert, Países Baixos','Auvers-sur-Oise, França (1890)','Holandesa',NULL,'["Pintura","Óleo sobre tela"]',NULL,E'Vincent van Gogh (Zundert, 1853 – Auvers-sur-Oise, 1890) começou a pintar perto dos trinta anos e produziu cerca de 2.100 obras em pouco mais de uma década.\n\nDepois de Paris, mudou-se para Arles em 1888, onde pintou os Girassóis e O quarto em Arles. Em 1889, internado em Saint-Rémy-de-Provence, pintou A noite estrelada. Vendeu pouquíssimo em vida; o reconhecimento veio depois da morte.\n\nPerfil de demonstração: as obras estão em domínio público e a venda é simulada.'),
  ('katsushika-hokusai','Katsushika Hokusai','Edo (atual Tóquio), Japão','Edo, Japão (1849)','Japonesa',NULL,'["Gravura","Xilogravura ukiyo-e"]',NULL,E'Katsushika Hokusai (Edo, 1760 – 1849) foi pintor e gravador do período Edo, mestre do ukiyo-e.\n\nA série Trinta e seis vistas do monte Fuji, publicada por volta de 1831, inclui A grande onda de Kanagawa e o Fuji vermelho, e influenciou os impressionistas europeus décadas depois.\n\nPerfil de demonstração: as obras estão em domínio público e a venda é simulada.'),
  ('claude-monet','Oscar-Claude Monet','Paris, França','Giverny, França (1926)','Francesa','Galeria Ladeira','["Pintura","Óleo sobre tela"]',NULL,E'Claude Monet (Paris, 1840 – Giverny, 1926) é o nome central do impressionismo. A tela Impressão, nascer do sol, exposta em 1874, deu nome ao movimento.\n\nA partir de 1883 viveu em Giverny, onde construiu o jardim e o lago que pintou por décadas na série Ninfeias.\n\nPerfil de demonstração: as obras estão em domínio público e a venda é simulada.'),
  ('johannes-vermeer','Johannes Vermeer','Delft, Países Baixos','Delft, Países Baixos (1675)','Holandesa','Galeria Ladeira','["Pintura","Óleo sobre tela"]',NULL,E'Johannes Vermeer (Delft, 1632 – 1675) pintou cenas de interior de luz precisa e deixou poucas obras: cerca de 35 lhe são atribuídas.\n\nMoça com brinco de pérola, de cerca de 1665, é um tronie: um estudo de figura, não o retrato de alguém identificado.\n\nPerfil de demonstração: a obra está em domínio público e a venda é simulada.'),
  ('almeida-junior','José Ferraz de Almeida Júnior','Itu/SP, Brasil','Piracicaba/SP, Brasil (1899)','Brasileira',NULL,'["Pintura","Óleo sobre tela"]',NULL,E'Almeida Júnior (Itu, 1850 – Piracicaba, 1899) estudou na Academia Imperial de Belas Artes e em Paris, e trouxe para a pintura brasileira o homem do interior paulista.\n\nCaipira picando fumo (1893), O violeiro e Saudade (1899) estão entre as suas telas mais conhecidas.\n\nPerfil de demonstração: a obra está em domínio público e a venda é simulada.')
) AS v(slug,full_name,birth,lives,nat,rep,langs,quote,bio) JOIN "Artist" ar ON ar.slug=v.slug
ON CONFLICT ("artistId") DO NOTHING;

INSERT INTO "ArtistEntry" ("artistId",kind,year,title,venue,city,"sortOrder")
SELECT ar.id, v.kind, v.year, v.title, v.venue, v.city, v.ord FROM (VALUES
  ('vincent-van-gogh','COLLECTION','1941','A noite estrelada no acervo','The Museum of Modern Art','Nova York',1),
  ('vincent-van-gogh','COLLECTION','1973','Abertura do museu dedicado ao artista','Van Gogh Museum','Amsterdã',2),
  ('vincent-van-gogh','GROUP','1890','Les XX','Salão dos XX','Bruxelas',3),
  ('katsushika-hokusai','SOLO','1831','Trinta e seis vistas do monte Fuji','Editor Nishimuraya Yohachi','Edo',1),
  ('katsushika-hokusai','COLLECTION','1914','Gravuras no acervo','The Metropolitan Museum of Art','Nova York',2),
  ('claude-monet','GROUP','1874','Primeira exposição impressionista','Ateliê de Nadar','Paris',1),
  ('claude-monet','COLLECTION','1940','Impressão, nascer do sol no acervo','Musée Marmottan Monet','Paris',2),
  ('claude-monet','COLLECTION','1927','Ninfeias','Musée de l''Orangerie','Paris',3),
  ('johannes-vermeer','COLLECTION','1902','Moça com brinco de pérola no acervo','Mauritshuis','Haia',1),
  ('almeida-junior','EDUCATION','1876','Bolsa de estudos em Paris','École des Beaux-Arts','Paris',1),
  ('almeida-junior','COLLECTION','1905','Obras no acervo','Pinacoteca do Estado de São Paulo','São Paulo/SP',2)
) AS v(slug,kind,year,title,venue,city,ord) JOIN "Artist" ar ON ar.slug=v.slug
WHERE NOT EXISTS (SELECT 1 FROM "ArtistEntry" e WHERE e."artistId"=ar.id);

-- Gallery page: photos of the space, virtual-tour rooms, team and milestones.
INSERT INTO "GalleryItem" ("tenantId",kind,title,subtitle,url,"sortOrder")
SELECT t.id, v.kind, v.title, v.subtitle,
       CASE WHEN v.work IS NULL THEN NULL ELSE (SELECT m."publicUrl" FROM "ArtworkMedia" m JOIN "Artwork" a ON a.id=m."artworkId" WHERE a.title=v.work AND m.kind=v.mkind LIMIT 1) END, v.ord
FROM "Tenant" t, (VALUES
  ('PHOTO','Sala principal','Claude Monet, Impressão, nascer do sol','Impressão, nascer do sol','FRONT_COLOR_CARD',1),
  ('PHOTO','Sala 2','Claude Monet, Ninfeias','Ninfeias','FRONT_COLOR_CARD',2),
  ('PHOTO','Gabinete','Johannes Vermeer, Moça com brinco de pérola','Moça com brinco de pérola','FRONT_COLOR_CARD',3),
  ('ROOM','Sala principal',NULL,'Impressão, nascer do sol','MACRO_BR',1),
  ('ROOM','Sala 2',NULL,'Ninfeias','MACRO_BR',2),
  ('TEAM','Ana Ladeira','Sócia-fundadora','Ninfeias','MACRO_TL',1),
  ('TEAM','Caio Lemos','Vendas','Impressão, nascer do sol','MACRO_TL',2),
  ('MILESTONE','Abertura do sobrado em Santo Antônio Além do Carmo','2009',NULL,NULL,1),
  ('MILESTONE','Primeira participação em feira','2014',NULL,NULL,2),
  ('MILESTONE','Programa de residências','2021',NULL,NULL,3)
) AS v(kind,title,subtitle,work,mkind,ord)
WHERE t.slug='galeria-ladeira-demo' AND NOT EXISTS (SELECT 1 FROM "GalleryItem" g WHERE g."tenantId"=t.id);

INSERT INTO "Publication" ("artistId","tenantId",kind,title,meta,"priceCents",action,"coverUrl","sortOrder","createdAt")
SELECT (SELECT id FROM "Artist" WHERE slug=v.artist), (SELECT id FROM "Tenant" WHERE slug=v.tenant), v.kind, v.title, v.meta, v.price, v.action,
       (SELECT m."publicUrl" FROM "ArtworkMedia" m JOIN "Artwork" a ON a.id=m."artworkId" WHERE a.title=v.work AND m.kind='FRONT_COLOR_CARD' LIMIT 1), 1, now()
FROM (VALUES
  ('vincent-van-gogh',NULL,'ESSAY','Van Gogh em Arles: quinze meses','Ensaio · 14 páginas',NULL::bigint,'READ','O quarto em Arles'),
  ('claude-monet',NULL,'ESSAY','Monet e a série das Ninfeias','Ensaio · 12 páginas',NULL::bigint,'READ','Ninfeias'),
  (NULL,'galeria-ladeira-demo','EBOOK','Ladeira · quinze anos','96 páginas · PDF e ePub',4900::bigint,'BUY','Impressão, nascer do sol')
) AS v(artist,tenant,kind,title,meta,price,action,work)
WHERE NOT EXISTS (SELECT 1 FROM "Publication");
