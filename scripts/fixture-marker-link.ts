// Dev fixture for "Vincular etiqueta" on the web (handoff Fase 3), LOCAL database only:
// a batch with a KNOWN uid, a SHIPPED kit order of the test artist (joana@artista.test)
// with that marker, and an artwork of hers IN_CERTIFICATION without publicId.
// Idempotent by uid/title. Prints the uid to paste in the screen ("Simular toque").
//   Use: npx tsx scripts/fixture-marker-link.ts
import 'dotenv/config'
import { prisma } from '../lib/prisma'

const url = process.env.DATABASE_URL ?? ''
if (!/localhost|127\.0\.0\.1/.test(url)) { console.error('fixture-marker-link: só em banco local (DATABASE_URL aponta para fora).'); process.exit(1) }

const UID = process.env.FIXTURE_UID ?? '04deadbeef0001'
const TITLE = 'Maré de março'

async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'joana@artista.test' } })
  if (!user?.memberId || !user.tenantId) throw new Error('rode antes: npx tsx scripts/seed-public-demo.ts')
  const member = await prisma.member.findUniqueOrThrow({ where: { id: user.memberId } })
  const artist = await prisma.artist.findFirstOrThrow({ where: { memberId: member.id } })

  const batch = await prisma.markerBatch.upsert({ where: { code: '2026-10-DEV' }, update: {}, create: { code: '2026-10-DEV', quantity: 1, destination: 'dev', status: 'IN_USE' } })
  let order = await prisma.markerOrder.findFirst({ where: { memberId: member.id, status: 'SHIPPED' }, orderBy: { id: 'asc' } })
  order ??= await prisma.markerOrder.create({ data: { tenantId: member.tenantId, memberId: member.id, quantity: 1, status: 'SHIPPED', shippedAt: new Date() } })
  await prisma.physicalMarker.upsert({
    where: { uid: UID },
    update: { status: 'SHIPPED', orderId: order.id, artworkId: null, linkedAt: null, linkedByUserId: null, readCounter: 0 },
    create: { batchId: batch.id, uid: UID, keyRef: `div:${batch.code}:${UID.slice(0, 4)}`, status: 'SHIPPED', orderId: order.id },
  })

  let artwork = await prisma.artwork.findFirst({ where: { memberId: member.id, title: TITLE } })
  if (artwork?.publicId) {
    // a previous run linked it: free the marker's artwork row by resetting the artwork too
    await prisma.certificate.deleteMany({ where: { artworkId: artwork.id } })
    await prisma.physicalMarker.updateMany({ where: { artworkId: artwork.id }, data: { status: 'SHIPPED', artworkId: null, linkedAt: null, linkedByUserId: null, readCounter: 0 } })
    artwork = await prisma.artwork.update({ where: { id: artwork.id }, data: { publicId: null, status: 'IN_CERTIFICATION' } })
  }
  artwork ??= await prisma.artwork.create({ data: { tenantId: member.tenantId, memberId: member.id, artistId: artist.id, title: TITLE, year: 2026, technique: 'Óleo sobre tela', heightMm: 800, widthMm: 600, status: 'IN_CERTIFICATION', wizardStep: 5, submittedAt: new Date() } })
  console.log(JSON.stringify({ uid: UID, artworkId: artwork.id, orderId: order.id, url: `/certification/link/${artwork.id}` }))
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1) })
