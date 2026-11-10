-- Artist pages of the extra real works (runs AFTER more-works.manual.mjs). Idempotent: only fills what is empty.
UPDATE "Artist" a SET "birthYear"=v.y, "verifiedAt"=COALESCE(a."verifiedAt", now()) FROM (VALUES
  ('gustav-klimt',1862),('georges-seurat',1859),('sandro-botticelli',1445),('leonardo-da-vinci',1452),('rembrandt-van-rijn',1606),
  ('diego-velazquez',1599),('pierre-auguste-renoir',1841),('edgar-degas',1834),('paul-cezanne',1839),('pedro-americo',1843),
  ('victor-meirelles',1832),('belmiro-de-almeida',1858),('edvard-munch',1863),('utagawa-hiroshige',1797)) AS v(slug,y)
 WHERE a.slug=v.slug AND a."birthYear" IS NULL;

INSERT INTO "ArtistProfile" ("artistId","fullName","birthPlace","livesIn","nationality","representation","languagesJson","quote","bio","photoUrl","photoCredit","royaltyBps","createdAt","updatedAt")
SELECT ar.id, v.full_name, v.birth, v.lives, v.nat, v.rep, v.langs, NULL, v.bio || E'\n\nPerfil de demonstração: as obras estão em domínio público e a venda é simulada.',
       (SELECT m."publicUrl" FROM "ArtworkMedia" m JOIN "Artwork" a ON a.id=m."artworkId" WHERE a."artistId"=ar.id AND m.kind='MACRO_TL' AND m."publicUrl" IS NOT NULL ORDER BY a.id LIMIT 1),
       'Detalhe de obra · domínio público', 500, now(), now()
FROM (VALUES
  ('gustav-klimt','Gustav Klimt','Baumgarten (Viena), Áustria','Viena, Áustria (1918)','Austríaca','Galeria Ladeira','["Pintura","Óleo e folha de ouro"]','Gustav Klimt (1862 – 1918) foi o nome central da Secessão de Viena. Na chamada fase dourada, entre 1899 e 1910, combinou óleo e folha de ouro em obras como O beijo e o Retrato de Adele Bloch-Bauer I.'),
  ('georges-seurat','Georges-Pierre Seurat','Paris, França','Paris, França (1891)','Francesa','Galeria Ladeira','["Pintura","Pontilhismo"]','Georges Seurat (1859 – 1891) criou o pontilhismo: pequenos pontos de cor pura que o olho mistura à distância. Uma tarde de domingo na Ilha de La Grande Jatte levou dois anos de trabalho.'),
  ('sandro-botticelli','Alessandro di Mariano Filipepi','Florença, Itália','Florença, Itália (1510)','Italiana','Galeria Ladeira','["Pintura","Têmpera"]','Sandro Botticelli (c. 1445 – 1510) trabalhou em Florença sob a proteção dos Médici. O nascimento de Vênus e A primavera estão entre as imagens mais conhecidas do Renascimento.'),
  ('leonardo-da-vinci','Leonardo di ser Piero da Vinci','Vinci, Itália','Amboise, França (1519)','Italiana','Galeria Ladeira','["Pintura","Óleo sobre madeira"]','Leonardo da Vinci (1452 – 1519) foi pintor, engenheiro e estudioso da natureza. Deixou poucas pinturas; a Mona Lisa, iniciada em Florença por volta de 1503, acompanhou o artista até o fim da vida.'),
  ('rembrandt-van-rijn','Rembrandt Harmenszoon van Rijn','Leiden, Países Baixos','Amsterdã, Países Baixos (1669)','Holandesa','Galeria Ladeira','["Pintura","Óleo sobre tela"]','Rembrandt (1606 – 1669) é o grande nome do Século de Ouro holandês, mestre do claro-escuro. A ronda noturna, de 1642, transformou o retrato de grupo numa cena em movimento.'),
  ('diego-velazquez','Diego Rodríguez de Silva y Velázquez','Sevilha, Espanha','Madri, Espanha (1660)','Espanhola','Galeria Ladeira','["Pintura","Óleo sobre tela"]','Diego Velázquez (1599 – 1660) foi pintor da corte de Filipe IV. As meninas, de 1656, é uma das pinturas mais estudadas da história da arte.'),
  ('pierre-auguste-renoir','Pierre-Auguste Renoir','Limoges, França','Cagnes-sur-Mer, França (1919)','Francesa','Galeria Ladeira','["Pintura","Óleo sobre tela"]','Pierre-Auguste Renoir (1841 – 1919) foi um dos fundadores do impressionismo. Pintou a vida ao ar livre de Paris: bailes, almoços e passeios à beira do Sena.'),
  ('edgar-degas','Hilaire-Germain-Edgar De Gas','Paris, França','Paris, França (1917)','Francesa','Galeria Ladeira','["Pintura","Pastel"]','Edgar Degas (1834 – 1917) expôs com os impressionistas, mas preferia o desenho e as cenas de interior. As bailarinas da Ópera de Paris ocupam mais da metade da sua obra.'),
  ('paul-cezanne','Paul Cézanne','Aix-en-Provence, França','Aix-en-Provence, França (1906)','Francesa','Galeria Ladeira','["Pintura","Óleo sobre tela"]','Paul Cézanne (1839 – 1906) é a ponte entre o impressionismo e a arte do século XX. A série Os jogadores de cartas foi pintada em Aix-en-Provence entre 1890 e 1895.'),
  ('pedro-americo','Pedro Américo de Figueiredo e Melo','Areia/PB, Brasil','Florença, Itália (1905)','Brasileira',NULL,'["Pintura","Pintura histórica"]','Pedro Américo (1843 – 1905) foi o principal pintor histórico do Império brasileiro. Independência ou morte, concluída em Florença em 1888, pertence ao Museu do Ipiranga.'),
  ('victor-meirelles','Victor Meirelles de Lima','Desterro (atual Florianópolis)/SC, Brasil','Rio de Janeiro/RJ, Brasil (1903)','Brasileira',NULL,'["Pintura","Pintura histórica"]','Victor Meirelles (1832 – 1903) pintou a Primeira missa no Brasil em Paris; em 1861 foi a primeira obra de um brasileiro aceita no Salão de Paris.'),
  ('belmiro-de-almeida','Belmiro Barbosa de Almeida','Serro/MG, Brasil','Paris, França (1935)','Brasileira',NULL,'["Pintura","Óleo sobre tela"]','Belmiro de Almeida (1858 – 1935) foi pintor, escultor e caricaturista. Arrufos, de 1887, trouxe para a pintura brasileira uma cena da vida privada urbana.'),
  ('edvard-munch','Edvard Munch','Løten, Noruega','Oslo, Noruega (1944)','Norueguesa',NULL,'["Pintura","Gravura"]','Edvard Munch (1863 – 1944) é um precursor do expressionismo. O grito, de 1893, tem quatro versões, entre pintura e pastel.'),
  ('utagawa-hiroshige','Utagawa Hiroshige','Edo (atual Tóquio), Japão','Edo, Japão (1858)','Japonesa',NULL,'["Gravura","Xilogravura ukiyo-e"]','Utagawa Hiroshige (1797 – 1858) foi o último grande mestre do ukiyo-e. A série Cem vistas famosas de Edo influenciou os impressionistas; Van Gogh copiou duas delas a óleo.')
) AS v(slug,full_name,birth,lives,nat,rep,langs,bio) JOIN "Artist" ar ON ar.slug=v.slug
ON CONFLICT ("artistId") DO NOTHING;

UPDATE "Post" p SET "imageUrl"=m."publicUrl" FROM "ArtworkMedia" m
 WHERE p."imageUrl" IS NULL AND p."artworkId"=m."artworkId" AND m.kind='FRONT_COLOR_CARD' AND m."publicUrl" IS NOT NULL;
