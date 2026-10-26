// Demo content for the PUBLIC pages (handoff Fase 7), on a LOCAL database only:
// a gallery with public profile, three artists (one deceased) with profile and
// curriculum, listed artworks with covers from /design-system, certificates
// with events, news and agenda. Idempotent by slug. Never runs against a
// remote host.
//   Use: npx tsx scripts/seed-public-demo.ts
import 'dotenv/config'
import { prisma } from '../lib/prisma'
import { hashPassword } from '../lib/auth'
import { chainHash } from '../lib/certificate-events/core'
import { contentHashOf } from '../lib/certificates/core'

const url = process.env.DATABASE_URL ?? ''
if (!/localhost|127\.0\.0\.1/.test(url)) { console.error('seed-public-demo: só em banco local (DATABASE_URL aponta para fora).'); process.exit(1) }

const IMG = (n: string) => `/design-system/ha-${n}.png`

// The same chain as lib/certificate-events/server.ts (server-only, unusable outside Next).
async function recordEvent(certificateId: number, kind: string, at: Date) {
  const last = await prisma.certificateEvent.findFirst({ where: { certificateId }, orderBy: { seq: 'desc' } })
  const seq = (last?.seq ?? 0) + 1
  const body = { kind, seq, by: 'seed', at: at.toISOString() }
  await prisma.certificateEvent.create({ data: { certificateId, seq, kind, payloadJson: JSON.stringify(body), hash: chainHash(last?.hash ?? null, body), prevHash: last?.hash ?? null, occurredAt: at } })
}

async function main() {
  const pw = await hashPassword('senha-forte-1')
  const gallery = await prisma.tenant.upsert({ where: { slug: 'galeria-ladeira' }, update: {}, create: { kind: 'GALLERY', name: 'Galeria Ladeira', slug: 'galeria-ladeira' } })
  await prisma.galleryPublicProfile.upsert({ where: { slug: 'galeria-ladeira' }, update: {}, create: {
    tenantId: gallery.id, slug: 'galeria-ladeira', name: 'Galeria Ladeira', city: 'Salvador', uf: 'BA', foundedYear: 2009, summary: 'Pintura contemporânea baiana, com foco em artistas do Centro Histórico.',
    about: 'Galeria Ladeira nasceu em 2009 num sobrado de Santo Antônio Além do Carmo, fundada por duas amigas que queriam mostrar artistas da cidade fora do circuito das capitais do Sudeste.\n\nAo longo dos anos, o programa cresceu para incluir residências, publicações e uma presença constante em feiras como SP-Arte e ArtRio, sem perder o foco em artistas locais em início e meio de carreira.',
    tagsJson: JSON.stringify(['Contemporânea', 'Pintura']), street: 'Rua Direita de Santo Antônio, 214', district: 'Santo Antônio Além do Carmo', lat: -12.9668, lng: -38.5048, websiteUrl: 'https://galerialadeira.example', hours: 'Terça a sábado, 10h às 19h',
  } })
  const tid = gallery.id
  if ((await prisma.galleryItem.count({ where: { tenantId: tid } })) === 0) {
    await prisma.galleryItem.createMany({ data: [
      { tenantId: tid, kind: 'MILESTONE', title: 'Abertura em Santo Antônio Além do Carmo', subtitle: '2009', sortOrder: 0 }, { tenantId: tid, kind: 'MILESTONE', title: 'Primeira participação na SP-Arte', subtitle: '2013', sortOrder: 1 },
      { tenantId: tid, kind: 'MILESTONE', title: 'Programa de residências para artistas', subtitle: '2017', sortOrder: 2 }, { tenantId: tid, kind: 'MILESTONE', title: 'Inventário completo certificado na HouseArt', subtitle: '2026', sortOrder: 3 },
      { tenantId: tid, kind: 'TEAM', title: 'Ana Ladeira', subtitle: 'Diretora e fundadora', sortOrder: 0 }, { tenantId: tid, kind: 'TEAM', title: 'Caio Consultor', subtitle: 'Art advisor', sortOrder: 1 },
      { tenantId: tid, kind: 'PHOTO', title: 'Sala principal', url: IMG('hAlt'), sortOrder: 0 }, { tenantId: tid, kind: 'PHOTO', title: 'Mezanino', url: IMG('k8'), sortOrder: 1 },
      { tenantId: tid, kind: 'ROOM', title: 'Sala principal', url: IMG('mSup'), sortOrder: 0 }, { tenantId: tid, kind: 'ROOM', title: 'Mezanino', url: IMG('mAir'), sortOrder: 1 },
    ] })
    await prisma.publication.create({ data: { tenantId: tid, kind: 'CATALOGUE', title: 'Dia claro', meta: 'Galeria Ladeira · 48 páginas', priceCents: null, action: 'DOWNLOAD', sortOrder: 0 } })
  }
  const staffUser = await prisma.user.upsert({ where: { email: 'a1@galeria.test' }, update: {}, create: { email: 'a1@galeria.test', name: 'Ana Ladeira', passwordHash: pw, profile: 'member', active: true, tenantId: tid, tenantRole: 'ADMIN', profiles: { create: { kind: 'GALLERY', isDefault: true } } } })
  const staff = await prisma.member.upsert({ where: { slug: 'ana-ladeira' }, update: {}, create: { userId: staffUser.id, tenantId: tid, kind: 'GALLERY_STAFF', displayName: 'Galeria Ladeira', slug: 'ana-ladeira', city: 'Salvador', uf: 'BA', role: 'ADMIN' } })
  await prisma.user.update({ where: { id: staffUser.id }, data: { memberId: staff.id } })

  const joanaTenant = await prisma.tenant.upsert({ where: { slug: 'joana-teixeira' }, update: {}, create: { kind: 'PERSON', name: 'Joana Teixeira', slug: 'joana-teixeira' } })
  const joanaUser = await prisma.user.upsert({ where: { email: 'joana@artista.test' }, update: {}, create: { email: 'joana@artista.test', name: 'Joana Teixeira', passwordHash: pw, profile: 'member', active: true, tenantId: joanaTenant.id, tenantRole: 'ADMIN', profiles: { create: { kind: 'ARTIST', isDefault: true } } } })
  const joanaMember = await prisma.member.upsert({ where: { slug: 'joana-teixeira' }, update: {}, create: { userId: joanaUser.id, tenantId: joanaTenant.id, kind: 'ARTIST', displayName: 'Joana Teixeira', slug: 'joana-teixeira', city: 'Salvador', uf: 'BA' } })
  await prisma.user.update({ where: { id: joanaUser.id }, data: { memberId: joanaMember.id } })

  const joana = await prisma.artist.upsert({ where: { slug: 'joana-teixeira' }, update: {}, create: { memberId: joanaMember.id, tenantId: joanaTenant.id, name: 'Joana Teixeira', slug: 'joana-teixeira', birthYear: 1988, verifiedAt: new Date() } })
  const tomas = await prisma.artist.upsert({ where: { slug: 'tomas-rezende' }, update: {}, create: { tenantId: tid, name: 'Tomás Rezende', slug: 'tomas-rezende', birthYear: 1931, deathYear: 2009 } })
  const lia = await prisma.artist.upsert({ where: { slug: 'lia-santana' }, update: {}, create: { tenantId: tid, name: 'Lia Santana', slug: 'lia-santana', birthYear: 1990 } })

  await prisma.artistProfile.upsert({ where: { artistId: joana.id }, update: {}, create: { artistId: joana.id, fullName: 'Joana Maria Teixeira de Almeida', birthPlace: 'Salvador/BA', livesIn: 'Salvador/BA', nationality: 'Brasileira', representation: 'Galeria Ladeira', languagesJson: JSON.stringify(['Pintura', 'Óleo sobre linho', 'Desenho', 'Abstração geométrica']), quote: 'Pinto a luz das sete da manhã antes que ela vire calor.', royaltyBps: 400,
    bio: 'Joana Teixeira formou-se em Artes Visuais pela UFBA e desde 2012 desenvolve uma pintura que parte da arquitetura colonial de Salvador para chegar a composições geométricas de cor chapada.\n\nSua pesquisa atual, a série “Construção”, investiga a luz rasante sobre fachadas e telhados do Centro Histórico, traduzida em planos de cor sobre linho cru.', photoCredit: 'Joana no ateliê, Santo Antônio Além do Carmo, 2025' } })
  await prisma.artistProfile.upsert({ where: { artistId: tomas.id }, update: {}, create: { artistId: tomas.id, fullName: 'Tomás Antônio Rezende Filho', birthPlace: 'Cachoeira/BA', deathPlace: 'Salvador/BA', nationality: 'Brasileira', estateName: 'Instituto Tomás Rezende', languagesJson: JSON.stringify(['Pintura', 'Acrílica e folha de ouro', 'Gravura', 'Arte sacra']), quote: 'O ouro não é luxo. É a cor que a igreja me ensinou a ver.', royaltyBps: 500,
    bio: 'Tomás Rezende cresceu entre os terreiros e as igrejas do Recôncavo, e fez dessa dupla herança o eixo de cinco décadas de produção. Estudou na Escola de Belas Artes da UFBA nos anos 1950.\n\nNos anos 1970 criou os “Retábulos”, pinturas de grande formato em acrílica e folha de ouro que reorganizam a iconografia barroca baiana em chave abstrata.', photoCredit: 'Tomás no ateliê do Rio Vermelho, c. 1985 · Acervo da família' } })
  if ((await prisma.artistEntry.count({ where: { artistId: joana.id } })) === 0) {
    await prisma.artistEntry.createMany({ data: [
      { artistId: joana.id, kind: 'TRAJECTORY', year: '1988', title: 'Nasce em Salvador, Bahia', sortOrder: 0 }, { artistId: joana.id, kind: 'TRAJECTORY', year: '2012', title: 'Bacharelado em Artes Visuais, UFBA', sortOrder: 1 }, { artistId: joana.id, kind: 'TRAJECTORY', year: '2016', title: 'Primeira individual, Galeria Ladeira', sortOrder: 2 }, { artistId: joana.id, kind: 'TRAJECTORY', year: '2026', title: '“Dia claro”, Galeria Ladeira', sortOrder: 3 },
      { artistId: joana.id, kind: 'SOLO', year: '2026', title: 'Dia claro', venue: 'Galeria Ladeira', city: 'Salvador/BA', sortOrder: 0 }, { artistId: joana.id, kind: 'SOLO', year: '2023', title: 'Fachada', venue: 'Caixa Cultural', city: 'Rio de Janeiro/RJ', sortOrder: 1 },
      { artistId: joana.id, kind: 'GROUP', year: '2025', title: 'Bienal da Bahia', venue: 'Museu de Arte Moderna da Bahia', city: 'Salvador/BA', sortOrder: 0 }, { artistId: joana.id, kind: 'GROUP', year: '2024', title: 'Geometria sensível', venue: 'Pinacoteca de São Paulo', city: 'São Paulo/SP', sortOrder: 1 },
      { artistId: joana.id, kind: 'AWARD', year: '2024', title: 'Prêmio PIPA · Finalista', venue: 'Instituto PIPA', sortOrder: 0 }, { artistId: joana.id, kind: 'AWARD', year: '2021', title: 'Prêmio Funarte de Artes Visuais', venue: 'Funarte', sortOrder: 1 },
      { artistId: joana.id, kind: 'EDUCATION', year: '2012', title: 'Bacharelado em Artes Visuais, UFBA', sortOrder: 0 }, { artistId: joana.id, kind: 'COLLECTION', year: '', title: 'Museu de Arte Moderna da Bahia', sortOrder: 0 }, { artistId: joana.id, kind: 'COLLECTION', year: '', title: 'Pinacoteca de São Paulo', sortOrder: 1 },
      { artistId: tomas.id, kind: 'TRAJECTORY', year: '1931', title: 'Nasce em Cachoeira, Recôncavo Baiano', sortOrder: 0 }, { artistId: tomas.id, kind: 'TRAJECTORY', year: '1974', title: 'Inicia a série “Retábulos”', sortOrder: 1 }, { artistId: tomas.id, kind: 'TRAJECTORY', year: '2009', title: 'Falece em Salvador', sortOrder: 2 },
      { artistId: tomas.id, kind: 'SOLO', year: '2021', title: 'Tomás Rezende: ouro e terra', venue: 'Museu de Arte da Bahia', city: 'Salvador/BA', sortOrder: 0 }, { artistId: tomas.id, kind: 'AWARD', year: '2005', title: 'Ordem do Mérito Cultural', venue: 'Ministério da Cultura', sortOrder: 0 },
    ] })
    await prisma.publication.createMany({ data: [
      { artistId: joana.id, kind: 'EBOOK', title: 'Construção: pinturas 2020–2026', meta: '96 páginas · PDF e ePub', priceCents: 3900n, action: 'BUY', sortOrder: 0 },
      { artistId: joana.id, kind: 'ESSAY', title: 'A luz como arquitetura', meta: 'por Ana Lúcia Rocha · 24 páginas', priceCents: null, action: 'READ', sortOrder: 1 },
      { artistId: tomas.id, kind: 'RAISONNE', title: 'Tomás Rezende: obra completa', meta: 'Instituto Tomás Rezende · 412 páginas', priceCents: 8900n, action: 'BUY', sortOrder: 0 },
    ] })
  }

  // artworks (listed, green, with cover + back + detail)
  const works = [
    { pid: 'HA-2026-7K3F-9Q2M', member: staff.id, artist: joana.id, title: 'Construção nº 7', year: 2025, technique: 'Óleo sobre linho', h: 1000, w: 800, price: 3_800_000n, mode: 'FIXED_WITH_OFFERS', market: 'PRIMARY', cat: 'PAINTING', img: 'mSup' },
    { pid: 'HA-2025-2B8D-4R1X', member: staff.id, artist: joana.id, title: 'Voo baixo', year: 2024, technique: 'Óleo sobre linho', h: 1200, w: 1000, price: 4_400_000n, mode: 'FIXED', market: 'PRIMARY', cat: 'PAINTING', img: 'mAir' },
    { pid: 'HA-2026-9P4K-6T3N', member: joanaMember.id, artist: joana.id, title: 'Estudo em vermelho', year: 2025, technique: 'Óleo sobre papel', h: 500, w: 500, price: 980_000n, mode: 'FIXED_WITH_OFFERS', market: 'PRIMARY', cat: 'PAINTING', img: 'mAbs' },
    { pid: 'HA-2024-5H1C-8V7A', member: staff.id, artist: tomas.id, title: 'Retábulo do Rio Vermelho', year: 1983, technique: 'Acrílica e folha de ouro', h: 1400, w: 1050, price: 32_000_000n, mode: 'ON_REQUEST', market: 'SECONDARY', cat: 'PAINTING', img: 'hAlt' },
    { pid: 'HA-2024-3M6K-1W9E', member: staff.id, artist: tomas.id, title: 'Duas luas', year: 1977, technique: 'Acrílica sobre tela', h: 900, w: 900, price: 18_500_000n, mode: 'FIXED', market: 'SECONDARY', cat: 'PAINTING', img: 'hSvan' },
    { pid: 'HA-2025-8MSB-2ITP', member: staff.id, artist: lia.id, title: 'Maré baixa, Itapuã', year: 2024, technique: 'Pigmento mineral · ed. 3/5', h: 600, w: 900, price: 780_000n, mode: 'FIXED_WITH_OFFERS', market: 'PRIMARY', cat: 'PHOTOGRAPHY', img: 'k8' },
  ]
  for (const w of works) {
    const existing = await prisma.artwork.findFirst({ where: { publicId: w.pid } })
    if (existing) continue
    const a = await prisma.artwork.create({ data: { memberId: w.member, artistId: w.artist, title: w.title, year: w.year, technique: w.technique, heightMm: w.h, widthMm: w.w, category: w.cat, status: 'LISTED', market: w.market, saleMode: w.mode, listPriceCents: w.price, publicId: w.pid, seal: 'GREEN', sealIssuedAt: new Date(), wizardStep: 6, submittedAt: new Date(),
      media: { create: [
        { kind: 'FRONT_COLOR_CARD', masterRef: 'demo', publicUrl: IMG(w.img), sha256: `demo-${w.pid}-front`, width: 700, height: 875, quality: 'GOOD', sortOrder: 0 },
        { kind: 'BACK', masterRef: 'demo', publicUrl: IMG('verso'), sha256: `demo-${w.pid}-back`, width: 700, height: 875, quality: 'GOOD', sortOrder: 1 },
        { kind: 'DETAIL', masterRef: 'demo', publicUrl: IMG(w.img), sha256: `demo-${w.pid}-detail`, width: 700, height: 875, quality: 'GOOD', sortOrder: 2 },
      ] },
      historyItems: { create: [{ kind: 'EXHIBITION', description: `Galeria Ladeira, “Dia claro”`, occurredOn: '2026-04', sortOrder: 0 }] },
      mandates: { create: { memberId: w.member, listPriceCents: w.price, reservePriceCents: (w.price * 85n) / 100n, fixedPrice: w.mode === 'FIXED', status: 'ACTIVE' } },
    } })
    const content = { publicId: w.pid, artwork: { title: w.title, year: w.year, technique: w.technique, materials: null, dimensionsMm: { h: w.h, w: w.w, d: null }, edition: null, category: w.cat }, artist: { name: w.artist === joana.id ? 'Joana Teixeira' : w.artist === tomas.id ? 'Tomás Rezende' : 'Lia Santana', slug: '' }, holder: 'Galeria Ladeira', version: 1 }
    const cert = await prisma.certificate.create({ data: { artworkId: a.id, publicId: w.pid, status: 'ACTIVE', stage: 5, signedAt: new Date('2026-03-12T14:32:00Z'), issuedAt: new Date('2026-03-12T14:32:00Z') } })
    const v = await prisma.certificateVersion.create({ data: { certificateId: cert.id, version: 1, holderName: w.member === staff.id ? 'Galeria Ladeira' : 'Joana Teixeira', contentJson: JSON.stringify(content), contentHash: contentHashOf(content as never), signaturesJson: '[]', issuedAt: new Date('2026-03-12T14:32:00Z') } })
    await prisma.certificate.update({ where: { id: cert.id }, data: { currentVersionId: v.id } })
    await recordEvent(cert.id, 'CREATED', new Date(`${w.year}-06-01T12:00:00Z`))
    await recordEvent(cert.id, 'CERTIFIED', new Date('2026-03-12T14:32:00Z'))
    await recordEvent(cert.id, 'LISTED', new Date('2026-05-02T10:00:00Z'))
  }

  if ((await prisma.newsArticle.count()) === 0) {
    await prisma.newsArticle.createMany({ data: [
      { slug: 'secundario-cresce', category: 'Mercado', title: 'Vendas de arte brasileira no mercado secundário crescem pelo terceiro ano', summary: 'Galerias do Nordeste lideram a alta, puxadas por artistas em meio de carreira e pela maior confiança dos colecionadores em obras com procedência registrada.', featured: true, publishedAt: new Date('2026-10-18') },
      { slug: 'feira-paulistana-setor', category: 'Feiras', title: 'Feira paulistana anuncia setor dedicado a galerias de fora do eixo Rio–São Paulo', publishedAt: new Date('2026-10-17') },
      { slug: 'museu-baiano-doacao', category: 'Museus', title: 'Museu baiano recebe doação de 40 obras de arte popular do Recôncavo', publishedAt: new Date('2026-10-15') },
      { slug: 'direito-de-sequencia', category: 'Direito', title: 'Como funciona o direito de sequência na revenda de obras de arte', publishedAt: new Date('2026-10-12') },
      { slug: 'fotografa-finalista', category: 'Artistas', title: 'Fotógrafa de Salvador é finalista de prêmio internacional', publishedAt: new Date('2026-10-09') },
    ] })
  }
  if ((await prisma.agendaEvent.count()) === 0) {
    await prisma.agendaEvent.createMany({ data: [
      { kind: 'OPENING', title: 'Dia claro: Joana Teixeira', venue: 'Galeria Ladeira', city: 'Salvador/BA', startsOn: '2026-11-05', period: 'Até 20 dez', tenantId: tid },
      { kind: 'FAIR', title: 'Feira de arte contemporânea do Recife', venue: 'Cais do Sertão', city: 'Recife/PE', startsOn: '2026-11-12', period: '12 a 15 nov' },
      { kind: 'EXHIBITION', title: 'Modernismos do Nordeste', venue: 'Museu de Arte da Bahia', city: 'Salvador/BA', startsOn: '2026-11-18', period: 'Até 28 fev' },
      { kind: 'AUCTION', title: 'Leilão de arte brasileira moderna', venue: 'Online e Rio de Janeiro', city: 'Rio de Janeiro/RJ', startsOn: '2026-11-26', period: 'Lances a partir de 19 nov' },
      { kind: 'EXHIBITION', title: 'Fotografia amazônica hoje', venue: 'Luz Norte', city: 'Belém/PA', startsOn: '2026-12-03', period: 'Até 31 jan' },
      { kind: 'OPENING', title: 'Coletiva de verão', venue: 'Casa Tamarindo', city: 'São Paulo/SP', startsOn: '2026-12-09', period: 'Até 15 fev' },
      { kind: 'EXHIBITION', title: 'Barro e fogo: cerâmica mineira', venue: 'Ateliê Barro Vivo', city: 'Belo Horizonte/MG', startsOn: '2027-01-16', period: 'Até 30 mar' },
    ] })
  }
  console.log('✔ demo público semeado')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
