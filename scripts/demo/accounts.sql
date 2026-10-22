-- Demo accounts for the fictitious scenario (scripts/demo/scenario.mjs). Idempotent: every row keyed by a unique slug/email.
-- Password of every demo login: Demo-HouseArt-2026 (bcrypt below). Documents are test CPFs (valid check digits, not real people).
INSERT INTO "Tenant" ("kind","name","slug","status","createdAt","updatedAt") VALUES
  ('PERSON','Joana Teixeira','joana-teixeira-demo','ACTIVE',now(),now()),
  ('PERSON','Marta Okoye','marta-okoye-demo','ACTIVE',now(),now()),
  ('GALLERY','Galeria Ladeira','galeria-ladeira-demo','ACTIVE',now(),now()),
  ('PERSON','Helena Prado','helena-prado-demo','ACTIVE',now(),now())
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "User" ("email","name","passwordHash","profile","active","cpf","phone","phoneVerifiedAt","emailVerifiedAt","termsAcceptedAt","tenantId","tenantRole","preferencesJson","createdAt","updatedAt") VALUES
  ('joana.demo@houseart.test','Joana Teixeira','$2b$10$g/AW/64B0.WG6MBnOynm7eqKOnlqPNiY9rX6DUGBJNQqt1YDDXBd6','member',true,NULL,'+5571999010001',now(),now(),now(),(SELECT id FROM "Tenant" WHERE slug='joana-teixeira-demo'),'ADMIN','{"city":"Salvador/BA"}',now(),now()),
  ('marta.demo@houseart.test','Marta Okoye','$2b$10$g/AW/64B0.WG6MBnOynm7eqKOnlqPNiY9rX6DUGBJNQqt1YDDXBd6','member',true,NULL,'+5581999010002',now(),now(),now(),(SELECT id FROM "Tenant" WHERE slug='marta-okoye-demo'),'ADMIN','{"city":"Recife/PE"}',now(),now()),
  ('ana.demo@houseart.test','Ana Ladeira','$2b$10$g/AW/64B0.WG6MBnOynm7eqKOnlqPNiY9rX6DUGBJNQqt1YDDXBd6','member',true,NULL,'+5571999010003',now(),now(),now(),(SELECT id FROM "Tenant" WHERE slug='galeria-ladeira-demo'),'ADMIN','{"city":"Salvador/BA"}',now(),now()),
  ('caio.demo@houseart.test','Caio Lemos','$2b$10$g/AW/64B0.WG6MBnOynm7eqKOnlqPNiY9rX6DUGBJNQqt1YDDXBd6','member',true,NULL,'+5571999010004',now(),now(),now(),(SELECT id FROM "Tenant" WHERE slug='galeria-ladeira-demo'),'MEMBER','{"city":"Salvador/BA"}',now(),now()),
  ('helena.demo@houseart.test','Helena Prado','$2b$10$g/AW/64B0.WG6MBnOynm7eqKOnlqPNiY9rX6DUGBJNQqt1YDDXBd6','member',true,NULL,'+5511999010005',now(),now(),now(),(SELECT id FROM "Tenant" WHERE slug='helena-prado-demo'),'ADMIN','{"city":"São Paulo/SP"}',now(),now()),
  ('marina.demo@houseart.test','Marina Lopes','$2b$10$g/AW/64B0.WG6MBnOynm7eqKOnlqPNiY9rX6DUGBJNQqt1YDDXBd6','collector',true,'52998224725','+5571999010006',now(),now(),now(),NULL,NULL,'{"city":"Salvador/BA","uses":["buy"]}',now(),now()),
  ('marcelo.demo@houseart.test','Marcelo Bastos','$2b$10$g/AW/64B0.WG6MBnOynm7eqKOnlqPNiY9rX6DUGBJNQqt1YDDXBd6','collector',true,'11144477735','+5581999010007',now(),now(),now(),NULL,NULL,'{"city":"Recife/PE","uses":["buy"]}',now(),now()),
  ('lia.demo@houseart.test','Lia Souza','$2b$10$g/AW/64B0.WG6MBnOynm7eqKOnlqPNiY9rX6DUGBJNQqt1YDDXBd6','collector',true,'52601815906','+5511999010008',now(),now(),now(),NULL,NULL,'{"city":"São Paulo/SP","uses":["buy"]}',now(),now()),
  ('rui.demo@houseart.test','Rui Andrade','$2b$10$g/AW/64B0.WG6MBnOynm7eqKOnlqPNiY9rX6DUGBJNQqt1YDDXBd6','appraiser',true,'08301661305','+5571999010009',now(),now(),now(),NULL,NULL,'{}',now(),now())
ON CONFLICT ("email") DO NOTHING;

INSERT INTO "UserProfile" ("userId","kind","isDefault","createdAt") VALUES
  ((SELECT id FROM "User" WHERE email='joana.demo@houseart.test'),'ARTIST',true,now()),
  ((SELECT id FROM "User" WHERE email='marta.demo@houseart.test'),'ARTIST',true,now()),
  ((SELECT id FROM "User" WHERE email='ana.demo@houseart.test'),'GALLERY',true,now()),
  ((SELECT id FROM "User" WHERE email='caio.demo@houseart.test'),'GALLERY',true,now()),
  ((SELECT id FROM "User" WHERE email='helena.demo@houseart.test'),'ADVISOR',true,now()),
  ((SELECT id FROM "User" WHERE email='marina.demo@houseart.test'),'COLLECTOR',true,now()),
  ((SELECT id FROM "User" WHERE email='marcelo.demo@houseart.test'),'COLLECTOR',true,now()),
  ((SELECT id FROM "User" WHERE email='lia.demo@houseart.test'),'COLLECTOR',true,now()),
  ((SELECT id FROM "User" WHERE email='rui.demo@houseart.test'),'APPRAISER',true,now())
ON CONFLICT ("userId","kind") DO NOTHING;

INSERT INTO "Member" ("userId","tenantId","kind","displayName","slug","city","uf","status","role","approvedAt","bio","createdAt","updatedAt") VALUES
  ((SELECT id FROM "User" WHERE email='joana.demo@houseart.test'),(SELECT id FROM "Tenant" WHERE slug='joana-teixeira-demo'),'ARTIST','Joana Teixeira','joana-teixeira-demo','Salvador','BA','ACTIVE',NULL,now(),'Pintora. Série Construções (2024–2026), ateliê em Santo Antônio Além do Carmo.',now(),now()),
  ((SELECT id FROM "User" WHERE email='marta.demo@houseart.test'),(SELECT id FROM "Tenant" WHERE slug='marta-okoye-demo'),'ARTIST','Marta Okoye','marta-okoye-demo','Recife','PE','ACTIVE',NULL,now(),'Fotógrafa e artista visual; trabalha com o litoral de Pernambuco.',now(),now()),
  ((SELECT id FROM "User" WHERE email='ana.demo@houseart.test'),(SELECT id FROM "Tenant" WHERE slug='galeria-ladeira-demo'),'GALLERY_STAFF','Galeria Ladeira','galeria-ladeira-demo','Salvador','BA','ACTIVE','ADMIN',now(),NULL,now(),now()),
  ((SELECT id FROM "User" WHERE email='caio.demo@houseart.test'),(SELECT id FROM "Tenant" WHERE slug='galeria-ladeira-demo'),'GALLERY_STAFF','Galeria Ladeira · Caio','galeria-ladeira-caio-demo','Salvador','BA','ACTIVE','SALES',now(),NULL,now(),now()),
  ((SELECT id FROM "User" WHERE email='helena.demo@houseart.test'),(SELECT id FROM "Tenant" WHERE slug='helena-prado-demo'),'ADVISOR','Helena Prado · art advisory','helena-prado-demo','São Paulo','SP','ACTIVE',NULL,now(),'Consultora de arte para coleções particulares e corporativas.',now(),now())
ON CONFLICT ("slug") DO NOTHING;

UPDATE "User" u SET "memberId" = m.id FROM "Member" m WHERE m."userId" = u.id AND u."memberId" IS NULL AND u.email LIKE '%.demo@houseart.test';

INSERT INTO "Artist" ("memberId","tenantId","name","slug","birthYear","verifiedAt","createdAt","updatedAt") VALUES
  ((SELECT id FROM "Member" WHERE slug='joana-teixeira-demo'),(SELECT id FROM "Tenant" WHERE slug='joana-teixeira-demo'),'Joana Teixeira','joana-teixeira-demo',1988,now(),now(),now()),
  ((SELECT id FROM "Member" WHERE slug='marta-okoye-demo'),(SELECT id FROM "Tenant" WHERE slug='marta-okoye-demo'),'Marta Okoye','marta-okoye-demo',1991,now(),now(),now()),
  (NULL,(SELECT id FROM "Tenant" WHERE slug='galeria-ladeira-demo'),'Tomás Barreto','tomas-barreto-demo',1952,now(),now(),now()),
  (NULL,(SELECT id FROM "Tenant" WHERE slug='galeria-ladeira-demo'),'Lia Mendes','lia-mendes-demo',1979,now(),now(),now())
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "GalleryPublicProfile" ("tenantId","slug","name","city","uf","foundedYear","summary","about","tagsJson","street","district","lat","lng","websiteUrl","hours","createdAt","updatedAt") VALUES
  ((SELECT id FROM "Tenant" WHERE slug='galeria-ladeira-demo'),'galeria-ladeira-demo','Galeria Ladeira','Salvador','BA',2009,'Pintura contemporânea baiana, com foco em artistas do Centro Histórico.',E'Galeria Ladeira nasceu em 2009 num sobrado de Santo Antônio Além do Carmo, fundada por duas amigas que queriam mostrar artistas da cidade fora do circuito das capitais do Sudeste.\n\nAo longo dos anos, o programa cresceu para incluir residências, publicações e uma presença constante em feiras, sem perder o foco em artistas locais em início e meio de carreira.','["Contemporânea","Pintura"]','Rua Direita de Santo Antônio, 214','Santo Antônio Além do Carmo',-12.9668,-38.5048,'https://galerialadeira.example','Terça a sábado, 10h às 19h',now(),now())
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "NewsArticle" ("slug","category","title","summary","body","featured","publishedAt","createdAt") VALUES
  ('colecionadores-jovens-demo','Mercado','Colecionadores jovens já respondem por um terço das compras online','Compra por celular, pagamento parcelado e certificado digital puxam a entrada de quem tem menos de 40 anos no mercado de arte.',E'Nos últimos dois anos, as plataformas de venda de arte viram o perfil do comprador mudar. Quem tem menos de 40 anos já responde por cerca de um terço das compras online, segundo levantamentos do setor.\n\nTrês fatores explicam o movimento: a compra pelo celular, o pagamento em garantia e o certificado digital, que reduz o medo de comprar sem ver a obra ao vivo.\n\nPara galerias e artistas, a consequência é prática: a ficha da obra precisa estar completa, com fotos em luz rasante, dimensões e histórico, porque é ali que a decisão acontece.',true,now() - interval '2 days',now()),
  ('direito-de-sequencia-demo','Direito','O que o artista recebe quando sua obra é revendida','Na revenda, o artista tem direito a uma parte da valorização. Na HouseArt, o repasse sai automático no momento da transferência.',E'O direito de sequência garante ao artista uma participação quando a obra é revendida por valor maior do que o da venda anterior.\n\nNa HouseArt, o cálculo é feito pela plataforma no momento da transferência de titularidade: 5 % da valorização, retidos na divisão da venda e repassados ao artista.\n\nO comprador vê o valor antes de confirmar; o vendedor vê o líquido estimado antes de publicar o anúncio.',false,now() - interval '5 days',now()),
  ('como-transportar-tela-grande-demo','Guias','Como transportar uma tela grande sem susto','Caixa sob medida, seguro de parede a parede e condition report na saída e na chegada: o passo a passo das transportadoras especializadas.',E'Uma tela grande pede caixa sob medida, com cantoneiras e proteção contra umidade.\n\nO seguro de parede a parede cobre a obra desde a retirada até a instalação na nova casa.\n\nO condition report, feito na saída e na chegada, é o documento que protege as duas partes.',false,now() - interval '9 days',now())
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "AgendaEvent" ("kind","title","venue","city","startsOn","endsOn","period","url","tenantId","createdAt")
SELECT v.* FROM (VALUES
  ('OPENING','Abertura · Joana Teixeira, Construções','Galeria Ladeira','Salvador/BA',to_char(now() + interval '12 days','YYYY-MM-DD'),NULL,'19h',NULL,(SELECT id FROM "Tenant" WHERE slug='galeria-ladeira-demo'),now()),
  ('EXHIBITION','Mostra coletiva · Novos nomes da Bahia','Museu de Arte Moderna da Bahia','Salvador/BA',to_char(now() + interval '20 days','YYYY-MM-DD'),to_char(now() + interval '75 days','YYYY-MM-DD'),'Entrada gratuita',NULL,NULL,now()),
  ('FAIR','Feira de arte contemporânea','Pavilhão de exposições','São Paulo/SP',to_char(now() + interval '40 days','YYYY-MM-DD'),to_char(now() + interval '44 days','YYYY-MM-DD'),'4 dias · 80 galerias',NULL,NULL,now())
) AS v(kind,title,venue,city,"startsOn","endsOn",period,url,"tenantId","createdAt")
WHERE NOT EXISTS (SELECT 1 FROM "AgendaEvent" a WHERE a.title = v.title);
